package com.neobank.repository;

import com.neobank.model.entity.Account;
import com.neobank.model.entity.Transaction;
import com.neobank.model.entity.Transaction.TransactionType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Repository;

import javax.sql.DataSource;
import java.math.BigDecimal;
import java.sql.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * [R6] Raw JDBC implementation of the GenericRepository interface for Transaction.
 *
 * This layer exists ALONGSIDE JPA (TransactionJpaRepository) as an explicit
 * demonstration of JDBC skills required by R6.  It is used in ReportService
 * for reporting queries to show full CRUD via raw JDBC.
 *
 * Key constraints honoured:
 *  • All SQL uses PreparedStatement — no string concatenation in SQL.
 *  • Connection is obtained from the injected DataSource (Spring-managed pool).
 *  • Every Connection/Statement/ResultSet is closed in a try-with-resources block.
 *  • No empty catch blocks — every exception is logged and rethrown as RuntimeException.
 */
@Repository
@RequiredArgsConstructor
@Slf4j
public class JdbcTransactionRepository implements GenericRepository<Transaction, Long> {

    private final DataSource dataSource;

    // ── CREATE ───────────────────────────────────────────────────────────────

    /**
     * Inserts a new transaction row using a PreparedStatement.
     * The generated id is read back and set on the returned entity.
     *
     * @param tx the transaction to persist (id field is ignored on input)
     * @return the saved transaction with its database-assigned id
     */
    @Override
    public Transaction save(Transaction tx) {
        // [R6] PreparedStatement prevents SQL injection; no concatenation used
        String sql = """
                INSERT INTO transactions (account_id, type, amount, description, balance_after, timestamp)
                VALUES (?, ?, ?, ?, ?, ?)
                """;
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {

            ps.setLong(1, tx.getAccount().getId());
            ps.setString(2, tx.getType().name());
            ps.setBigDecimal(3, tx.getAmount());
            ps.setString(4, tx.getDescription());
            ps.setBigDecimal(5, tx.getBalanceAfter());
            ps.setTimestamp(6, Timestamp.valueOf(
                    tx.getTimestamp() != null ? tx.getTimestamp() : LocalDateTime.now()));

            int affected = ps.executeUpdate();
            if (affected == 0) {
                throw new SQLException("Inserting transaction affected 0 rows");
            }

            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (keys.next()) {
                    tx.setId(keys.getLong(1));
                }
            }
            log.debug("[R6] JDBC INSERT transaction id={}", tx.getId());
            return tx;

        } catch (SQLException e) {
            log.error("[R6] JDBC save failed: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to save transaction via JDBC", e);
        }
    }

    // ── READ (single) ────────────────────────────────────────────────────────

    /**
     * Finds a transaction by its primary key.
     *
     * @param id the transaction id
     * @return Optional containing the transaction, or empty if not found
     */
    @Override
    public Optional<Transaction> findById(Long id) {
        String sql = "SELECT * FROM transactions WHERE id = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {

            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapRow(rs));
                }
            }
            return Optional.empty();

        } catch (SQLException e) {
            log.error("[R6] JDBC findById failed for id={}: {}", id, e.getMessage(), e);
            throw new RuntimeException("Failed to find transaction by id via JDBC", e);
        }
    }

    // ── READ (all) ───────────────────────────────────────────────────────────

    /**
     * Returns all transactions ordered by timestamp descending.
     *
     * @return list of all transactions
     */
    @Override
    public List<Transaction> findAll() {
        String sql = "SELECT * FROM transactions ORDER BY timestamp DESC";

        // [R1] ArrayList used because we're building the list from an unknown-size ResultSet
        List<Transaction> results = new ArrayList<>();

        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {

            while (rs.next()) {
                results.add(mapRow(rs));
            }
            return results;

        } catch (SQLException e) {
            log.error("[R6] JDBC findAll failed: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to retrieve all transactions via JDBC", e);
        }
    }

    // ── DELETE ───────────────────────────────────────────────────────────────

    /**
     * Deletes a transaction by its primary key.
     *
     * @param id the transaction id to remove
     */
    @Override
    public void deleteById(Long id) {
        String sql = "DELETE FROM transactions WHERE id = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {

            ps.setLong(1, id);
            int affected = ps.executeUpdate();
            log.debug("[R6] JDBC DELETE transaction id={}, rows={}", id, affected);

        } catch (SQLException e) {
            log.error("[R6] JDBC deleteById failed for id={}: {}", id, e.getMessage(), e);
            throw new RuntimeException("Failed to delete transaction via JDBC", e);
        }
    }

    // ── EXISTS ───────────────────────────────────────────────────────────────

    @Override
    public boolean existsById(Long id) {
        String sql = "SELECT COUNT(*) FROM transactions WHERE id = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {

            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() && rs.getLong(1) > 0;
            }

        } catch (SQLException e) {
            log.error("[R6] JDBC existsById failed for id={}: {}", id, e.getMessage(), e);
            throw new RuntimeException("Failed to check existence via JDBC", e);
        }
    }

    // ── REPORTING QUERIES ────────────────────────────────────────────────────

    /**
     * Returns all transactions for an account within a date range.
     * [R6] PreparedStatement binds account_id and both timestamps safely.
     *
     * @param accountId the account primary key
     * @param from      start of the range (inclusive)
     * @param to        end of the range (inclusive)
     * @return list of matching transactions sorted oldest-first
     */
    public List<Transaction> findByAccountAndDateRange(Long accountId,
                                                        LocalDateTime from,
                                                        LocalDateTime to) {
        String sql = """
                SELECT * FROM transactions
                WHERE account_id = ?
                  AND timestamp BETWEEN ? AND ?
                ORDER BY timestamp ASC
                """;
        List<Transaction> results = new ArrayList<>();
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {

            ps.setLong(1, accountId);
            ps.setTimestamp(2, Timestamp.valueOf(from));
            ps.setTimestamp(3, Timestamp.valueOf(to));

            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    results.add(mapRow(rs));
                }
            }
            return results;

        } catch (SQLException e) {
            log.error("[R6] JDBC date-range query failed: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to query transactions by date range via JDBC", e);
        }
    }

    /**
     * Returns the sum of all debits for a given account — used in the monthly report.
     *
     * @param accountId the account primary key
     * @return total debit amount; zero if no debits exist
     */
    public BigDecimal sumDebitsByAccount(Long accountId) {
        String sql = "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE account_id = ? AND type = 'DEBIT'";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {

            ps.setLong(1, accountId);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getBigDecimal(1) : BigDecimal.ZERO;
            }

        } catch (SQLException e) {
            log.error("[R6] JDBC sumDebitsByAccount failed: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to sum debits via JDBC", e);
        }
    }

    // ── PRIVATE HELPERS ──────────────────────────────────────────────────────

    /**
     * Maps a ResultSet row to a lightweight Transaction shell.
     * NOTE: account is set to a stub with only the id populated — full
     * hydration happens in the service layer via JPA when needed.
     */
    private Transaction mapRow(ResultSet rs) throws SQLException {
        Account stub = new Account();
        stub.setId(rs.getLong("account_id"));

        Timestamp ts = rs.getTimestamp("timestamp");

        return Transaction.builder()
                .id(rs.getLong("id"))
                .account(stub)
                .type(TransactionType.valueOf(rs.getString("type")))
                .amount(rs.getBigDecimal("amount"))
                .description(rs.getString("description"))
                .balanceAfter(rs.getBigDecimal("balance_after"))
                .timestamp(ts != null ? ts.toLocalDateTime() : null)
                .build();
    }
}
