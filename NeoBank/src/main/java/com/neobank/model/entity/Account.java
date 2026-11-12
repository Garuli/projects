package com.neobank.model.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * JPA entity representing a bank account belonging to a User.
 *
 * [R7] @ManyToOne back-reference to User; @OneToMany to Transaction.
 * All monetary values use BigDecimal — never double/float — to guarantee
 * exact decimal arithmetic required by financial calculations (R6 note).
 */
@Entity
@Table(name = "accounts",
        uniqueConstraints = @UniqueConstraint(name = "uk_accounts_number", columnNames = "account_number"))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Account {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Human-readable unique account identifier (e.g. NEO-100001). */
    @NotBlank
    @Column(name = "account_number", nullable = false, unique = true, length = 20)
    private String accountNumber;

    /**
     * Discriminator for the account type, used by AccountFactory (R9).
     * Stored as a String enum: SAVINGS | CURRENT | BUSINESS.
     */
    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AccountType type;

    /**
     * Current ledger balance. BigDecimal with 2 decimal scale.
     * Monetary invariant: balance must never go below the overdraft limit
     * enforced by the service layer, not here at the DB level.
     */
    @NotNull
    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal balance;

    /**
     * [R7] @ManyToOne — many accounts belong to one user.
     * LAZY fetch: user data loaded only when explicitly accessed.
     */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_accounts_user"))
    private User user;

    /**
     * [R7] @OneToMany — one account has many transactions.
     *
     * [R1] ArrayList chosen because transaction history is append-only
     * and we need O(1) indexed access for slicing in reports.
     */
    @OneToMany(mappedBy = "account", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval = true)
    @Builder.Default
    private List<Transaction> transactions = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    /** Broad category: DEBIT = bank account, CREDIT = credit line/card. */
    @Enumerated(EnumType.STRING)
    @Column(name = "account_category", length = 10)
    private AccountCategory category;

    /** Approved credit limit — only set for CREDIT accounts, null for DEBIT. */
    @Column(name = "credit_limit", precision = 19, scale = 2)
    private BigDecimal creditLimit;

    /** Available credit remaining — only set for CREDIT accounts, decreases as credit is used. */
    @Column(name = "available_credit", precision = 19, scale = 2)
    private BigDecimal availableCredit;

    /** Supported account categories, each with distinct interest/overdraft rules (R9). */
    /** True when the owner froze the account. Nullable so rows created before this column existed stay valid. */
    @Column(name = "frozen")
    private Boolean frozen;

    public boolean isFrozen() {
        return Boolean.TRUE.equals(frozen);
    }

    public enum AccountType {
        SAVINGS, CURRENT, BUSINESS, STUDENT, CHECKING, PREMIUM
    }

    public enum AccountCategory { DEBIT, CREDIT }
}
