package com.neobank.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
@Slf4j
public class JwtUtil {

    @Value("${neobank.jwt.secret:}")
    private String secret;

    @Value("${neobank.jwt.expiration:86400000}")
    private long expirationMs;

    /**
     * The signing secret comes from the NEOBANK_JWT_SECRET environment variable.
     * If it is not set, a random one is created for this run, so the demo works
     * out of the box. Logins then stop working after a restart, which is fine here.
     */
    @jakarta.annotation.PostConstruct
    void initSecret() {
        if (secret == null || secret.isBlank()) {
            byte[] bytes = new byte[48];
            new java.security.SecureRandom().nextBytes(bytes);
            secret = java.util.Base64.getEncoder().encodeToString(bytes);
            log.warn("NEOBANK_JWT_SECRET is not set. Using a random secret for this run.");
        } else if (secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("NEOBANK_JWT_SECRET must be at least 32 characters");
        }
    }

    private SecretKey key() {
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateToken(Long userId, String email, String name) {
        return Jwts.builder()
                .subject(userId.toString())
                .claim("email", email)
                .claim("name", name)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(key())
                .compact();
    }

    public Long extractUserId(String token) {
        return Long.parseLong(parseClaims(token).getSubject());
    }

    public String extractEmail(String token) {
        return parseClaims(token).get("email", String.class);
    }

    public boolean isValid(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            log.warn("Invalid JWT: {}", e.getMessage());
            return false;
        }
    }

    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(key())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
