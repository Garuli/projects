package com.neobank.pattern.strategy;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * [R9] Strategy implementation for BUSINESS accounts.
 *
 * Annual interest rate: 2.0 % (competitive mid-tier)
 * Overdraft limit: 0.00 (no overdraft; business accounts require positive balance)
 * Transfer limit: $100,000 per transaction (high-value business payments)
 *
 * Tiered calculation:
 *   Balance ≤ $50,000   → base rate 2.0 %
 *   Balance > $50,000   → premium rate 2.5 % on the entire balance
 *
 * @see InterestCalculationStrategy
 */
@Component
public class BusinessInterestStrategy implements InterestCalculationStrategy {

    private static final BigDecimal BASE_ANNUAL_RATE    = new BigDecimal("0.020");
    private static final BigDecimal PREMIUM_ANNUAL_RATE = new BigDecimal("0.025");
    private static final BigDecimal TIER_THRESHOLD      = new BigDecimal("50000.00");
    private static final BigDecimal MONTHS_IN_YEAR      = new BigDecimal("12");
    private static final BigDecimal NO_OVERDRAFT        = BigDecimal.ZERO;
    private static final BigDecimal TRANSFER_LIMIT      = new BigDecimal("100000.00");

    /**
     * Tiered monthly interest — premium rate kicks in above $50,000.
     *
     * @param balance current account balance
     * @return monthly interest amount rounded to 2 dp
     */
    @Override
    public BigDecimal calculateInterest(BigDecimal balance) {
        if (balance.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        BigDecimal rate = balance.compareTo(TIER_THRESHOLD) > 0
                ? PREMIUM_ANNUAL_RATE
                : BASE_ANNUAL_RATE;
        BigDecimal monthlyRate = rate.divide(MONTHS_IN_YEAR, 10, RoundingMode.HALF_UP);
        return balance.multiply(monthlyRate).setScale(2, RoundingMode.HALF_UP);
    }

    /** BUSINESS accounts have no overdraft facility. */
    @Override
    public BigDecimal getOverdraftLimit() {
        return NO_OVERDRAFT;
    }

    /** Maximum single-transfer amount for BUSINESS: $100,000. */
    @Override
    public BigDecimal getTransferLimit() {
        return TRANSFER_LIMIT;
    }
}
