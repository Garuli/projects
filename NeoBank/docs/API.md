# API reference

All routes are under `/api`. Everything except `/api/auth/*` needs a header `Authorization: Bearer <token>`. You can also try every route in Swagger UI at http://localhost:8080/swagger-ui.html.

## Conventions

| Topic | Rule |
|---|---|
| Format | JSON in and out |
| Success | `{"success": true, "message": "...", "data": ...}` |
| Errors | `{"success": false, "message": "...", "data": null}` |
| Status codes | `200`/`201` success, `400` bad input, `401` wrong login, `403` not allowed, `404` not found, `422` a banking rule refused it |
| Ownership | You can only use your own user id and your own accounts. Anything else is `403` |

## Auth

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Create a user. Returns a token |
| POST | `/api/auth/login` | Body: `email`, `password`. Returns `token`, `userId`, `name`, `email` |

## Users

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/users` | The logged-in user, as a list |
| GET | `/api/users/{id}` | Your profile (`id` must be you) |
| PATCH | `/api/users/{id}/profile-picture` | Body: `{"profilePicture": "..."}` |

## Accounts

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/accounts` | Open an account. Body: `userId` (must be you), `type`, `initialDeposit`, optional `creditLimit` |
| GET | `/api/accounts` | All accounts, richest first (used by the transfer screen, see [known limits](ARCHITECTURE.md#known-limits)) |
| GET | `/api/accounts/user/{userId}` | Your accounts |
| GET | `/api/accounts/{id}` | One of your accounts |
| GET | `/api/accounts/{id}/balance` | Its balance |
| POST | `/api/accounts/{id}/deletion-request` | Ask to delete it (balance must be zero) |
| GET | `/api/accounts/{id}/deletion-request` | Status of that request |

## Transfers and transactions

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/transfer` | Body: `fromAccountNumber` (yours), `toAccountNumber`, `amount`, optional `description`. Returns the debit and the credit |
| GET | `/api/transactions/user/{userId}` | All your transactions, newest first |
| GET | `/api/transactions?accountId=1&from=...&to=...` | One of your accounts, with an optional date range (ISO date-time) |

## Reports

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/reports/user/{userId}` | Your totals, averages and top transactions |
| GET | `/api/reports/summary` | Bank-wide totals |

## Try it with curl

```bash
# log in and keep the token
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"alice123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

# my accounts (Alice is user 1)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/accounts/user/1

# send 25.00 from Alice's current account to Bob's savings
curl -s -X POST http://localhost:8080/api/transfer \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"fromAccountNumber":"NEO-000002","toAccountNumber":"NEO-000003","amount":25.00,"description":"Coffee"}'

# someone else's accounts: 403
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/accounts/user/2
```
