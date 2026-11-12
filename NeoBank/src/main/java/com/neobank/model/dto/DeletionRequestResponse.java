package com.neobank.model.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class DeletionRequestResponse {
    private Long requestId;
    private String accountNumber;
    private String status;
    private LocalDateTime requestedAt;
    private LocalDateTime processedAt;
    private String message;
}
