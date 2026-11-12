package com.neobank;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * NeoBank — Smart Banking Management System
 *
 * CS 305 Capstone Project
 * Course:     Advanced Java
 * University: University of New York Tirana (UNYT)
 *
 * Implemented requirements: R1–R10 (Collections, Generics, Lambdas,
 * Streams, Concurrency, JDBC, JPA, REST, Design Patterns, Exceptions).
 *
 * Run with: mvn spring-boot:run
 * UI:        http://localhost:8080
 * Swagger:   http://localhost:8080/swagger-ui.html
 * H2 DB:     http://localhost:8080/h2-console  (only when H2_CONSOLE_ENABLED=true; URL: jdbc:h2:file:./data/neobankdb)
 */
@SpringBootApplication
@EnableScheduling
public class NeobankApplication {

    public static void main(String[] args) {
        SpringApplication.run(NeobankApplication.class, args);
    }
}
