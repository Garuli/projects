package com.neobank.repository;

import com.neobank.model.entity.Account;
import com.neobank.model.entity.Account.AccountType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

/**
 * [R7] Spring Data JPA repository for Account entities.
 */
public interface AccountJpaRepository extends JpaRepository<Account, Long> {

    /** Find account by its unique human-readable number. */
    Optional<Account> findByAccountNumber(String accountNumber);

    /** All accounts belonging to a specific user. */
    List<Account> findByUserId(Long userId);

    /** All accounts of a given type (e.g., all SAVINGS accounts). */
    List<Account> findByType(AccountType type);

    /** Check for account number uniqueness before creation. */
    boolean existsByAccountNumber(String accountNumber);

    /**
     * [R7] Custom JPQL: sum of all account balances system-wide.
     * Used by ReportService to compute total bank assets.
     *
     * @return total balance across all accounts; 0 if no accounts exist
     */
    @Query("SELECT COALESCE(SUM(a.balance), 0) FROM Account a")
    BigDecimal sumAllBalances();

    /**
     * [R7] Custom JPQL: accounts with balance above a given threshold,
     * sorted descending — used for the top-balance report.
     *
     * @param threshold minimum balance to include
     * @return accounts sorted by balance descending
     */
    @Query("SELECT a FROM Account a WHERE a.balance >= :threshold ORDER BY a.balance DESC")
    List<Account> findAccountsAboveBalance(@Param("threshold") BigDecimal threshold);
}
