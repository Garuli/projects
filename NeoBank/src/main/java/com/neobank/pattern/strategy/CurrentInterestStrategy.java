package com.neobank.pattern.strategy;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * [R9] Strategy implementation for CURRENT (checking) accounts.
 *
 * Annual interest rate: 1.0 % (lower; current accounts prioritise liquidity)
 * Overdraft limit: -$500 (account may go $500 below zero)
 * Transfer limit: $25,000 per transaction
 *
 * @see InterestCalculationStrategy
 */
@Component
public class CurrentInterestStrategy implements InterestCalculationStrategy {

    private static final BigDecimal ANNUAL_RATE    = new BigDecimal("0.010");
    private static final BigDecimal MONTHS_IN_YEAR = new BigDecimal("12");
    private static final BigDecimal OVERDRAFT_FLOOR = new BigDecimal("-500.00");
    private static final BigDecimal TRANSFER_LIMIT  = new BigDecimal("25000.00");

    /**
     * Monthly interest = balance × (annualRate / 12).
     * Interest is only positive when balance > 0; overdraft balances earn nothing.
     *
     * @param balance current account balance (may be negative within overdraft)
     * @return monthly interest; zero if balance is negative
     */
    @Override
    public BigDecimal calculateInterest(BigDecimal balance) {
        if (balance.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        BigDecimal monthlyRate = ANNUAL_RATE.divide(MONTHS_IN_YEAR, 10, RoundingMode.HALF_UP);
        return balance.multiply(monthlyRate).setScale(2, RoundingMode.HALF_UP);
    }

    /** CURRENT accounts allow up to $500 overdraft. */
    @Override
    public BigDecimal getOverdraftLimit() {
        return OVERDRAFT_FLOOR;
    }

    /** Maximum single-transfer amount for CURRENT: $25,000. */
    @Override
    public BigDecimal getTransferLimit() {
        return TRANSFER_LIMIT;
    }
}
