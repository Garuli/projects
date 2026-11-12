package com.neobank.controller;

import com.neobank.security.AccessGuard;
import com.neobank.model.dto.ApiResponse;
import com.neobank.model.dto.SummaryReport;
import com.neobank.service.ReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * [R8] REST controller for the analytics / reporting module.
 * GET /api/reports/summary — returns bank-wide aggregate statistics.
 */
@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Reports", description = "Bank analytics and summary reports")
public class ReportController {

    private final ReportService reportService;
    private final AccessGuard guard;

    /**
     * Returns a bank-wide summary including totals, averages, and top transactions.
     *
     * [R4] The underlying ReportService uses Stream filter/map/reduce/collect.
     * [R6] Internally also invokes the raw JDBC repository for cross-validation.
     *
     * @return ApiResponse<SummaryReport> with 200 status
     */
    @GetMapping("/summary")
    @Operation(summary = "Generate a bank-wide summary report")
    public ResponseEntity<ApiResponse<SummaryReport>> getSummary() {
        log.info("GET /api/reports/summary");
        SummaryReport report = reportService.generateSummary();
        return ResponseEntity.ok(ApiResponse.success(report, "Summary report generated"));
    }

    @GetMapping("/user/{userId}")
    @Operation(summary = "Generate a summary report for a specific user")
    public ResponseEntity<ApiResponse<SummaryReport>> getUserSummary(@PathVariable Long userId) {
        guard.requireSelf(userId);
        log.info("GET /api/reports/user/{}", userId);
        SummaryReport report = reportService.generateUserSummary(userId);
        return ResponseEntity.ok(ApiResponse.success(report, "User summary generated"));
    }
}
