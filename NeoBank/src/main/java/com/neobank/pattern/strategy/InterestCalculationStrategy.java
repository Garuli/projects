package com.neobank.pattern.strategy;

import java.math.BigDecimal;

/*
 * ═══════════════════════════════════════════════════════════════════
 * DESIGN PATTERN: Strategy
 * ───────────────────────────────────────────────────────────────────
 * Intent:
 *   Define a family of algorithms (interest calculations), encapsulate
 *   each one in its own class, and make them interchangeable at runtime
 *   without changing the client (AccountService).
 *
 * Why chosen here:
 *   Each account type (SAVINGS, CURRENT, BUSINESS) has a distinct
 *   interest formula and overdraft rule.  Without this pattern we would
 *   need a large if/else or switch in AccountService that grows every
 *   time a new account type is added — violating the Open/Closed
 *   Principle.  The Strategy pattern isolates each formula in its own
 *   class, making them independently testable and extensible.
 *
 * Problem it solves:
 *   Avoids a bloated service method that knows about every account type.
 *   Adding a new type (e.g. STUDENT) only requires a new Strategy class
 *   and a line in AccountFactory — zero changes to existing code.
 * ═══════════════════════════════════════════════════════════════════
 */

/**
 * [R9] Strategy interface for interest calculation.
 *
 * Each account type implements this interface with its own formula.
 * AccountService holds a reference to the strategy selected by AccountFactory,
 * and calls calculateInterest() without knowing the concrete type.
 */
public interface InterestCalculationStrategy {

    /**
     * Calculates the interest accrued on the given balance for one month.
     *
     * @param balance the current account balance (never negative)
     * @return the interest amount to credit, rounded to 2 decimal places
     */
    BigDecimal calculateInterest(BigDecimal balance);

    /**
     * Returns the maximum overdraft limit permitted for this account type.
     * SAVINGS/BUSINESS: zero (no overdraft). CURRENT: configurable negative floor.
     *
     * @return the minimum allowed balance (zero or negative overdraft floor)
     */
    BigDecimal getOverdraftLimit();

    /**
     * Returns the maximum single-transaction transfer limit for this account type.
     *
     * @return per-transaction limit in the same currency as balances
     */
    BigDecimal getTransferLimit();
}
