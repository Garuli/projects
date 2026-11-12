# test/

Run everything with `mvn test`.

| Test | What it checks |
|---|---|
| `security/JwtUtilTest` | Tokens round-trip, tampered or foreign tokens are rejected, a missing secret falls back to a random one, a short secret is refused |
| `api/BankingApiTest` | Through the real API with an in-memory database: wrong password, routes that need a login, reading your own and other people's data, transfers (success, zero or negative amounts, same account, overdraft, over the limit, spending from someone else's account) |

`src/test/resources/application.properties` points the tests at an in-memory database and a fixed test secret.
