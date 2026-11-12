package com.neobank.repository;

import java.util.List;
import java.util.Optional;

/**
 * [R2] Generic repository interface with type bounds.
 *
 * T must be Comparable so implementations can return sorted results when needed.
 * ID is constrained to Number to reflect that all our entities use numeric keys.
 *
 * This interface documents the contract every repository must honour;
 * Spring Data JPA's JpaRepository satisfies it implicitly, and our raw JDBC
 * implementation (JdbcTransactionRepository) satisfies it explicitly.
 *
 * @param <T>  entity type — must implement Comparable for sorted retrieval
 * @param <ID> primary key type — must extend Number (Long, Integer, etc.)
 */
public interface GenericRepository<T extends Comparable<T>, ID extends Number> {

    /** Persist a new entity or merge an existing one. */
    T save(T entity);

    /** Find by primary key; returns empty Optional if absent. */
    Optional<T> findById(ID id);

    /** Return all entities managed by this repository. */
    List<T> findAll();

    /** Remove the entity identified by id. */
    void deleteById(ID id);

    /** Check whether an entity with the given id exists. */
    boolean existsById(ID id);
}
