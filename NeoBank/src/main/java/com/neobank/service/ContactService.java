package com.neobank.service;

import com.neobank.model.dto.ContactRequest;
import com.neobank.model.dto.ContactResponse;
import com.neobank.model.entity.Contact;
import com.neobank.repository.AccountJpaRepository;
import com.neobank.repository.ContactRepository;
import com.neobank.repository.UserJpaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/** Saved recipients ("contacts") for quick transfers. Every method works on one user's own list. */
@Service
@RequiredArgsConstructor
public class ContactService {

    private final ContactRepository contactRepo;
    private final AccountJpaRepository accountRepo;
    private final UserJpaRepository userRepo;

    @Transactional(readOnly = true)
    public List<ContactResponse> list(Long userId) {
        return contactRepo.findByOwnerIdOrderByNameAsc(userId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public ContactResponse add(Long userId, ContactRequest request) {
        String number = request.getAccountNumber().trim().toUpperCase();
        if (!accountRepo.existsByAccountNumber(number)) {
            throw new IllegalArgumentException("No account with number " + number);
        }
        if (accountRepo.findByAccountNumber(number)
                .map(a -> a.getUser().getId().equals(userId)).orElse(false)) {
            throw new IllegalArgumentException("That is your own account. Use the transfer page to move money between your accounts.");
        }
        if (contactRepo.existsByOwnerIdAndAccountNumber(userId, number)) {
            throw new IllegalArgumentException("You already saved " + number);
        }
        Contact saved = contactRepo.save(Contact.builder()
                .owner(userRepo.getReferenceById(userId))
                .name(request.getName().trim())
                .accountNumber(number)
                .createdAt(LocalDateTime.now())
                .build());
        return toResponse(saved);
    }

    @Transactional
    public void delete(Long userId, Long contactId) {
        Contact contact = contactRepo.findById(contactId)
                .orElseThrow(() -> new AccessDeniedException("You can only delete your own contacts"));
        if (!contact.getOwner().getId().equals(userId)) {
            throw new AccessDeniedException("You can only delete your own contacts");
        }
        contactRepo.delete(contact);
    }

    private ContactResponse toResponse(Contact c) {
        return ContactResponse.builder()
                .id(c.getId())
                .name(c.getName())
                .accountNumber(c.getAccountNumber())
                .build();
    }
}
