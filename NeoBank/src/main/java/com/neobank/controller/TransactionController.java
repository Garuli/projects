package com.neobank.controller;

import com.neobank.security.AccessGuard;
import com.neobank.model.dto.ApiResponse;
import com.neobank.model.dto.TransactionResponse;
import com.neobank.model.dto.TransferRequest;
import com.neobank.service.TransactionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

/**
 * [R8] REST controller for transfers and transaction history.
 */
@RestController
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Transactions", description = "Transfer money and view transaction history")
public class TransactionController {

    private final TransactionService txService;
    private final AccessGuard guard;

    /**
     * Executes a money transfer between two accounts.
     *
     * [R8] POST /api/transfer with @Valid Bean Validation.
     * Returns HTTP 200 (not 201) because a transfer is an action, not a resource creation;
     * both debit and credit records are returned in the response data.
     *
     * @param request validated transfer payload
     * @return ApiResponse<List<TransactionResponse>> containing both legs of the transfer
     */
    @PostMapping("/api/transfer")
    @Operation(summary = "Transfer funds between two accounts")
    public ResponseEntity<ApiResponse<List<TransactionResponse>>> transfer(
            @Valid @RequestBody TransferRequest request) {
        log.info("POST /api/transfer from={} to={} amount={}",
                request.getFromAccountNumber(), request.getToAccountNumber(), request.getAmount());
        guard.requireAccountNumberOwner(request.getFromAccountNumber());
        List<TransactionResponse> result = txService.transfer(request);
        return ResponseEntity.ok(ApiResponse.success(result, "Transfer completed successfully"));
    }

    /**
     * Returns transaction history for an account, optionally filtered by date range.
     *
     * [R8] GET /api/transactions?accountId=1&from=2025-01-01T00:00:00&to=2025-12-31T23:59:59
     * Both date params are optional; if omitted, the full history is returned.
     *
     * @param accountId the account primary key
     * @param from      optional range start (ISO_LOCAL_DATE_TIME format)
     * @param to        optional range end (ISO_LOCAL_DATE_TIME format)
     * @return ApiResponse<List<TransactionResponse>> sorted chronologically
     */
    @GetMapping("/api/transactions/user/{userId}")
    @Operation(summary = "Get all transactions for all accounts of a user (newest first)")
    public ResponseEntity<ApiResponse<List<TransactionResponse>>> getUserTransactions(
            @PathVariable Long userId) {
        guard.requireSelf(userId);
        List<TransactionResponse> txns = txService.getUserTransactions(userId);
        return ResponseEntity.ok(ApiResponse.success(txns,
                "Retrieved " + txns.size() + " transactions"));
    }

    @GetMapping("/api/transactions")
    @Operation(summary = "Get transaction history for an account (optionally filtered by date range)")
    public ResponseEntity<ApiResponse<List<TransactionResponse>>> getTransactions(
            @RequestParam Long accountId,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to) {

        guard.requireAccountOwner(accountId);
        List<TransactionResponse> txns = txService.getTransactionHistory(accountId, from, to);
        return ResponseEntity.ok(ApiResponse.success(txns,
                "Retrieved " + txns.size() + " transactions"));
    }
}
