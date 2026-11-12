package com.neobank.config;

import org.springframework.context.annotation.Configuration;

/**
 * [R6] JDBC configuration marker class.
 *
 * Spring Boot auto-configures the DataSource from application.properties
 * (H2 in-memory database).  The DataSource bean is injected directly into
 * JdbcTransactionRepository by Spring's dependency injection — no manual
 * DataSource construction needed here.
 *
 * This class exists to document the JDBC configuration decision and to
 * serve as an extension point if connection pool tuning is needed later
 * (e.g. switching from HikariCP defaults to custom pool sizes).
 */
@Configuration
public class JdbcConfig {
    // Spring Boot auto-configures HikariCP DataSource from application.properties.
    // JdbcTransactionRepository receives it via constructor injection.
}
