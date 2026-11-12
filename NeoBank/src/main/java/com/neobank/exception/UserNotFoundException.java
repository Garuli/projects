package com.neobank.exception;

/**
 * [R10] Thrown when a user lookup by ID or email returns no result.
 * Unchecked — mapped to HTTP 404 by GlobalExceptionHandler.
 */
public class UserNotFoundException extends RuntimeException {

    public UserNotFoundException(Long id) {
        super("User not found with id: " + id);
    }

    public UserNotFoundException(String email) {
        super("User not found with email: " + email);
    }
}
