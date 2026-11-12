package com.neobank.security;

import com.neobank.model.entity.Account;
import com.neobank.repository.AccountJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * Ownership checks: a logged-in user may only read or change their own data.
 *
 * The JWT filter stores the user's id as the authentication principal.
 * Every method throws AccessDeniedException (HTTP 403) when the check fails,
 * and an unknown account is treated the same way so ids cannot be probed.
 */
@Component
@RequiredArgsConstructor
public class AccessGuard {

    private final AccountJpaRepository accountRepo;

    /** The id of the user who sent the current request. */
    public Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Long id)) {
            throw new AccessDeniedException("Not logged in");
        }
        return id;
    }

    /** The path or body user id must be the logged-in user. */
    public void requireSelf(Long userId) {
        if (userId == null || !userId.equals(currentUserId())) {
            throw new AccessDeniedException("You can only access your own data");
        }
    }

    /** The account must belong to the logged-in user. */
    public void requireAccountOwner(Long accountId) {
        Account account = accountRepo.findById(accountId)
                .orElseThrow(() -> new AccessDeniedException("You can only access your own accounts"));
        requireOwned(account);
    }

    /** Same check, using the public account number such as NEO-000001. */
    public void requireAccountNumberOwner(String accountNumber) {
        Account account = accountRepo.findByAccountNumber(accountNumber)
                .orElseThrow(() -> new AccessDeniedException("You can only use your own accounts"));
        requireOwned(account);
    }

    private void requireOwned(Account account) {
        if (account.getUser() == null || !account.getUser().getId().equals(currentUserId())) {
            throw new AccessDeniedException("You can only access your own accounts");
        }
    }
}
