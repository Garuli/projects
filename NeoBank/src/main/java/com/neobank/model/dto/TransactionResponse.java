package com.neobank.model.dto;

import com.neobank.model.entity.Transaction.TransactionType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Response DTO for a single Transaction record. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TransactionResponse {
    private Long id;
    private Long accountId;
    private String accountNumber;
    private String accountType;
    private TransactionType type;
    private BigDecimal amount;
    private String description;
    private BigDecimal balanceAfter;
    private LocalDateTime timestamp;
    private String transferRef;
    private String counterpartAccountNumber;
    private String counterpartEmail;
    private String status;
}
