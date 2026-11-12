package com.neobank;

import com.neobank.model.entity.Account;
import com.neobank.model.entity.Account.AccountType;
import com.neobank.model.entity.Transaction;
import com.neobank.model.entity.Transaction.TransactionType;
import com.neobank.model.entity.User;
import com.neobank.repository.AccountJpaRepository;
import com.neobank.repository.TransactionJpaRepository;
import com.neobank.repository.UserJpaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer {

    private final UserJpaRepository userRepo;
    private final AccountJpaRepository accountRepo;
    private final TransactionJpaRepository txRepo;
    private final BCryptPasswordEncoder passwordEncoder;

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void seed() {
        if (userRepo.count() > 0) {
            log.info("Database already seeded — skipping.");
            return;
        }
        log.info("Seeding database with demo data...");

        User alice = userRepo.save(User.builder()
                .name("Alice Demo").email("alice@example.com")
                .phone("+355-69-000-0001").address("Tirana, Albania")
                .password(passwordEncoder.encode("alice123")).build());

        User bob = userRepo.save(User.builder()
                .name("Bob Demo").email("bob@example.com")
                .phone("+355-69-000-0002").address("Shkoder, Albania")
                .password(passwordEncoder.encode("bob123")).build());

        User carol = userRepo.save(User.builder()
                .name("Carol Demo").email("carol@example.com")
                .phone("+355-69-000-0003").address("Durres, Albania")
                .password(passwordEncoder.encode("carol123")).build());

        Account aliceSavings = accountRepo.save(Account.builder()
                .accountNumber("NEO-000001").type(AccountType.SAVINGS)
                .balance(new BigDecimal("4800.00")).user(alice).build());

        Account aliceCurrent = accountRepo.save(Account.builder()
                .accountNumber("NEO-000002").type(AccountType.CURRENT)
                .balance(new BigDecimal("12200.00")).user(alice).build());

        Account bobSavings = accountRepo.save(Account.builder()
                .accountNumber("NEO-000003").type(AccountType.SAVINGS)
                .balance(new BigDecimal("3500.00")).user(bob).build());

        Account bobBusiness = accountRepo.save(Account.builder()
                .accountNumber("NEO-000004").type(AccountType.BUSINESS)
                .balance(new BigDecimal("45000.00")).user(bob).build());

        Account carolStudent = accountRepo.save(Account.builder()
                .accountNumber("NEO-000005").type(AccountType.STUDENT)
                .balance(new BigDecimal("800.00")).user(carol).build());

        LocalDateTime now = LocalDateTime.now();
        String ref1 = UUID.randomUUID().toString(); // Alice Current -> Bob Savings (external)
        String ref2 = UUID.randomUUID().toString(); // Alice Savings -> Alice Current (internal)

        // ── Alice Savings ──────────────────────────────────────────────────────
        tx(aliceSavings, TransactionType.CREDIT, "5000.00", "Initial deposit",
                "5000.00", null, null, null, now.minusDays(30));
        tx(aliceSavings, TransactionType.DEBIT, "200.00", "Transfer to NEO-000002: top up",
                "4800.00", ref2, "NEO-000002", "alice@example.com", now.minusDays(1));

        // ── Alice Current ──────────────────────────────────────────────────────
        tx(aliceCurrent, TransactionType.CREDIT, "8000.00", "Monthly salary",
                "8000.00", null, null, null, now.minusDays(28));
        tx(aliceCurrent, TransactionType.DEBIT, "600.00", "Rent payment",
                "7400.00", null, null, null, now.minusDays(20));
        tx(aliceCurrent, TransactionType.CREDIT, "5100.00", "Freelance invoice",
                "12500.00", null, null, null, now.minusDays(5));
        tx(aliceCurrent, TransactionType.DEBIT, "500.00", "Transfer to NEO-000003: lunch split",
                "12000.00", ref1, "NEO-000003", "bob@example.com", now.minusDays(3));
        tx(aliceCurrent, TransactionType.CREDIT, "200.00", "Transfer from NEO-000001: top up",
                "12200.00", ref2, "NEO-000001", "alice@example.com", now.minusDays(1));

        // ── Bob Savings ────────────────────────────────────────────────────────
        tx(bobSavings, TransactionType.CREDIT, "3000.00", "Opening deposit",
                "3000.00", null, null, null, now.minusDays(60));
        tx(bobSavings, TransactionType.CREDIT, "500.00", "Transfer from NEO-000002: lunch split",
                "3500.00", ref1, "NEO-000002", "alice@example.com", now.minusDays(3));

        // ── Bob Business ───────────────────────────────────────────────────────
        tx(bobBusiness, TransactionType.CREDIT, "40000.00", "Business capital",
                "40000.00", null, null, null, now.minusDays(90));
        tx(bobBusiness, TransactionType.CREDIT, "7000.00", "Client payment",
                "47000.00", null, null, null, now.minusDays(40));
        tx(bobBusiness, TransactionType.DEBIT, "2000.00", "Office rent",
                "45000.00", null, null, null, now.minusDays(10));

        // ── Carol Student ────────────────────────────────────────────────────────
        tx(carolStudent, TransactionType.CREDIT, "1000.00", "Scholarship deposit",
                "1000.00", null, null, null, now.minusDays(45));
        tx(carolStudent, TransactionType.DEBIT, "200.00", "Textbooks",
                "800.00", null, null, null, now.minusDays(7));

        log.info("Seeded 3 users (alice/bob/carol), 5 accounts, 15 transactions.");
    }

    private void tx(Account account, TransactionType type, String amount,
                    String description, String balanceAfter,
                    String transferRef, String counterpartAccountNumber,
                    String counterpartEmail, LocalDateTime timestamp) {
        Transaction.TransactionBuilder b = Transaction.builder()
                .account(account)
                .type(type)
                .amount(new BigDecimal(amount))
                .description(description)
                .balanceAfter(new BigDecimal(balanceAfter))
                .status("COMPLETED")
                .timestamp(timestamp);
        if (transferRef != null) b.transferRef(transferRef);
        if (counterpartAccountNumber != null) b.counterpartAccountNumber(counterpartAccountNumber);
        if (counterpartEmail != null) b.counterpartEmail(counterpartEmail);
        txRepo.save(b.build());
    }
}
