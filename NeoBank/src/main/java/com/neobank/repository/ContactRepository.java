package com.neobank.repository;

import com.neobank.model.entity.Contact;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ContactRepository extends JpaRepository<Contact, Long> {

    List<Contact> findByOwnerIdOrderByNameAsc(Long ownerId);

    boolean existsByOwnerIdAndAccountNumber(Long ownerId, String accountNumber);
}
