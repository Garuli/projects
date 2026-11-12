package com.neobank.controller;

import com.neobank.security.AccessGuard;
import com.neobank.model.dto.ApiResponse;
import com.neobank.model.dto.ChangePasswordRequest;
import com.neobank.model.dto.CreateUserRequest;
import com.neobank.model.dto.UserResponse;
import com.neobank.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Users", description = "User management endpoints")
public class UserController {

    private final UserService userService;
    private final AccessGuard guard;

    @PostMapping
    @Operation(summary = "Create a new user")
    public ResponseEntity<ApiResponse<UserResponse>> createUser(
            @Valid @RequestBody CreateUserRequest request) {
        log.debug("POST /api/users email={}", request.getEmail());
        UserResponse created = userService.createUser(request);
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success(created, "User created successfully"));
    }

    @GetMapping
    @Operation(summary = "Get the logged-in user (as a list)")
    public ResponseEntity<ApiResponse<List<UserResponse>>> getAllUsers() {
        // Only the caller is returned, so other customers' details stay private.
        List<UserResponse> users = List.of(userService.getUserById(guard.currentUserId()));
        return ResponseEntity.ok(ApiResponse.success(users,
                "Retrieved " + users.size() + " users"));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a user by ID")
    public ResponseEntity<ApiResponse<UserResponse>> getUserById(@PathVariable Long id) {
        guard.requireSelf(id);
        UserResponse user = userService.getUserById(id);
        return ResponseEntity.ok(ApiResponse.success(user));
    }

    @PatchMapping("/{id}/profile-picture")
    @Operation(summary = "Update profile picture")
    public ResponseEntity<ApiResponse<UserResponse>> updateProfilePicture(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        guard.requireSelf(id);
        String pictureData = body.get("profilePicture");
        UserResponse updated = userService.updateProfilePicture(id, pictureData);
        return ResponseEntity.ok(ApiResponse.success(updated, "Profile picture updated"));
    }

    @PostMapping("/me/password")
    @Operation(summary = "Change your password")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @jakarta.validation.Valid @RequestBody ChangePasswordRequest request) {
        userService.changePassword(guard.currentUserId(), request.getCurrentPassword(), request.getNewPassword());
        return ResponseEntity.ok(ApiResponse.success(null, "Password changed"));
    }
}
