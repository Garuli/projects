package com.neobank.controller;

import com.neobank.security.AccessGuard;
import com.neobank.model.dto.AccountResponse;
import com.neobank.model.dto.ApiResponse;
import com.neobank.model.dto.CreateAccountRequest;
import com.neobank.service.AccountService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

/**
 * [R8] REST controller for account management.
 * Pure routing and DTO marshalling — no business logic here.
 */
@RestController
@RequestMapping("/api/accounts")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Accounts", description = "Bank account management endpoints")
public class AccountController {

    private final AccountService accountService;
    private final AccessGuard guard;

    /**
     * Open a new account for an existing user.
     *
     * [R8] @Valid triggers Bean Validation; 201 returned on success.
     *
     * @param request validated account creation payload
     * @return ApiResponse<AccountResponse> with 201 status
     */
    @PostMapping
    @Operation(summary = "Open a new account")
    public ResponseEntity<ApiResponse<AccountResponse>> createAccount(
            @Valid @RequestBody CreateAccountRequest request) {
        guard.requireSelf(request.getUserId());
        log.debug("POST /api/accounts userId={} type={}", request.getUserId(), request.getType());
        AccountResponse account = accountService.createAccount(request);
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success(account, "Account opened successfully"));
    }

    /**
     * List all accounts, sorted by balance descending.
     *
     * @return ApiResponse<List<AccountResponse>> with 200 status
     */
    @GetMapping
    @Operation(summary = "List all accounts (sorted by balance, descending)")
    public ResponseEntity<ApiResponse<List<AccountResponse>>> getAllAccounts() {
        List<AccountResponse> accounts = accountService.getAllAccounts();
        return ResponseEntity.ok(ApiResponse.success(accounts,
                "Retrieved " + accounts.size() + " accounts"));
    }

    /**
     * Retrieve a single account by id.
     *
     * [R8] Returns 404 via GlobalExceptionHandler if account does not exist.
     *
     * @param id the account primary key
     * @return ApiResponse<AccountResponse> with 200 status
     */
    @GetMapping("/{id}")
    @Operation(summary = "Get account by ID")
    public ResponseEntity<ApiResponse<AccountResponse>> getAccountById(@PathVariable Long id) {
        guard.requireAccountOwner(id);
        AccountResponse account = accountService.getAccountById(id);
        return ResponseEntity.ok(ApiResponse.success(account));
    }

    /**
     * Returns the current balance for an account.
     *
     * @param id the account primary key
     * @return ApiResponse<BigDecimal> with the current balance
     */
    @GetMapping("/{id}/balance")
    @Operation(summary = "Get the current balance of an account")
    public ResponseEntity<ApiResponse<BigDecimal>> getBalance(@PathVariable Long id) {
        guard.requireAccountOwner(id);
        BigDecimal balance = accountService.getBalance(id);
        return ResponseEntity.ok(ApiResponse.success(balance, "Current balance"));
    }

    /**
     * Returns all accounts belonging to a specific user.
     *
     * @param userId the user's primary key
     * @return ApiResponse<List<AccountResponse>>
     */
    @GetMapping("/user/{userId}")
    @Operation(summary = "List all accounts for a specific user")
    public ResponseEntity<ApiResponse<List<AccountResponse>>> getAccountsByUser(
            @PathVariable Long userId) {
        guard.requireSelf(userId);
        List<AccountResponse> accounts = accountService.getAccountsByUser(userId);
        return ResponseEntity.ok(ApiResponse.success(accounts));
    }
}
