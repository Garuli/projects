package com.neobank.service;

import com.neobank.exception.InsufficientFundsException;
import com.neobank.exception.TransferLimitExceededException;
import com.neobank.model.dto.TransactionResponse;
import com.neobank.model.dto.TransferRequest;
import com.neobank.model.entity.Account;
import com.neobank.model.entity.Transaction;
import com.neobank.model.entity.Transaction.TransactionType;
import com.neobank.pattern.strategy.InterestCalculationStrategy;
import com.neobank.repository.TransactionJpaRepository;
import com.neobank.util.TransactionIdGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import java.util.UUID;

/**
 * Business logic for money transfers and transaction history.
 *
 * [R5] CompletableFuture used for async transaction audit logging.
 *      ExecutorService (fixed thread pool) simulates concurrent transfers.
 *      AtomicLong in TransactionIdGenerator ensures thread-safe ID generation.
 *
 * [R1] TreeSet used to maintain sorted, unique transaction records (R1 requirement).
 *
 * [R3] Predicate<BigDecimal> validates transfer amounts inline.
 *
 * [R4] Stream filter/map/sorted/collect/reduce used throughout.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TransactionService {

    private final TransactionJpaRepository txRepo;
    private final AccountService           accountService;
    private final TransactionIdGenerator   idGenerator;

    /**
     * [R5] Fixed-size thread pool for simulating concurrent transfer processing.
     * Fixed at 4 threads to limit resource consumption while still demonstrating
     * ExecutorService.  A production system would use a configurable pool size.
     */
    private final ExecutorService transferExecutor = Executors.newFixedThreadPool(4);

    /**
     * [R3] Predicate validates that a transfer amount is strictly positive.
     * Declared as a field to demonstrate a named Predicate<BigDecimal> (R3).
     */
    private final Predicate<BigDecimal> isPositiveAmount =
            amount -> amount != null && amount.compareTo(BigDecimal.ZERO) > 0;

    // ── TRANSFER ─────────────────────────────────────────────────────────────

    /**
     * Executes a money transfer between two accounts atomically.
     *
     * Thread safety: the entire method runs inside a DB transaction.
     * The fixed thread pool (transferExecutor) is used here to submit the
     * audit log write as a non-blocking async task after the transfer commits.
     *
     * [R5] CompletableFuture.runAsync() offloads the audit log write so the
     * caller gets a response immediately after the DB commit.
     *
     * [R9] Strategy pattern: overdraft and transfer limits are determined by
     * each account's InterestCalculationStrategy, not hardcoded here.
     *
     * @param request validated transfer request
     * @return list containing both the debit and credit transaction DTOs
     */
    @Transactional
    public List<TransactionResponse> transfer(TransferRequest request) {
        // [R3] Predicate validation before any DB work
        if (!isPositiveAmount.test(request.getAmount())) {
            throw new IllegalArgumentException("Transfer amount must be positive");
        }

        Account source = accountService.getAccountEntityByNumber(request.getFromAccountNumber());
        Account target = accountService.getAccountEntityByNumber(request.getToAccountNumber());

        if (source.getId().equals(target.getId())) {
            throw new IllegalArgumentException("Source and destination accounts must be different");
        }

        BigDecimal amount = request.getAmount();

        // [R9] Strategy: get per-account-type transfer limit
        InterestCalculationStrategy sourceStrategy = accountService.getStrategy(source);
        BigDecimal transferLimit = sourceStrategy.getTransferLimit();

        if (amount.compareTo(transferLimit) > 0) {
            throw new TransferLimitExceededException(amount, transferLimit);
        }

        // Debit/Savings: balance must stay above the overdraft floor.
        // Credit: availableCredit must cover the transfer amount.
        BigDecimal sourceBalanceAfter;
        if (source.getCategory() == Account.AccountCategory.CREDIT) {
            BigDecimal avail = source.getAvailableCredit() != null
                    ? source.getAvailableCredit() : BigDecimal.ZERO;
            if (avail.compareTo(amount) < 0) {
                throw new InsufficientFundsException(source.getAccountNumber(), amount, avail);
            }
            source.setAvailableCredit(avail.subtract(amount));
            source.setBalance(source.getBalance().add(amount)); // amount owed increases
            sourceBalanceAfter = source.getBalance();
        } else {
            BigDecimal overdraftFloor = sourceStrategy.getOverdraftLimit();
            BigDecimal newBalance = source.getBalance().subtract(amount);
            if (newBalance.compareTo(overdraftFloor) < 0) {
                throw new InsufficientFundsException(source.getAccountNumber(), amount, source.getBalance());
            }
            source.setBalance(newBalance);
            sourceBalanceAfter = newBalance;
        }

        // Receiving into a credit account reduces owed amount and restores available credit.
        // Receiving into a debit account simply increases balance.
        BigDecimal targetBalanceAfter;
        if (target.getCategory() == Account.AccountCategory.CREDIT) {
            BigDecimal currentOwed = target.getBalance();
            BigDecimal newOwed = currentOwed.subtract(amount).max(BigDecimal.ZERO);
            BigDecimal applied = currentOwed.subtract(newOwed); // portion that reduced owed balance
            target.setBalance(newOwed);
            BigDecimal newAvail = (target.getAvailableCredit() != null
                    ? target.getAvailableCredit() : BigDecimal.ZERO).add(applied);
            if (target.getCreditLimit() != null && newAvail.compareTo(target.getCreditLimit()) > 0) {
                newAvail = target.getCreditLimit(); // cap at credit limit
            }
            target.setAvailableCredit(newAvail);
            targetBalanceAfter = newOwed;
        } else {
            BigDecimal newBalance = target.getBalance().add(amount);
            target.setBalance(newBalance);
            targetBalanceAfter = newBalance;
        }

        accountService.saveAccount(source);
        accountService.saveAccount(target);

        // Shared reference links both legs so the UI can deduplicate self-transfers
        String transferRef = UUID.randomUUID().toString();

        String sourceEmail = source.getUser().getEmail();
        String targetEmail = target.getUser().getEmail();

        String memo = (request.getDescription() != null && !request.getDescription().isBlank())
                ? request.getDescription() : null;
        String debitDesc  = memo != null ? "Transfer to " + target.getAccountNumber() + ": " + memo
                                         : "Transfer to " + target.getAccountNumber();
        String creditDesc = memo != null ? "Transfer from " + source.getAccountNumber() + ": " + memo
                                         : "Transfer from " + source.getAccountNumber();

        Transaction debit = buildTransfer(source, TransactionType.DEBIT, amount, debitDesc,
                sourceBalanceAfter, transferRef, target.getAccountNumber(), targetEmail);
        Transaction credit = buildTransfer(target, TransactionType.CREDIT, amount, creditDesc,
                targetBalanceAfter, transferRef, source.getAccountNumber(), sourceEmail);

        Transaction savedDebit  = txRepo.save(debit);
        Transaction savedCredit = txRepo.save(credit);

        log.info("Transfer completed: {} → {} amount={}", source.getAccountNumber(),
                target.getAccountNumber(), amount);

        // [R5] CompletableFuture: fire-and-forget audit log write on a separate thread
        CompletableFuture.runAsync(() ->
                log.info("[AUDIT] TXN ref={} debit={} credit={} amount={} ts={}",
                        idGenerator.nextReference(),
                        savedDebit.getId(), savedCredit.getId(), amount,
                        LocalDateTime.now()),
                transferExecutor
        );

        return List.of(toResponse(savedDebit), toResponse(savedCredit));
    }

    // ── HISTORY ──────────────────────────────────────────────────────────────

    /**
     * Returns pageable transaction history for an account, optionally filtered
     * by a date range.
     *
     * [R1] Results are loaded into a TreeSet to demonstrate sorted, unique
     * transaction storage — TreeSet uses Transaction.compareTo() (chronological).
     *
     * [R4] Stream filter/sorted/collect applied to the TreeSet stream.
     *
     * @param accountId the account primary key
     * @param from      optional start of date range (null = no lower bound)
     * @param to        optional end of date range (null = no upper bound)
     * @return transaction history as DTOs
     */
    @Transactional(readOnly = true)
    public List<TransactionResponse> getTransactionHistory(Long accountId,
                                                           LocalDateTime from,
                                                           LocalDateTime to) {
        List<Transaction> raw;
        if (from != null && to != null) {
            raw = txRepo.findByAccountIdAndTimestampBetween(accountId, from, to);
        } else {
            raw = txRepo.findByAccountIdOrderByTimestampDesc(accountId);
        }

        // [R1] TreeSet: maintains chronological order, rejects duplicates
        // Chosen over plain List because sorted uniqueness is guaranteed without
        // an explicit sort call — the TreeSet invariant does it automatically.
        TreeSet<Transaction> sorted = new TreeSet<>(raw);

        // [R4] Stream the TreeSet (already ordered) and collect to response DTOs
        return sorted.stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    /**
     * Returns all transactions as response DTOs (used by report module).
     *
     * [R4] Stream map to project entities to DTOs.
     *
     * @return all transactions newest-first
     */
    @Transactional(readOnly = true)
    public List<TransactionResponse> getAllTransactions() {
        return txRepo.findAll()
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    /**
     * Returns the top N transactions by amount.
     *
     * [R4] Stream sorted + limit to find top records.
     *
     * @param n number of top transactions to return
     * @return top N transactions
     */
    @Transactional(readOnly = true)
    public List<TransactionResponse> getTopTransactions(int n) {
        return txRepo.findTopByAmount(PageRequest.of(0, n))
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    /**
     * Computes total debited amount across all transactions.
     *
     * [R4] Stream filter (DEBIT only) + reduce to sum.
     *
     * @return total debited amount
     */
    @Transactional(readOnly = true)
    public BigDecimal totalDebited() {
        return txRepo.findAll()
                .stream()
                // [R4] filter: keep only DEBIT transactions
                .filter(t -> t.getType() == TransactionType.DEBIT)
                // [R4] reduce: sum all debit amounts starting from ZERO
                .map(Transaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /**
     * Computes total credited amount across all transactions.
     *
     * [R4] Stream filter (CREDIT only) + reduce to sum.
     *
     * @return total credited amount
     */
    @Transactional(readOnly = true)
    public BigDecimal totalCredited() {
        return txRepo.findAll()
                .stream()
                // [R4] filter: keep only CREDIT transactions
                .filter(t -> t.getType() == TransactionType.CREDIT)
                .map(Transaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /**
     * Returns all transactions across all accounts owned by a user, sorted newest-first.
     * Used by the "All My Accounts" transactions view.
     */
    @Transactional(readOnly = true)
    public List<TransactionResponse> getUserTransactions(Long userId) {
        return txRepo.findByAccountUserIdOrderByTimestampDesc(userId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    // ── HELPERS ──────────────────────────────────────────────────────────────

    private Transaction buildTransfer(Account account, TransactionType type,
                                       BigDecimal amount, String description,
                                       BigDecimal balanceAfter, String transferRef,
                                       String counterpartAccountNumber, String counterpartEmail) {
        return Transaction.builder()
                .account(account)
                .type(type)
                .amount(amount)
                .description(description)
                .balanceAfter(balanceAfter)
                .timestamp(LocalDateTime.now())
                .transferRef(transferRef)
                .counterpartAccountNumber(counterpartAccountNumber)
                .counterpartEmail(counterpartEmail)
                .status("COMPLETED")
                .build();
    }

    private Transaction buildTransaction(Account account, TransactionType type,
                                          BigDecimal amount, String description,
                                          BigDecimal balanceAfter) {
        return Transaction.builder()
                .account(account)
                .type(type)
                .amount(amount)
                .description(description)
                .balanceAfter(balanceAfter)
                .timestamp(LocalDateTime.now())
                .build();
    }

    private TransactionResponse toResponse(Transaction tx) {
        Account acct = tx.getAccount();
        return TransactionResponse.builder()
                .id(tx.getId())
                .accountId(acct != null ? acct.getId() : null)
                .accountNumber(acct != null ? acct.getAccountNumber() : "N/A")
                .accountType(acct != null ? acct.getType().name() : null)
                .type(tx.getType())
                .amount(tx.getAmount())
                .description(tx.getDescription())
                .balanceAfter(tx.getBalanceAfter())
                .timestamp(tx.getTimestamp())
                .transferRef(tx.getTransferRef())
                .counterpartAccountNumber(tx.getCounterpartAccountNumber())
                .counterpartEmail(tx.getCounterpartEmail())
                .status(tx.getStatus() != null ? tx.getStatus() : "COMPLETED")
                .build();
    }
}
