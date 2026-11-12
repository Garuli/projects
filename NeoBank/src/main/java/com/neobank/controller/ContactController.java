package com.neobank.controller;

import com.neobank.model.dto.ApiResponse;
import com.neobank.model.dto.ContactRequest;
import com.neobank.model.dto.ContactResponse;
import com.neobank.security.AccessGuard;
import com.neobank.service.ContactService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/contacts")
@RequiredArgsConstructor
@Tag(name = "Contacts", description = "Saved recipients for quick transfers")
public class ContactController {

    private final ContactService contactService;
    private final AccessGuard guard;

    @GetMapping
    @Operation(summary = "List your saved contacts")
    public ResponseEntity<ApiResponse<List<ContactResponse>>> list() {
        return ResponseEntity.ok(ApiResponse.success(contactService.list(guard.currentUserId())));
    }

    @PostMapping
    @Operation(summary = "Save a contact (a name for someone else's account number)")
    public ResponseEntity<ApiResponse<ContactResponse>> add(@Valid @RequestBody ContactRequest request) {
        ContactResponse saved = contactService.add(guard.currentUserId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(saved, "Contact saved"));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete one of your contacts")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        contactService.delete(guard.currentUserId(), id);
        return ResponseEntity.ok(ApiResponse.success(null, "Contact deleted"));
    }
}
