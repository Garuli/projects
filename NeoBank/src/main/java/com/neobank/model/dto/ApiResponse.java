package com.neobank.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * [R2] Generic wrapper for all REST API responses.
 *
 * Using a generic class <T> ensures every endpoint returns a uniform envelope:
 *   { "success": true, "message": "...", "data": <T> }
 *
 * Type parameter T is unbounded here because responses can be any payload —
 * a User, a List<Transaction>, a Map<String,Object>, or null on errors.
 * Callers supply the concrete type, so the compiler enforces correctness.
 *
 * Example usage:
 *   ApiResponse<User>              for a single user response
 *   ApiResponse<List<Account>>     for a list response
 *   ApiResponse<Void>              for error/no-content responses
 *   ApiResponse<Map<String,String>> for field-level validation errors
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApiResponse<T> {

    /** True when the request completed without business or validation errors. */
    private boolean success;

    /** Human-readable description of the outcome. */
    private String message;

    /** The actual response payload; null on errors. */
    private T data;

    // ── Static factory helpers (keep controllers concise) ────────────────────

    /**
     * Creates a successful response with a payload and custom message.
     *
     * @param data    the response payload
     * @param message descriptive success message
     * @param <T>     payload type
     * @return wrapped success response
     */
    public static <T> ApiResponse<T> success(T data, String message) {
        return ApiResponse.<T>builder()
                .success(true)
                .message(message)
                .data(data)
                .build();
    }

    /**
     * Creates a successful response with a payload and default "Success" message.
     *
     * @param data the response payload
     * @param <T>  payload type
     * @return wrapped success response
     */
    public static <T> ApiResponse<T> success(T data) {
        return success(data, "Success");
    }

    /**
     * Creates a failure response with an error message and no payload.
     *
     * @param message the error description
     * @return wrapped error response (success=false, data=null)
     */
    public static <T> ApiResponse<T> error(String message) {
        return ApiResponse.<T>builder()
                .success(false)
                .message(message)
                .data(null)
                .build();
    }
}
