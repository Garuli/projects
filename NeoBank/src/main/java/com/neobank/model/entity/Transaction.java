package com.neobank.model.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * JPA entity representing a single ledger entry on an account.
 *
 * [R7] @ManyToOne back-reference to Account.
 * Implements Comparable<Transaction> so it can be stored in TreeSet (R1)
 * sorted chronologically; tie-break on id ensures uniqueness.
 */
@Entity
@Table(name = "transactions",
        indexes = {
            @Index(name = "idx_tx_account", columnList = "account_id"),
            @Index(name = "idx_tx_timestamp", columnList = "timestamp")
        })
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Transaction implements Comparable<Transaction> {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * [R7] @ManyToOne — each transaction belongs to exactly one account.
     * LAZY: account data loaded only when needed, prevents join on every query.
     */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_transactions_account"))
    private Account account;

    /** DEBIT reduces balance; CREDIT increases it. */
    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private TransactionType type;

    /** Transaction amount — always positive; direction encoded in type. */
    @NotNull
    @DecimalMin(value = "0.01")
    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal amount;

    /** Free-text memo describing the transaction. */
    @Column(length = 255)
    private String description;

    /** Account balance immediately after this transaction was applied. */
    @NotNull
    @Column(name = "balance_after", nullable = false, precision = 19, scale = 2)
    private BigDecimal balanceAfter;

    /** Moment the transaction was recorded; auto-set on insert. */
    @CreationTimestamp
    @Column(name = "timestamp", nullable = false, updatable = false)
    private LocalDateTime timestamp;

    /** Links both legs of a transfer (debit + credit share the same UUID ref). Null for non-transfers. */
    @Column(name = "transfer_ref", length = 36)
    private String transferRef;

    /** Account number of the other side of a transfer. Null for non-transfers. */
    @Column(name = "counterpart_account_number", length = 20)
    private String counterpartAccountNumber;

    /** Email of the user who owns the counterpart account. Null for non-transfers. */
    @Column(name = "counterpart_email", length = 150)
    private String counterpartEmail;

    /** Processing status — always COMPLETED for synchronous transfers. */
    @Column(name = "status", length = 20)
    @Builder.Default
    private String status = "COMPLETED";

    /**
     * [R1] Natural ordering for TreeSet: chronological, then by id to break ties.
     * TreeSet uses this to maintain sorted unique records without duplicates.
     */
    @Override
    public int compareTo(Transaction other) {
        int cmp = this.timestamp.compareTo(other.timestamp);
        return (cmp != 0) ? cmp : Long.compare(this.id, other.id);
    }

    /** Debit/Credit classification. */
    public enum TransactionType {
        DEBIT, CREDIT
    }
}
