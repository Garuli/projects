package com.neobank.exception;

/**
 * [R10] Thrown when an account lookup by ID or account number returns no result.
 * Unchecked — mapped to HTTP 404 by GlobalExceptionHandler.
 */
public class AccountNotFoundException extends RuntimeException {

    public AccountNotFoundException(Long id) {
        super("Account not found with id: " + id);
    }

    public AccountNotFoundException(String accountNumber) {
        super("Account not found with number: " + accountNumber);
    }
}
