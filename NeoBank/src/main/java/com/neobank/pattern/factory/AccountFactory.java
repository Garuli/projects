package com.neobank.pattern.factory;

import com.neobank.model.entity.Account;
import com.neobank.model.entity.Account.AccountType;
import com.neobank.model.entity.User;
import com.neobank.pattern.strategy.BusinessInterestStrategy;
import com.neobank.pattern.strategy.CheckingInterestStrategy;
import com.neobank.pattern.strategy.CurrentInterestStrategy;
import com.neobank.pattern.strategy.InterestCalculationStrategy;
import com.neobank.pattern.strategy.PremiumInterestStrategy;
import com.neobank.pattern.strategy.SavingsInterestStrategy;
import com.neobank.pattern.strategy.StudentInterestStrategy;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/*
 * ═══════════════════════════════════════════════════════════════════
 * DESIGN PATTERN: Factory (Static Factory Method variant)
 * ───────────────────────────────────────────────────────────────────
 * Intent:
 *   Centralise the creation of Account objects.  Clients ask the factory
 *   for "a SAVINGS account" and receive a fully initialised Account entity
 *   with the correct strategy wired in — no construction details leak out.
 *
 * Why chosen here:
 *   Account creation is non-trivial: each type needs a different Strategy
 *   instance, a generated account number, and a validated initial balance.
 *   Scattering this logic across controllers or services would duplicate
 *   knowledge and make adding a new type risky.  The Factory pattern puts
 *   all creation knowledge in one place.
 *
 * Problem it solves:
 *   Decouples "what kind of account to create" (the AccountType enum value
 *   from the request) from "how to create it" (entity construction + strategy
 *   selection).  AccountService just calls AccountFactory.create(type, ...).
 * ═══════════════════════════════════════════════════════════════════
 */

/**
 * [R9] Factory for creating Account entities with type-appropriate strategy.
 *
 * Also bridges the Factory and Strategy patterns: for every account type
 * it returns the matching InterestCalculationStrategy so the service layer
 * can apply the correct interest and overdraft rules.
 */
@Component
@RequiredArgsConstructor
public class AccountFactory {

    private final SavingsInterestStrategy  savingsStrategy;
    private final CurrentInterestStrategy  currentStrategy;
    private final BusinessInterestStrategy businessStrategy;
    private final StudentInterestStrategy  studentStrategy;
    private final CheckingInterestStrategy checkingStrategy;
    private final PremiumInterestStrategy  premiumStrategy;

    /**
     * [R9 - Factory Pattern] Creates an Account entity pre-configured for the requested type.
     * Account type determines initialization behaviour:
     *   DEBIT/SAVINGS/CHECKING → balance=0, creditLimit=null, availableCredit=null
     *   CREDIT (STUDENT/PREMIUM) → balance=0 (amount owed), creditLimit=limit, availableCredit=limit (full credit at opening)
     *   BUSINESS → balance=seedCapital, creditLimit=null, availableCredit=null
     *
     * @param type            the desired account type
     * @param owner           the User who will own this account
     * @param accountNumber   the pre-generated unique account number
     * @param balance         opening balance (0 for debit/credit, seed capital for business)
     * @param creditLimit     approved credit limit — non-null only for CREDIT accounts
     * @param availableCredit initially equals creditLimit — non-null only for CREDIT accounts
     * @return a new, unsaved Account entity ready for JPA persistence
     */
    public Account create(AccountType type, User owner, String accountNumber,
                          BigDecimal balance, BigDecimal creditLimit, BigDecimal availableCredit) {
        return Account.builder()
                .type(type)
                .user(owner)
                .accountNumber(accountNumber)
                .balance(balance)
                .creditLimit(creditLimit)
                .availableCredit(availableCredit)
                .build();
    }

    /**
     * Returns the InterestCalculationStrategy for the given account type.
     * Called by AccountService when applying monthly interest or validating transfers.
     *
     * @param type the account type
     * @return the corresponding Strategy implementation
     */
    public InterestCalculationStrategy getStrategy(AccountType type) {
        return switch (type) {
            case SAVINGS  -> savingsStrategy;
            case CURRENT  -> currentStrategy;
            case BUSINESS -> businessStrategy;
            case STUDENT  -> studentStrategy;
            case CHECKING -> checkingStrategy;
            case PREMIUM  -> premiumStrategy;
        };
    }
}
