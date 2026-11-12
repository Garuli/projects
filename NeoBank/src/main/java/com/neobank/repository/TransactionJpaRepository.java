package com.neobank.repository;

import com.neobank.model.entity.Transaction;
import com.neobank.model.entity.Transaction.TransactionType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * [R7] Spring Data JPA repository for Transaction entities.
 */
public interface TransactionJpaRepository extends JpaRepository<Transaction, Long> {

    /** All transactions for an account, newest first. */
    List<Transaction> findByAccountIdOrderByTimestampDesc(Long accountId);

    /** Transactions for an account filtered by type (DEBIT or CREDIT). */
    List<Transaction> findByAccountIdAndTypeOrderByTimestampDesc(Long accountId, TransactionType type);

    /**
     * [R7] Custom JPQL: transactions for an account within a date range.
     * Used by the transaction history endpoint that accepts ?from= &to= params.
     *
     * @param accountId the account's primary key
     * @param from      start of the date range (inclusive)
     * @param to        end of the date range (inclusive)
     * @return matching transactions sorted chronologically ascending
     */
    @Query("""
            SELECT t FROM Transaction t
            WHERE t.account.id = :accountId
              AND t.timestamp BETWEEN :from AND :to
            ORDER BY t.timestamp ASC
            """)
    List<Transaction> findByAccountIdAndTimestampBetween(
            @Param("accountId") Long accountId,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to);

    /**
     * [R7] Custom JPQL: average transaction amount across all accounts.
     * Used by the summary report (R4 reduce/collect operations build on this).
     *
     * @return average, or 0 if no transactions exist
     */
    @Query("SELECT COALESCE(AVG(t.amount), 0) FROM Transaction t")
    BigDecimal averageTransactionAmount();

    /** Top N transactions by amount — used for the summary report. */
    @Query("SELECT t FROM Transaction t ORDER BY t.amount DESC")
    List<Transaction> findTopByAmount(org.springframework.data.domain.Pageable pageable);

    /** All transactions across all accounts owned by a user, newest first. */
    @Query("SELECT t FROM Transaction t WHERE t.account.user.id = :userId ORDER BY t.timestamp DESC")
    List<Transaction> findByAccountUserIdOrderByTimestampDesc(@Param("userId") Long userId);
}
