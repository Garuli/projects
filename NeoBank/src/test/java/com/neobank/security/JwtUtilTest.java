package com.neobank.security;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;

class JwtUtilTest {

    private JwtUtil create(String secret) {
        JwtUtil util = new JwtUtil();
        ReflectionTestUtils.setField(util, "secret", secret);
        ReflectionTestUtils.setField(util, "expirationMs", 60_000L);
        ReflectionTestUtils.invokeMethod(util, "initSecret");
        return util;
    }

    @Test
    void tokenRoundTripKeepsUserIdAndEmail() {
        JwtUtil util = create("a-test-secret-that-is-long-enough-for-hs256");
        String token = util.generateToken(7L, "alice@example.com", "Alice");

        assertTrue(util.isValid(token));
        assertEquals(7L, util.extractUserId(token));
        assertEquals("alice@example.com", util.extractEmail(token));
    }

    @Test
    void tamperedTokenIsRejected() {
        JwtUtil util = create("a-test-secret-that-is-long-enough-for-hs256");
        String token = util.generateToken(1L, "alice@example.com", "Alice");

        assertFalse(util.isValid(token + "x"));
    }

    @Test
    void tokenSignedWithAnotherSecretIsRejected() {
        JwtUtil a = create("first-secret-first-secret-first-secret-1");
        JwtUtil b = create("other-secret-other-secret-other-secret-2");

        assertFalse(b.isValid(a.generateToken(1L, "alice@example.com", "Alice")));
    }

    @Test
    void emptySecretFallsBackToARandomOne() {
        JwtUtil util = create("");
        assertTrue(util.isValid(util.generateToken(1L, "a@b.c", "A")));
    }

    @Test
    void shortSecretIsRefused() {
        assertThrows(IllegalStateException.class, () -> create("too-short"));
    }
}
