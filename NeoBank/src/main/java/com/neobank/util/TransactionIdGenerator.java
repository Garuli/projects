package com.neobank.util;

import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicLong;

/**
 * [R5] Thread-safe transaction ID generator using AtomicLong.
 *
 * AtomicLong provides lock-free, atomic increment operations backed by
 * CAS (Compare-And-Swap) CPU instructions — no synchronized block needed.
 * This is safer and faster than a plain long++ under concurrent transfers
 * because multiple threads cannot read the same "next" value simultaneously.
 *
 * Alternative considered: synchronized long counter — rejected because
 * AtomicLong is designed exactly for this use case and avoids lock contention.
 */
@Component
public class TransactionIdGenerator {

    // [R5] AtomicLong guarantees visibility and atomicity across threads
    private final AtomicLong counter = new AtomicLong(1_000_000L);

    /**
     * Returns the next unique transaction reference number.
     * Thread-safe: AtomicLong.incrementAndGet() is an atomic CAS operation.
     *
     * @return a unique, monotonically increasing long value
     */
    public long next() {
        return counter.incrementAndGet();
    }

    /**
     * Formats the next id as a human-readable reference string.
     * Example: "TXN-1000001"
     *
     * @return formatted transaction reference string
     */
    public String nextReference() {
        return "TXN-" + counter.incrementAndGet();
    }
}
