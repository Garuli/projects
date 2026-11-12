package com.neobank.exception;

import java.math.BigDecimal;

/**
 * [R10] Thrown when a single transfer amount exceeds the per-transaction
 * limit defined per account type (e.g. SAVINGS: $10,000, BUSINESS: $100,000).
 * Unchecked — mapped to HTTP 422 Unprocessable Entity by GlobalExceptionHandler.
 */
public class TransferLimitExceededException extends RuntimeException {

    private final BigDecimal requested;
    private final BigDecimal limit;

    public TransferLimitExceededException(BigDecimal requested, BigDecimal limit) {
        super(String.format(
                "Transfer amount %.2f exceeds the per-transaction limit of %.2f",
                requested, limit));
        this.requested = requested;
        this.limit = limit;
    }

    public BigDecimal getRequested() { return requested; }
    public BigDecimal getLimit()     { return limit; }
}
