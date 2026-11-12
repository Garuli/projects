package com.neobank.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI / Swagger UI configuration.
 * Swagger UI is available at /swagger-ui.html after startup.
 */
@Configuration
public class SwaggerConfig {

    @Bean
    public OpenAPI neobankOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("NeoBank — Smart Banking Management System")
                        .description("CS 305 Capstone Project — University of New York Tirana (UNYT). " +
                                "Demonstrates Collections, Generics, Lambdas, Streams, Concurrency, " +
                                "JDBC, JPA, REST, and Design Patterns.")
                        .version("1.0.0")
                        .contact(new Contact()
                                .name("CS 305 Student")
                                .email("student@unyt.edu.al")));
    }
}
