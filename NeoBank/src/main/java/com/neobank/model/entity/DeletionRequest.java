package com.neobank.model.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "deletion_requests")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeletionRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DeletionStatus status;

    @Column(nullable = false)
    private LocalDateTime requestedAt;

    private LocalDateTime processedAt;

    public enum DeletionStatus {
        PENDING, COMPLETED, REJECTED
    }
}
