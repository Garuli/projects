package com.neobank.service;

import com.neobank.model.dto.SummaryReport;
import com.neobank.model.dto.TransactionResponse;
import com.neobank.model.entity.Account;
import com.neobank.model.entity.Transaction;
import com.neobank.model.entity.Transaction.TransactionType;
import com.neobank.repository.AccountJpaRepository;
import com.neobank.repository.JdbcTransactionRepository;
import com.neobank.repository.TransactionJpaRepository;
import com.neobank.repository.UserJpaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.OptionalDouble;
import java.util.stream.Collectors;

/**
 * Report generation service.
 *
 * [R4] Heavy use of Stream API — filter, map, sorted, collect, reduce.
 * [R6] JdbcTransactionRepository used for raw JDBC reporting queries.
 *
 * Demonstrates that JPA repositories and raw JDBC can coexist in the
 * same service layer, each used where most appropriate:
 *   JPA  → object graph traversal, custom JPQL aggregates
 *   JDBC → lower-level reporting with explicit SQL control
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class ReportService {

    private final UserJpaRepository        userRepo;
    private final AccountJpaRepository     accountRepo;
    private final TransactionJpaRepository txJpaRepo;
    private final JdbcTransactionRepository jdbcTxRepo;
    private final TransactionService       transactionService;

    /**
     * Builds a full summary report of bank-wide statistics.
     *
     * [R4] Operations used:
     *   filter  → separate DEBITs from CREDITs for totals
     *   map     → project entities to amounts
     *   sorted  → top transactions in descending order
     *   collect → accumulate results into Lists
     *   reduce  → sum BigDecimal amounts from zero
     *
     * [R6] JdbcTransactionRepository.findAll() demonstrates raw JDBC
     * alongside the JPA-backed aggregate queries.
     *
     * @return SummaryReport populated with live bank statistics
     */
    public SummaryReport generateSummary() {
        log.info("Generating bank-wide summary report");

        long totalUsers    = userRepo.count();
        long totalAccounts = accountRepo.count();
        long totalTxns     = txJpaRepo.count();

        // [R7] Custom JPQL aggregate query: SUM of all account balances
        BigDecimal totalBalance = accountRepo.sumAllBalances();

        // [R7] Custom JPQL aggregate: AVG transaction amount
        BigDecimal avgTxAmount = txJpaRepo.averageTransactionAmount()
                .setScale(2, RoundingMode.HALF_UP);

        // [R4] Stream: all transactions → filter DEBIT → map to amount → reduce sum
        BigDecimal totalDebited = transactionService.totalDebited();

        // [R4] Stream: all transactions → filter CREDIT → map to amount → reduce sum
        BigDecimal totalCredited = transactionService.totalCredited();

        // [R4] sorted + limit: top 5 transactions by amount
        List<TransactionResponse> topTxns = transactionService.getTopTransactions(5);

        // [R6] Demonstrate raw JDBC read: fetch all transactions via JDBC layer
        List<Transaction> jdbcTxns = jdbcTxRepo.findAll();
        log.debug("[R6] JDBC read {} total transactions for summary cross-check", jdbcTxns.size());

        return SummaryReport.builder()
                .totalUsers(totalUsers)
                .totalAccounts(totalAccounts)
                .totalTransactions(totalTxns)
                .totalBalanceAllAccounts(totalBalance)
                .averageTransactionAmount(avgTxAmount)
                .topTransactions(topTxns)
                .totalDebited(totalDebited)
                .totalCredited(totalCredited)
                .build();
    }

    public SummaryReport generateUserSummary(Long userId) {
        List<Account> accounts = accountRepo.findByUserId(userId);

        BigDecimal totalBalance = accounts.stream()
                .map(Account::getBalance)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<TransactionResponse> allTxns = accounts.stream()
                .flatMap(a -> transactionService.getTransactionHistory(a.getId(), null, null).stream())
                .collect(Collectors.toList());

        BigDecimal totalDebited = allTxns.stream()
                .filter(t -> t.getType() == TransactionType.DEBIT)
                .map(TransactionResponse::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalCredited = allTxns.stream()
                .filter(t -> t.getType() == TransactionType.CREDIT)
                .map(TransactionResponse::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        long txCount = allTxns.size();
        BigDecimal avgTx = txCount > 0
                ? allTxns.stream().map(TransactionResponse::getAmount)
                        .reduce(BigDecimal.ZERO, BigDecimal::add)
                        .divide(BigDecimal.valueOf(txCount), 2, java.math.RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        List<TransactionResponse> topTxns = allTxns.stream()
                .sorted((a, b) -> b.getAmount().compareTo(a.getAmount()))
                .limit(5)
                .collect(Collectors.toList());

        return SummaryReport.builder()
                .totalUsers(1L)
                .totalAccounts((long) accounts.size())
                .totalTransactions(txCount)
                .totalBalanceAllAccounts(totalBalance)
                .averageTransactionAmount(avgTx)
                .topTransactions(topTxns)
                .totalDebited(totalDebited)
                .totalCredited(totalCredited)
                .build();
    }
}
