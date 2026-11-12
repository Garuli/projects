package com.neobank.controller;

import com.neobank.model.dto.ApiResponse;
import com.neobank.model.dto.AuthResponse;
import com.neobank.model.dto.LoginRequest;
import com.neobank.model.dto.RegisterRequest;
import com.neobank.model.entity.User;
import com.neobank.repository.UserJpaRepository;
import com.neobank.security.JwtUtil;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Auth", description = "Register and login")
public class AuthController {

    private final UserJpaRepository userRepo;
    private final BCryptPasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    @PostMapping("/login")
    @Operation(summary = "Login with email and password")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest req) {
        User user = userRepo.findByEmail(req.getEmail())
                .orElse(null);

        if (user == null || user.getPassword() == null
                || !passwordEncoder.matches(req.getPassword(), user.getPassword())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("Invalid email or password"));
        }

        String token = jwtUtil.generateToken(user.getId(), user.getEmail(), user.getName());
        AuthResponse body = AuthResponse.builder()
                .token(token)
                .userId(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .build();
        log.info("Login success for {}", user.getEmail());
        return ResponseEntity.ok(ApiResponse.success(body, "Login successful"));
    }

    @PostMapping("/register")
    @Operation(summary = "Register a new user account")
    public ResponseEntity<ApiResponse<AuthResponse>> register(@Valid @RequestBody RegisterRequest req) {
        if (userRepo.existsByEmail(req.getEmail())) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(ApiResponse.error("Email is already registered"));
        }

        User user = User.builder()
                .name(req.getName())
                .email(req.getEmail())
                .phone(req.getPhone())
                .address(req.getAddress())
                .password(passwordEncoder.encode(req.getPassword()))
                .build();

        User saved = userRepo.save(user);
        String token = jwtUtil.generateToken(saved.getId(), saved.getEmail(), saved.getName());
        AuthResponse body = AuthResponse.builder()
                .token(token)
                .userId(saved.getId())
                .name(saved.getName())
                .email(saved.getEmail())
                .build();
        log.info("Registered new user {}", saved.getEmail());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(body, "Registration successful"));
    }
}
