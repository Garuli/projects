package com.neobank.model.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ContactRequest {

    @NotBlank(message = "Name is required")
    @Size(max = 60, message = "Name must not exceed 60 characters")
    private String name;

    @NotBlank(message = "Account number is required")
    @Size(max = 20, message = "Account number is too long")
    private String accountNumber;
}
