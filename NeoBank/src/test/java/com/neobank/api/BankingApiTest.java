package com.neobank.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end tests of the REST API against an in-memory database seeded with the
 * demo data (Alice owns NEO-000001 and NEO-000002, Bob owns NEO-000003 and NEO-000004).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class BankingApiTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    String aliceToken, bobToken;
    long aliceId, bobId;

    @BeforeEach
    void logIn() throws Exception {
        JsonNode alice = login("alice@example.com", "alice123");
        aliceToken = alice.get("token").asText();
        aliceId = alice.get("userId").asLong();
        JsonNode bob = login("bob@example.com", "bob123");
        bobToken = bob.get("token").asText();
        bobId = bob.get("userId").asLong();
    }

    private JsonNode login(String email, String password) throws Exception {
        MvcResult r = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return json.readTree(r.getResponse().getContentAsString()).get("data");
    }

    private int transfer(String token, String from, String to, String amount) throws Exception {
        return mvc.perform(post("/api/transfer").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fromAccountNumber\":\"" + from + "\",\"toAccountNumber\":\"" + to
                                + "\",\"amount\":" + amount + "}"))
                .andReturn().getResponse().getStatus();
    }

    // ── Login ────────────────────────────────────────────────────────────────

    @Test
    void wrongPasswordIsRejected() throws Exception {
        int code = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"alice@example.com\",\"password\":\"nope\"}"))
                .andReturn().getResponse().getStatus();
        assertEquals(401, code);
    }

    @Test
    void protectedRoutesNeedAToken() throws Exception {
        int code = mvc.perform(get("/api/accounts/user/" + aliceId)).andReturn().getResponse().getStatus();
        assertEquals(403, code);   // no token: Spring Security denies the request
    }

    // ── Ownership ────────────────────────────────────────────────────────────

    @Test
    void userCanReadOwnAccounts() throws Exception {
        mvc.perform(get("/api/accounts/user/" + aliceId).header("Authorization", "Bearer " + aliceToken))
                .andExpect(status().isOk());
    }

    @Test
    void userCannotReadSomeoneElsesAccounts() throws Exception {
        mvc.perform(get("/api/accounts/user/" + aliceId).header("Authorization", "Bearer " + bobToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void userCannotReadSomeoneElsesTransactionsOrReport() throws Exception {
        mvc.perform(get("/api/transactions/user/" + aliceId).header("Authorization", "Bearer " + bobToken))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/reports/user/" + aliceId).header("Authorization", "Bearer " + bobToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void userCannotSpendFromSomeoneElsesAccount() throws Exception {
        // Bob tries to move Alice's money into his own account
        assertEquals(403, transfer(bobToken, "NEO-000001", "NEO-000003", "10.00"));
    }

    // ── Transfer rules ───────────────────────────────────────────────────────

    @Test
    void transferBetweenOwnAccountsSucceeds() throws Exception {
        assertEquals(200, transfer(aliceToken, "NEO-000001", "NEO-000002", "1.00"));
    }

    @Test
    void transferToAnotherCustomerSucceeds() throws Exception {
        assertEquals(200, transfer(aliceToken, "NEO-000002", "NEO-000003", "1.00"));
    }

    @Test
    void zeroAndNegativeAmountsAreRejected() throws Exception {
        assertEquals(400, transfer(aliceToken, "NEO-000001", "NEO-000002", "0"));
        assertEquals(400, transfer(aliceToken, "NEO-000001", "NEO-000002", "-5"));
    }

    @Test
    void transferToTheSameAccountIsRejected() throws Exception {
        assertEquals(400, transfer(aliceToken, "NEO-000001", "NEO-000001", "5.00"));
    }

    @Test
    void savingsAccountCannotBeOverdrawn() throws Exception {
        // NEO-000001 is a savings account with a few thousand and no overdraft; the amount stays
        // under the transfer limit so the failure comes from the balance, not the limit.
        int code = transfer(aliceToken, "NEO-000001", "NEO-000002", "4999.00");
        assertEquals(422, code);
    }

    @Test
    void transferOverTheLimitIsRejected() throws Exception {
        assertEquals(422, transfer(aliceToken, "NEO-000002", "NEO-000003", "1000000.00"));
    }
}
