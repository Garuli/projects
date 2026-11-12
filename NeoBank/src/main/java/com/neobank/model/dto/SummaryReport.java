package com.neobank.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/**
 * Aggregate summary DTO returned by GET /api/reports/summary.
 * [R4] Built from Stream API reduce/collect operations in ReportService.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SummaryReport {

    private long totalUsers;
    private long totalAccounts;
    private long totalTransactions;

    /** Sum of all account balances across the entire bank. */
    private BigDecimal totalBalanceAllAccounts;

    /** Average transaction amount across all accounts. */
    private BigDecimal averageTransactionAmount;

    /** Top 5 transactions by amount (descending). */
    private List<TransactionResponse> topTransactions;

    /** Total debited amount across all accounts. */
    private BigDecimal totalDebited;

    /** Total credited amount across all accounts. */
    private BigDecimal totalCredited;
}
