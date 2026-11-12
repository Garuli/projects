package com.neobank.controller;

import com.neobank.security.AccessGuard;
import com.neobank.model.dto.ApiResponse;
import com.neobank.model.dto.DeletionRequestResponse;
import com.neobank.service.DeletionRequestService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/accounts")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Accounts", description = "Bank account management endpoints")
public class DeletionRequestController {

    private final DeletionRequestService deletionService;
    private final AccessGuard guard;

    @PostMapping("/{id}/deletion-request")
    @Operation(summary = "Request account deletion (balance must be zero)")
    public ResponseEntity<ApiResponse<DeletionRequestResponse>> requestDeletion(@PathVariable Long id) {
        guard.requireAccountOwner(id);
        log.info("POST /api/accounts/{}/deletion-request", id);
        DeletionRequestResponse result = deletionService.requestDeletion(id);
        return ResponseEntity.ok(ApiResponse.success(result, result.getMessage()));
    }

    @GetMapping("/{id}/deletion-request")
    @Operation(summary = "Get deletion request status for an account")
    public ResponseEntity<ApiResponse<DeletionRequestResponse>> getDeletionStatus(@PathVariable Long id) {
        guard.requireAccountOwner(id);
        DeletionRequestResponse result = deletionService.getStatus(id);
        return ResponseEntity.ok(ApiResponse.success(result, result.getMessage()));
    }
}
