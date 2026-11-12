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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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

    // ── Freeze ───────────────────────────────────────────────────────────────

    private long accountId(String token, long userId, String accountNumber) throws Exception {
        MvcResult r = mvc.perform(get("/api/accounts/user/" + userId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn();
        for (JsonNode a : json.readTree(r.getResponse().getContentAsString()).get("data")) {
            if (a.get("accountNumber").asText().equals(accountNumber)) return a.get("id").asLong();
        }
        throw new AssertionError("account not found: " + accountNumber);
    }

    @Test
    void frozenAccountCannotSendButUnfrozenCan() throws Exception {
        long id = accountId(aliceToken, aliceId, "NEO-000001");
        mvc.perform(post("/api/accounts/" + id + "/freeze").header("Authorization", "Bearer " + aliceToken))
                .andExpect(status().isOk());
        try {
            assertEquals(400, transfer(aliceToken, "NEO-000001", "NEO-000002", "1.00"));
        } finally {
            mvc.perform(post("/api/accounts/" + id + "/unfreeze").header("Authorization", "Bearer " + aliceToken))
                    .andExpect(status().isOk());
        }
        assertEquals(200, transfer(aliceToken, "NEO-000001", "NEO-000002", "1.00"));
    }

    @Test
    void userCannotFreezeSomeoneElsesAccount() throws Exception {
        long id = accountId(aliceToken, aliceId, "NEO-000001");
        mvc.perform(post("/api/accounts/" + id + "/freeze").header("Authorization", "Bearer " + bobToken))
                .andExpect(status().isForbidden());
    }

    // ── Contacts ─────────────────────────────────────────────────────────────

    private int addContact(String token, String name, String number) throws Exception {
        return mvc.perform(post("/api/contacts").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + name + "\",\"accountNumber\":\"" + number + "\"}"))
                .andReturn().getResponse().getStatus();
    }

    @Test
    void contactsCanBeSavedListedAndDeletedByTheirOwnerOnly() throws Exception {
        assertEquals(201, addContact(aliceToken, "Bob lunch", "NEO-000003"));
        MvcResult r = mvc.perform(get("/api/contacts").header("Authorization", "Bearer " + aliceToken))
                .andExpect(status().isOk()).andReturn();
        JsonNode list = json.readTree(r.getResponse().getContentAsString()).get("data");
        long contactId = -1;
        for (JsonNode c : list) {
            if (c.get("name").asText().equals("Bob lunch")) contactId = c.get("id").asLong();
        }
        assertTrue(contactId > 0, "the saved contact should be in the list");

        // Bob cannot see or delete Alice's contact
        mvc.perform(delete("/api/contacts/" + contactId).header("Authorization", "Bearer " + bobToken))
                .andExpect(status().isForbidden());
        MvcResult bobList = mvc.perform(get("/api/contacts").header("Authorization", "Bearer " + bobToken))
                .andExpect(status().isOk()).andReturn();
        assertEquals(0, json.readTree(bobList.getResponse().getContentAsString()).get("data").size());

        mvc.perform(delete("/api/contacts/" + contactId).header("Authorization", "Bearer " + aliceToken))
                .andExpect(status().isOk());
    }

    @Test
    void contactMustBeAnotherExistingAccountAndNotADuplicate() throws Exception {
        assertEquals(400, addContact(aliceToken, "Nobody", "NEO-999999"));
        assertEquals(400, addContact(aliceToken, "Me", "NEO-000002"));   // Alice's own account
        assertEquals(201, addContact(aliceToken, "Carol", "NEO-000005"));
        assertEquals(400, addContact(aliceToken, "Carol again", "NEO-000005"));
    }

    // ── Change password ──────────────────────────────────────────────────────

    private int changePassword(String token, String current, String next) throws Exception {
        return mvc.perform(post("/api/users/me/password").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"" + current + "\",\"newPassword\":\"" + next + "\"}"))
                .andReturn().getResponse().getStatus();
    }

    @Test
    void passwordChangeNeedsTheCurrentPasswordAndTakesEffect() throws Exception {
        String carolToken = login("carol@example.com", "carol123").get("token").asText();
        assertEquals(400, changePassword(carolToken, "wrong-password", "newpass123"));
        assertEquals(400, changePassword(carolToken, "carol123", "short"));
        assertEquals(200, changePassword(carolToken, "carol123", "newpass123"));
        assertTrue(login("carol@example.com", "newpass123").has("token"));
        assertEquals(200, changePassword(carolToken, "newpass123", "carol123"));   // put it back
    }

    // ── Opening deposit ──────────────────────────────────────────────────────

    @Test
    void newSavingsAccountOpensWithTheDepositAndRecordsIt() throws Exception {
        var res = mvc.perform(post("/api/accounts").header("Authorization", "Bearer " + aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":" + aliceId + ",\"type\":\"SAVINGS\",\"initialDeposit\":500}"))
                .andReturn().getResponse();
        assertEquals(200, res.getStatus() == 201 ? 200 : res.getStatus());
        JsonNode acc = json.readTree(res.getContentAsString()).get("data");
        assertEquals(0, acc.get("balance").decimalValue().compareTo(new java.math.BigDecimal("500")));

        var tx = mvc.perform(get("/api/transactions/user/" + aliceId).header("Authorization", "Bearer " + aliceToken))
                .andReturn().getResponse().getContentAsString();
        assertTrue(tx.contains(acc.get("accountNumber").asText()));
    }

    @Test
    void negativeOpeningDepositIsRefused() throws Exception {
        int status = mvc.perform(post("/api/accounts").header("Authorization", "Bearer " + aliceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":" + aliceId + ",\"type\":\"CURRENT\",\"initialDeposit\":-5}"))
                .andReturn().getResponse().getStatus();
        assertEquals(400, status);
    }
}
