package com.neobank.service;

import com.neobank.exception.AccountNotFoundException;
import com.neobank.exception.DuplicateAccountException;
import com.neobank.model.dto.AccountResponse;
import com.neobank.model.dto.CreateAccountRequest;
import com.neobank.model.entity.Account;
import com.neobank.model.entity.Account.AccountCategory;
import com.neobank.model.entity.Account.AccountType;
import com.neobank.model.entity.User;
import com.neobank.pattern.factory.AccountFactory;
import com.neobank.pattern.strategy.InterestCalculationStrategy;
import com.neobank.repository.AccountJpaRepository;
import com.neobank.util.AccountNumberGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Predicate;
import java.util.stream.Collectors;

/**
 * Business logic for account management.
 *
 * [R9] Delegates account creation to AccountFactory (Factory pattern) and
 * interest/overdraft rules to InterestCalculationStrategy (Strategy pattern).
 *
 * [R3] Lambda Predicate used for balance validation.
 * [R4] Stream sorted/collect used for account listing.
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class AccountService {

    private final AccountJpaRepository accountRepo;
    private final AccountFactory       accountFactory;
    private final com.neobank.repository.TransactionJpaRepository txRepo;
    private final AccountNumberGenerator numberGenerator;
    private final UserService          userService;

    /** DEBIT account types — traditional bank accounts, always open at $0. */
    private static final BigDecimal MAX_OPENING_DEPOSIT = new BigDecimal("1000000");

    private static final Set<AccountType> DEBIT_TYPES =
            Set.of(AccountType.SAVINGS, AccountType.CURRENT, AccountType.CHECKING);

    /** CREDIT account types — revolving credit lines with an approved limit, balance=owed. */
    private static final Set<AccountType> CREDIT_TYPES =
            Set.of(AccountType.STUDENT, AccountType.PREMIUM);

    /** Maximum credit limit allowed per credit account type. */
    private static final Map<AccountType, BigDecimal> MAX_CREDIT_LIMIT = Map.of(
            AccountType.STUDENT,  new BigDecimal("2000.00"),
            AccountType.PREMIUM,  new BigDecimal("500000.00")
    );

    /** Minimum credit limit required when opening a credit account. */
    private static final BigDecimal MIN_CREDIT_LIMIT = new BigDecimal("100.00");

    /** Monthly maintenance fee applied to all DEBIT accounts. */
    public static final BigDecimal DEBIT_MAINTENANCE_FEE = new BigDecimal("0.50");

    /**
     * [R3] Predicate<BigDecimal> validates that an initial deposit is non-negative.
     * Defined as a field so it is reusable across methods without a new lambda each call.
     */
    private final Predicate<BigDecimal> isValidDeposit = amount ->
            amount != null && amount.compareTo(BigDecimal.ZERO) >= 0;

    // ── CREATE ───────────────────────────────────────────────────────────────

    /**
     * Creates a new account for an existing user.
     *
     * [R9] AccountFactory.create() applies the Factory pattern — the service
     * does not know how to build an Account, it only knows what type it wants.
     *
     * @param request validated account creation request
     * @return the persisted account as a response DTO
     * @throws DuplicateAccountException if the generated number already exists (race)
     */
    public AccountResponse createAccount(CreateAccountRequest request) {
        AccountType type = request.getType();
        AccountCategory category;
        BigDecimal openingBalance;
        BigDecimal creditLimit     = null;
        BigDecimal availableCredit = null;

        if (DEBIT_TYPES.contains(type)) {
            // DEBIT: optional opening deposit (defaults to $0), capped for the demo
            category = AccountCategory.DEBIT;
            BigDecimal deposit = request.getInitialDeposit() == null ? BigDecimal.ZERO : request.getInitialDeposit();
            if (!isValidDeposit.test(deposit)) {
                throw new IllegalArgumentException("Opening deposit cannot be negative.");
            }
            if (deposit.compareTo(MAX_OPENING_DEPOSIT) > 0) {
                throw new IllegalArgumentException("Opening deposit cannot be more than $" + MAX_OPENING_DEPOSIT.toPlainString() + ".");
            }
            openingBalance = deposit;

        } else if (type == AccountType.BUSINESS) {
            // BUSINESS: seed capital — opening balance equals the initial deposit entered
            category = AccountCategory.DEBIT;
            BigDecimal deposit = request.getInitialDeposit();
            if (!isValidDeposit.test(deposit)) {
                throw new IllegalArgumentException("Initial deposit for BUSINESS accounts must be non-negative.");
            }
            openingBalance = deposit;

        } else if (CREDIT_TYPES.contains(type)) {
            // CREDIT: balance starts at 0 (amount owed); creditLimit and availableCredit equal the requested limit
            category       = AccountCategory.CREDIT;
            openingBalance = BigDecimal.ZERO;
            BigDecimal requested = request.getCreditLimit();
            if (requested == null || requested.compareTo(MIN_CREDIT_LIMIT) < 0) {
                throw new IllegalArgumentException(
                        "A credit limit of at least $" + MIN_CREDIT_LIMIT.toPlainString()
                        + " is required for " + type + " accounts.");
            }
            BigDecimal maxAllowed = MAX_CREDIT_LIMIT.get(type);
            if (requested.compareTo(maxAllowed) > 0) {
                throw new IllegalArgumentException(
                        "Requested credit limit $" + requested.toPlainString()
                        + " exceeds the maximum allowed $" + maxAllowed.toPlainString()
                        + " for " + type + " accounts.");
            }
            creditLimit     = requested;
            availableCredit = requested; // full credit available at opening

        } else {
            throw new IllegalArgumentException("Unknown account type: " + type);
        }

        User owner = userService.getUserEntityById(request.getUserId());
        String accountNumber;
        do {
            accountNumber = numberGenerator.generate();
        } while (accountRepo.existsByAccountNumber(accountNumber));

        // [R9 - Factory Pattern] AccountFactory.create() encapsulates type-specific field initialization.
        Account account = accountFactory.create(type, owner, accountNumber,
                openingBalance, creditLimit, availableCredit);
        account.setCategory(category);

        Account saved = accountRepo.save(account);
        if (openingBalance.compareTo(BigDecimal.ZERO) > 0) {
            // record the opening deposit so history, analytics and the balance always agree
            txRepo.save(com.neobank.model.entity.Transaction.builder()
                    .account(saved)
                    .type(com.neobank.model.entity.Transaction.TransactionType.CREDIT)
                    .amount(openingBalance)
                    .description("Opening deposit")
                    .balanceAfter(openingBalance)
                    .status("COMPLETED")
                    .timestamp(java.time.LocalDateTime.now())
                    .build());
        }
        log.info("Created {} account number={} type={} for userId={}",
                category, saved.getAccountNumber(), saved.getType(), owner.getId());
        return toResponse(saved);
    }

    // ── READ ─────────────────────────────────────────────────────────────────

    /**
     * Returns all accounts sorted by balance descending.
     *
     * [R4] Stream sorted() + collect() with a Comparator on BigDecimal.
     * [R3] Comparator.comparing lambda provides the sort key.
     *
     * @return sorted list of all accounts
     */
    @Transactional(readOnly = true)
    public List<AccountResponse> getAllAccounts() {
        return accountRepo.findAll()
                .stream()
                // [R3] Comparator lambda: sort accounts by balance high → low
                .sorted(Comparator.comparing(Account::getBalance).reversed())
                // [R4] map + collect terminal operations
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    /**
     * Returns a single account by id.
     *
     * @param id the account primary key
     * @return the account response DTO
     * @throws AccountNotFoundException if no account exists with the given id
     */
    @Transactional(readOnly = true)
    public AccountResponse getAccountById(Long id) {
        Account account = accountRepo.findById(id)
                .orElseThrow(() -> new AccountNotFoundException(id));
        return toResponse(account);
    }

    /**
     * Returns the current balance for an account.
     *
     * @param id the account primary key
     * @return current balance
     */
    @Transactional(readOnly = true)
    public BigDecimal getBalance(Long id) {
        Account account = accountRepo.findById(id)
                .orElseThrow(() -> new AccountNotFoundException(id));
        return account.getBalance();
    }

    /**
     * Finds the Account entity by its account number string.
     * Used internally by TransactionService during transfers.
     *
     * @param accountNumber the human-readable account number (e.g. "NEO-100001")
     * @return the JPA Account entity
     */
    @Transactional(readOnly = true)
    public Account getAccountEntityByNumber(String accountNumber) {
        return accountRepo.findByAccountNumber(accountNumber)
                .orElseThrow(() -> new AccountNotFoundException(accountNumber));
    }

    /**
     * Returns all accounts for a specific user.
     *
     * [R4] Stream filter() to narrow by user id.
     *
     * @param userId the user's primary key
     * @return list of that user's accounts
     */
    @Transactional(readOnly = true)
    public List<AccountResponse> getAccountsByUser(Long userId) {
        return accountRepo.findByUserId(userId)
                .stream()
                // [R4] filter — only accounts belonging to this user
                .filter(a -> a.getUser().getId().equals(userId))
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    /**
     * Returns the InterestCalculationStrategy for a given account.
     * Delegates to AccountFactory which owns the strategy registry.
     *
     * @param account the account entity
     * @return the matching InterestCalculationStrategy
     */
    public InterestCalculationStrategy getStrategy(Account account) {
        return accountFactory.getStrategy(account.getType());
    }

    /**
     * Persists an updated Account entity (balance change after transfer).
     *
     * @param account the modified account
     * @return the saved entity
     */
    public Account saveAccount(Account account) {
        return accountRepo.save(account);
    }

    // ── HELPERS ──────────────────────────────────────────────────────────────

    /** Freezes or unfreezes an account. A frozen account cannot send money but can still receive it. */
    @Transactional
    public AccountResponse setFrozen(Long id, boolean frozen) {
        Account account = accountRepo.findById(id)
                .orElseThrow(() -> new AccountNotFoundException(id));
        account.setFrozen(frozen);
        return toResponse(accountRepo.save(account));
    }

    private AccountResponse toResponse(Account a) {
        String num = a.getAccountNumber();
        String masked = num.length() >= 4 ? num.substring(num.length() - 4) : num;

        return AccountResponse.builder()
                .id(a.getId())
                .accountNumber(num)
                .maskedNumber(masked)
                .type(a.getType())
                .category(a.getCategory())
                .balance(a.getBalance())
                .creditLimit(a.getCreditLimit())
                .availableCredit(a.getAvailableCredit())
                .userId(a.getUser() != null ? a.getUser().getId() : null)
                .userName(a.getUser() != null ? a.getUser().getName() : null)
                .createdAt(a.getCreatedAt())
                .frozen(a.isFrozen())
                .build();
    }
}
