package com.neobank.model.dto;

import com.neobank.model.entity.Account.AccountType;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/** [R8] Request body for POST /api/accounts. */
@Data
public class CreateAccountRequest {

    @NotNull(message = "User ID is required")
    private Long userId;

    @NotNull(message = "Account type is required")
    private AccountType type;

    @DecimalMin(value = "0.00", inclusive = true, message = "Initial deposit cannot be negative")
    private java.math.BigDecimal initialDeposit;

    /** Required for CREDIT accounts; ignored for DEBIT. */
    @DecimalMin(value = "0.01", message = "Credit limit must be positive")
    private java.math.BigDecimal creditLimit;
}
