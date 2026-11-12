package com.neobank.exception;

/**
 * [R10] Thrown when an attempt is made to create an account with a number
 * that already exists in the system.
 * Unchecked — mapped to HTTP 409 Conflict by GlobalExceptionHandler.
 */
public class DuplicateAccountException extends RuntimeException {

    public DuplicateAccountException(String accountNumber) {
        super("An account with number '" + accountNumber + "' already exists.");
    }
}
