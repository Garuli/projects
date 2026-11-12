package com.neobank.exception;

import java.math.BigDecimal;

/**
 * [R10] Thrown when a debit or transfer would bring an account balance
 * below its permitted minimum (0.00 for SAVINGS/BUSINESS, or overdraft
 * limit for CURRENT accounts).  Unchecked — callers are not forced to
 * handle it, but the GlobalExceptionHandler maps it to HTTP 422.
 */
public class InsufficientFundsException extends RuntimeException {

    private final String accountNumber;
    private final BigDecimal requested;
    private final BigDecimal available;

    public InsufficientFundsException(String accountNumber, BigDecimal requested, BigDecimal available) {
        super(String.format(
                "Account %s has insufficient funds: requested %.2f, available %.2f",
                accountNumber, requested, available));
        this.accountNumber = accountNumber;
        this.requested = requested;
        this.available = available;
    }

    public String getAccountNumber() { return accountNumber; }
    public BigDecimal getRequested()  { return requested; }
    public BigDecimal getAvailable()  { return available; }
}
