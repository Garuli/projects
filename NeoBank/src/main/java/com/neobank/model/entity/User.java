package com.neobank.model.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * JPA entity representing a bank customer.
 *
 * [R7] Mapped with @Entity and @OneToMany to Account.
 * CascadeType.ALL ensures accounts are persisted/removed with the user.
 * FetchType.LAZY avoids N+1 queries — accounts loaded only when accessed.
 */
@Entity
@Table(name = "users",
        uniqueConstraints = @UniqueConstraint(name = "uk_users_email", columnNames = "email"))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {

    /** Surrogate primary key — auto-incremented by the database. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Column(nullable = false, length = 100)
    private String name;

    @Email
    @NotBlank
    @Column(nullable = false, unique = true, length = 150)
    private String email;

    @Column(length = 30)
    private String phone;

    @Column(length = 255)
    private String address;

    @Column(length = 255)
    private String password;

    @Column(name = "profile_picture", columnDefinition = "TEXT")
    private String profilePicture;

    /**
     * [R7] @OneToMany relationship: one user owns many accounts.
     * mappedBy = "user" tells JPA that Account.user owns the FK column.
     *
     * [R1] Using ArrayList here because we need indexed access and
     * ordered iteration over accounts; insertion order matters for display.
     */
    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval = true)
    @Builder.Default
    private List<Account> accounts = new ArrayList<>();

    /** Automatically set to the current timestamp on insert. */
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
