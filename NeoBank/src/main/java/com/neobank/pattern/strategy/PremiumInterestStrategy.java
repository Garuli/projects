package com.neobank.pattern.strategy;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Component
public class PremiumInterestStrategy implements InterestCalculationStrategy {

    private static final BigDecimal ANNUAL_RATE    = new BigDecimal("0.045");
    private static final BigDecimal MONTHS_IN_YEAR = new BigDecimal("12");
    private static final BigDecimal NO_OVERDRAFT   = BigDecimal.ZERO;
    private static final BigDecimal TRANSFER_LIMIT = new BigDecimal("500000.00");

    @Override
    public BigDecimal calculateInterest(BigDecimal balance) {
        return balance.multiply(ANNUAL_RATE.divide(MONTHS_IN_YEAR, 10, RoundingMode.HALF_UP))
                .setScale(2, RoundingMode.HALF_UP);
    }

    @Override
    public BigDecimal getOverdraftLimit() { return NO_OVERDRAFT; }

    @Override
    public BigDecimal getTransferLimit() { return TRANSFER_LIMIT; }
}
