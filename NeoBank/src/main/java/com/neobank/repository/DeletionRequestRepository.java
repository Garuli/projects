package com.neobank.repository;

import com.neobank.model.entity.DeletionRequest;
import com.neobank.model.entity.DeletionRequest.DeletionStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface DeletionRequestRepository extends JpaRepository<DeletionRequest, Long> {

    Optional<DeletionRequest> findByAccountIdAndStatus(Long accountId, DeletionStatus status);

    List<DeletionRequest> findByStatusAndRequestedAtBefore(DeletionStatus status, LocalDateTime cutoff);

    boolean existsByAccountIdAndStatus(Long accountId, DeletionStatus status);
}
