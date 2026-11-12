package com.neobank.pattern.strategy;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * [R9] Strategy implementation for SAVINGS accounts.
 *
 * Annual interest rate: 3.5 %
 * Monthly rate applied: 3.5 / 12 = 0.2917 %
 * Overdraft limit: 0.00 (no overdraft allowed)
 * Transfer limit: $10,000 per transaction
 *
 * @see InterestCalculationStrategy
 */
@Component
public class SavingsInterestStrategy implements InterestCalculationStrategy {

    // [R3] BigDecimal constants — never float/double for monetary math
    private static final BigDecimal ANNUAL_RATE        = new BigDecimal("0.035");
    private static final BigDecimal MONTHS_IN_YEAR     = new BigDecimal("12");
    private static final BigDecimal NO_OVERDRAFT       = BigDecimal.ZERO;
    private static final BigDecimal TRANSFER_LIMIT     = new BigDecimal("10000.00");

    /**
     * Monthly interest = balance × (annualRate / 12), rounded to 2 dp (HALF_UP).
     *
     * @param balance current account balance
     * @return monthly interest amount
     */
    @Override
    public BigDecimal calculateInterest(BigDecimal balance) {
        BigDecimal monthlyRate = ANNUAL_RATE.divide(MONTHS_IN_YEAR, 10, RoundingMode.HALF_UP);
        return balance.multiply(monthlyRate).setScale(2, RoundingMode.HALF_UP);
    }

    /** SAVINGS accounts cannot go below zero. */
    @Override
    public BigDecimal getOverdraftLimit() {
        return NO_OVERDRAFT;
    }

    /** Maximum single-transfer amount for SAVINGS: $10,000. */
    @Override
    public BigDecimal getTransferLimit() {
        return TRANSFER_LIMIT;
    }
}
