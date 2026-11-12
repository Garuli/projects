package com.neobank.model.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/** A saved recipient: a name the user chose for someone else's account number. */
@Entity
@Table(name = "contacts",
        uniqueConstraints = @UniqueConstraint(name = "uk_contacts_owner_account",
                columnNames = {"user_id", "account_number"}))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Contact {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User owner;

    @Column(nullable = false, length = 60)
    private String name;

    @Column(name = "account_number", nullable = false, length = 20)
    private String accountNumber;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
