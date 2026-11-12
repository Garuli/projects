package com.neobank.util;

import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicLong;

/**
 * [R5] Generates unique, human-readable account numbers using AtomicLong.
 *
 * Same thread-safety rationale as TransactionIdGenerator: concurrent account
 * creation requests must never receive the same account number, so we use an
 * atomic counter rather than a database sequence query or synchronized block.
 *
 * Format: "NEO-" followed by a 6-digit zero-padded number, e.g. "NEO-100001".
 */
@Component
public class AccountNumberGenerator {

    // [R5] AtomicLong — safe for concurrent account creation requests
    private final AtomicLong counter = new AtomicLong(100_000L);

    /**
     * Generates the next unique account number.
     *
     * @return formatted account number string e.g. "NEO-100001"
     */
    public String generate() {
        return String.format("NEO-%06d", counter.incrementAndGet());
    }
}
