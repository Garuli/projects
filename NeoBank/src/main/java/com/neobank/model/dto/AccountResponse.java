package com.neobank.model.dto;

import com.neobank.model.entity.Account.AccountCategory;
import com.neobank.model.entity.Account.AccountType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Response DTO for Account — includes masked account number for display. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AccountResponse {
    private Long id;
    private String accountNumber;
    private String maskedNumber;
    private AccountType type;
    private AccountCategory category;
    private BigDecimal balance;
    private BigDecimal creditLimit;
    private BigDecimal availableCredit;
    private Long userId;
    private String userName;
    private LocalDateTime createdAt;
    private boolean frozen;
}
