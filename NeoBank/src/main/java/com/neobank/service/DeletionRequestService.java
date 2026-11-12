package com.neobank.service;

import com.neobank.exception.AccountNotFoundException;
import com.neobank.model.dto.DeletionRequestResponse;
import com.neobank.model.entity.Account;
import com.neobank.model.entity.DeletionRequest;
import com.neobank.model.entity.DeletionRequest.DeletionStatus;
import com.neobank.repository.AccountJpaRepository;
import com.neobank.repository.DeletionRequestRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class DeletionRequestService {

    private final DeletionRequestRepository requestRepo;
    private final AccountJpaRepository accountRepo;

    @Transactional
    public DeletionRequestResponse requestDeletion(Long accountId) {
        Account account = accountRepo.findById(accountId)
                .orElseThrow(() -> new AccountNotFoundException(accountId));

        if (account.getBalance().compareTo(BigDecimal.ZERO) != 0) {
            throw new IllegalStateException(
                    "Account must have zero balance before requesting deletion. " +
                    "Current balance: $" + account.getBalance());
        }

        if (requestRepo.existsByAccountIdAndStatus(accountId, DeletionStatus.PENDING)) {
            throw new IllegalStateException("A deletion request is already pending for this account.");
        }

        DeletionRequest req = DeletionRequest.builder()
                .account(account)
                .status(DeletionStatus.PENDING)
                .requestedAt(LocalDateTime.now())
                .build();

        DeletionRequest saved = requestRepo.save(req);
        log.info("Deletion request {} created for account {}", saved.getId(), account.getAccountNumber());

        return toResponse(saved, "Your request has been received. Staff will review within 5 minutes.");
    }

    @Transactional(readOnly = true)
    public DeletionRequestResponse getStatus(Long accountId) {
        return requestRepo.findByAccountIdAndStatus(accountId, DeletionStatus.PENDING)
                .map(r -> toResponse(r, "Request is pending review."))
                .orElseGet(() -> requestRepo.findByAccountIdAndStatus(accountId, DeletionStatus.COMPLETED)
                        .map(r -> toResponse(r, "Account has been deleted."))
                        .orElseThrow(() -> new IllegalStateException("No deletion request found for this account.")));
    }

    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void processPendingRequests() {
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(5);
        List<DeletionRequest> pending = requestRepo.findByStatusAndRequestedAtBefore(DeletionStatus.PENDING, cutoff);

        for (DeletionRequest req : pending) {
            Account account = req.getAccount();
            if (account.getBalance().compareTo(BigDecimal.ZERO) == 0) {
                accountRepo.delete(account);
                req.setStatus(DeletionStatus.COMPLETED);
                req.setProcessedAt(LocalDateTime.now());
                requestRepo.save(req);
                log.info("Auto-deleted account {} via deletion request {}", account.getAccountNumber(), req.getId());
            } else {
                req.setStatus(DeletionStatus.REJECTED);
                req.setProcessedAt(LocalDateTime.now());
                requestRepo.save(req);
                log.warn("Rejected deletion for account {} — balance is not zero", account.getAccountNumber());
            }
        }
    }

    private DeletionRequestResponse toResponse(DeletionRequest req, String message) {
        return DeletionRequestResponse.builder()
                .requestId(req.getId())
                .accountNumber(req.getAccount().getAccountNumber())
                .status(req.getStatus().name())
                .requestedAt(req.getRequestedAt())
                .processedAt(req.getProcessedAt())
                .message(message)
                .build();
    }
}
