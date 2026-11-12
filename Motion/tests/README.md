# tests/

Automated security and password reset tests for Motion, written with [pytest](https://pytest.org).

## Run them

From the `Motion` folder, with the virtual environment active:

```bash
pip install -r requirements-dev.txt
python -m pytest tests/
```

The tests set `MOTION_DB` to a temporary file and `SECRET_KEY` to a test value before importing the app. They never touch `motion.db` or `.secret_key`. Each test gets a fresh database and a reset rate limiter.

## Files

| File | What it tests |
|---|---|
| `test_security.py` | Login and sessions, password hashing, rate limits, CSRF, access control between users, foreign keys, XSS escaping, security headers, input limits and the secret key file |
| `test_password_reset.py` | Forgot password, reset password, change password and the mailer. Emails are captured by a fake mailer and background work runs inline, so nothing is sent |

## What is covered

| Area | Checks |
|---|---|
| Login required | Every protected page and API route redirects to `/` without a session, for reads and for writes |
| Sessions | A forged cookie, a cookie signed with the old hardcoded key, and a tampered cookie are all rejected. A `session_version` mismatch logs the user out. Logout is POST only and revokes a copied cookie. Sessions expire after 8 hours. Cookies are `HttpOnly` and `SameSite=Lax` |
| Passwords | Same error for an unknown email and a wrong password. Old PBKDF2 hashes still log in and are upgraded to the Werkzeug format |
| Rate limits | The 6th login in a minute gives `429`. 5 wrong passwords lock the email, even for the right password. The 11th registration in an hour gives `429` |
| CSRF | A wrong or missing token gives `403`, also on `/login`. Every page has the `csrf-token` meta tag |
| Access control | User B gets `404` for every read, edit and delete of user A's page, tags, export, database, item, column, filter and chat. A's data is unchanged afterwards |
| Database | Foreign keys are on. Deleting a page or database removes its tags, columns and items. An old database gets the `session_version` column |
| XSS | Script and image payloads in names, titles, tags, column names, item values and chat titles come back escaped on every page. The export filename is sanitised |
| Headers and templates | CSP and the other security headers are set, `no-store` only when logged in. Templates contain no inline scripts, `on...=` handlers or `style=` attributes. Page scripts load after `csrf.js` and `main.js` |
| Input | Non-JSON bodies, wrong types and over-long fields give `400`. Bodies over 1 MB give `413` |
| Secret key | `.secret_key` is created with mode `600` and reused, and `SECRET_KEY` takes priority |
| Forgot password | Same body and status for an existing and an unknown email, and the request thread does no lookup. The reset link uses `APP_BASE_URL` even with a spoofed `Host` / `X-Forwarded-Host`. 4th request for one email and 11th per IP give `429`. Stale tokens are deleted on every request |
| Reset tokens | Stored only as SHA-256 (the raw token is not in the database file). 30-minute expiry. A second request invalidates the first. Expired, used and random tokens are rejected (page and POST). The token is redacted from the request log |
| Reset password | Weak passwords are rejected and the token stays usable. Afterwards the old password fails and the new one works, the hash is Werkzeug's, existing sessions are logged out, the user is not logged in, the login page shows the message, a notification is emailed. Reset page sends `no-store` and `no-referrer` and loads no third-party resources. 11th POST per IP gives `429`. CSRF is required |
| Change password | Needs login and the right current password. Keeps the current session, logs out the others, invalidates reset tokens |
| Mailer | Without SMTP it does not crash: it logs a warning, or prints the email with `DEV_MAIL_TO_CONSOLE=1`. With SMTP it uses STARTTLS, logs in and sends text + HTML |

## Related

- The security design these tests check: [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md#security)
- Setup and environment variables: [docs/SETUP.md](../docs/SETUP.md)
