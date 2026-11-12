package com.neobank.exception;

import com.neobank.model.dto.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

/**
 * [R10] Centralised exception handler for all REST controllers.
 *
 * Every public exception type is caught here and converted into a structured
 * ApiResponse<Void> with the appropriate HTTP status code.  No empty catch
 * blocks — each handler logs at the correct level and builds an error response.
 *
 * HTTP mapping:
 *   UserNotFoundException / AccountNotFoundException → 404 Not Found
 *   DuplicateAccountException                        → 409 Conflict
 *   InsufficientFundsException                       → 422 Unprocessable Entity
 *   TransferLimitExceededException                   → 422 Unprocessable Entity
 *   MethodArgumentNotValidException (@Valid failures) → 400 Bad Request
 *   Uncaught RuntimeException                        → 500 Internal Server Error
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    // ── 404 Not Found ────────────────────────────────────────────────────────

    @ExceptionHandler(UserNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleUserNotFound(UserNotFoundException ex) {
        log.warn("User lookup failed: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error(ex.getMessage()));
    }

    @ExceptionHandler(AccountNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccountNotFound(AccountNotFoundException ex) {
        log.warn("Account lookup failed: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error(ex.getMessage()));
    }

    // ── 409 Conflict ─────────────────────────────────────────────────────────

    @ExceptionHandler(DuplicateAccountException.class)
    public ResponseEntity<ApiResponse<Void>> handleDuplicateAccount(DuplicateAccountException ex) {
        log.warn("Duplicate account attempt: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.CONFLICT)
                .body(ApiResponse.error(ex.getMessage()));
    }

    // ── 400 Bad Request (business rule violations) ────────────────────────────

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalState(IllegalStateException ex) {
        log.warn("Business rule violation: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(ex.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalArgument(IllegalArgumentException ex) {
        log.warn("Illegal argument: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(ex.getMessage()));
    }

    // ── 422 Unprocessable Entity ──────────────────────────────────────────────

    @ExceptionHandler(InsufficientFundsException.class)
    public ResponseEntity<ApiResponse<Void>> handleInsufficientFunds(InsufficientFundsException ex) {
        log.warn("Insufficient funds: account={}, requested={}, available={}",
                ex.getAccountNumber(), ex.getRequested(), ex.getAvailable());
        return ResponseEntity
                .status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(ApiResponse.error(ex.getMessage()));
    }

    @ExceptionHandler(TransferLimitExceededException.class)
    public ResponseEntity<ApiResponse<Void>> handleTransferLimit(TransferLimitExceededException ex) {
        log.warn("Transfer limit exceeded: requested={}, limit={}",
                ex.getRequested(), ex.getLimit());
        return ResponseEntity
                .status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(ApiResponse.error(ex.getMessage()));
    }

    // ── 400 Bad Request (Bean Validation failures) ────────────────────────────

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Map<String, String>>> handleValidation(
            MethodArgumentNotValidException ex) {

        Map<String, String> fieldErrors = new HashMap<>();
        for (FieldError fe : ex.getBindingResult().getFieldErrors()) {
            fieldErrors.put(fe.getField(), fe.getDefaultMessage());
        }
        log.warn("Validation failed: {}", fieldErrors);
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.<Map<String, String>>builder()
                        .success(false)
                        .message("Validation failed")
                        .data(fieldErrors)
                        .build());
    }

    // ── 403 Forbidden ─────────────────────────────────────────────────────────

    @ExceptionHandler(org.springframework.security.access.AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccessDenied(
            org.springframework.security.access.AccessDeniedException ex) {
        log.warn("Access denied: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error(ex.getMessage()));
    }

    // ── 500 Internal Server Error (catch-all) ─────────────────────────────────

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGeneric(Exception ex) {
        log.error("Unhandled exception: {}", ex.getMessage(), ex);
        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("An unexpected error occurred. Please try again later."));
    }
}
