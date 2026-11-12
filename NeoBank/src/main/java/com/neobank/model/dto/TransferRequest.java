package com.neobank.model.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

/** [R8] Request body for POST /api/transfer. */
@Data
public class TransferRequest {

    @NotBlank(message = "Source account number is required")
    private String fromAccountNumber;

    @NotBlank(message = "Destination account number is required")
    private String toAccountNumber;

    @NotNull(message = "Amount is required")
    @DecimalMin(value = "0.01", message = "Transfer amount must be at least 0.01")
    private BigDecimal amount;

    @Size(max = 255, message = "Description must not exceed 255 characters")
    private String description;
}
