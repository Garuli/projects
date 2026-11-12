package com.neobank.repository;

import com.neobank.model.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

/**
 * [R7] Spring Data JPA repository for User entities.
 *
 * Spring generates the implementation at runtime from method signatures
 * and the @Query annotation — no boilerplate SQL needed for simple cases.
 */
public interface UserJpaRepository extends JpaRepository<User, Long> {

    /** Look up a user by their unique email address. */
    Optional<User> findByEmail(String email);

    /** Check whether any user is registered with the given email. */
    boolean existsByEmail(String email);

    /**
     * [R7] Custom JPQL query: eagerly fetch user together with their accounts
     * in a single JOIN — avoids the N+1 problem when rendering account lists.
     *
     * @param id the user's primary key
     * @return the user with accounts initialised, or empty
     */
    @Query("SELECT u FROM User u LEFT JOIN FETCH u.accounts WHERE u.id = :id")
    Optional<User> findByIdWithAccounts(@Param("id") Long id);
}
