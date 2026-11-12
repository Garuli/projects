package com.neobank.pattern.strategy;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Component
public class CheckingInterestStrategy implements InterestCalculationStrategy {

    private static final BigDecimal ANNUAL_RATE     = new BigDecimal("0.005");
    private static final BigDecimal MONTHS_IN_YEAR  = new BigDecimal("12");
    private static final BigDecimal OVERDRAFT_FLOOR = new BigDecimal("-250.00");
    private static final BigDecimal TRANSFER_LIMIT  = new BigDecimal("15000.00");

    @Override
    public BigDecimal calculateInterest(BigDecimal balance) {
        return balance.multiply(ANNUAL_RATE.divide(MONTHS_IN_YEAR, 10, RoundingMode.HALF_UP))
                .setScale(2, RoundingMode.HALF_UP);
    }

    @Override
    public BigDecimal getOverdraftLimit() { return OVERDRAFT_FLOOR; }

    @Override
    public BigDecimal getTransferLimit() { return TRANSFER_LIMIT; }
}
