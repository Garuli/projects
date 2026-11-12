# com.neobank

The Java code, one package per job.

| Package | Contents |
|---|---|
| `NeobankApplication`, `DataInitializer` | Starts the app. The initializer adds the demo users and accounts when the database is empty |
| `controller/` | REST controllers for auth, users, accounts, transfers and transactions, reports and deletion requests |
| `service/` | Business rules: `AccountService`, `TransactionService`, `UserService`, `ReportService`, `DeletionRequestService` |
| `repository/` | Spring Data JPA repositories, `JdbcTransactionRepository` (raw JDBC) and a generic repository interface |
| `model/entity/` | Database entities: `User`, `Account`, `Transaction`, `DeletionRequest` |
| `model/dto/` | Request and response objects, so entities are never sent straight to the browser |
| `pattern/` | `factory/AccountFactory` and the `strategy/` classes, one per account type |
| `security/` | `JwtUtil` (create and check tokens), `JwtFilter` (log the user in for a request), `AccessGuard` (ownership checks) |
| `config/` | Spring Security, Swagger and JDBC settings |
| `exception/` | Custom exceptions and `GlobalExceptionHandler`, which turns them into HTTP responses |
| `util/` | Account number and transaction id generators |

How they work together is explained in [docs/ARCHITECTURE.md](../../../../../docs/ARCHITECTURE.md).
