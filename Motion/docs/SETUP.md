# Setup guide

How to install and run Motion on macOS, Windows or Linux.

## What you need

| Requirement | Notes |
|---|---|
| Python 3.10 or newer | Check with `python3 --version` (on Windows: `python --version`) |
| Git | To download the project |
| Ollama (optional) | Only needed for the AI chat and the AI button. See [below](#set-up-the-ai-ollama) |

## Install and run

### macOS and Linux

```bash
git clone https://github.com/Garuli/projects.git
cd projects/Motion
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

### Windows (PowerShell)

```powershell
git clone https://github.com/Garuli/projects.git
cd projects\Motion
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

If PowerShell refuses to run the activation script, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once and try again.

### Open the app

Go to **http://127.0.0.1:5001**, click **Sign Up**, and create an account. Passwords need 8 or more characters with an uppercase letter, a lowercase letter, a number and a special character.

Run `python app.py` from inside the `Motion` folder. The database file `motion.db` is created in the folder you run it from.

On the first run the app also creates **`.secret_key`** next to `app.py`, with permissions `600` (only your user can read it). It holds a random key that signs the login cookies and is reused on every later run. It is listed in `.gitignore`. Never commit or share it: anyone who has it can forge a login. Deleting it logs everyone out.

## Environment variables

All are optional.

| Variable | Default | What it does |
|---|---|---|
| `PORT` | `5001` | The port the app listens on |
| `HOST` | `127.0.0.1` | The address the app listens on. The default only accepts connections from your own computer. Use `0.0.0.0` to allow other devices on your network |
| `FLASK_DEBUG` | off | Set to `1` to turn on the debugger and auto-reload. Never use it when other people can reach the app: the debugger can run code |
| `SECRET_KEY` | contents of `.secret_key` | Signs the login session cookie. If not set, a random key is generated once and saved to `.secret_key`. Set it explicitly on servers, for example with `python -c "import secrets; print(secrets.token_hex(32))"` |
| `SESSION_COOKIE_SECURE` | off | Set to `1` when the app is served over HTTPS, so the browser only sends the session cookie over HTTPS |
| `MOTION_DB` | `motion.db` | Path of the SQLite database file. The tests use this to work on a temporary file |
| `OLLAMA_MODEL` | `llama3.1:8b` | The Ollama model used by the chat and the AI button |
| `APP_BASE_URL` | `http://127.0.0.1:5001` | The address put in password reset emails. Set it to the URL people actually open, for example `https://motion.example.com`. Links are never built from the request's `Host` header |
| `SMTP_HOST` | not set | SMTP server for outgoing email (password reset and "password changed" notices). Email is only sent when both `SMTP_HOST` and `MAIL_FROM` are set. See [Set up email](#set-up-email-password-reset) |
| `SMTP_PORT` | `587` | SMTP port. Motion always upgrades the connection with STARTTLS, so use the STARTTLS port (usually `587`, or `2525` on Mailtrap), not `465` |
| `SMTP_USER` | not set | SMTP username. Leave unset for a server without login |
| `SMTP_PASSWORD` | not set | SMTP password (for Gmail, an App Password) |
| `MAIL_FROM` | not set | The sender, for example `Motion <you@gmail.com>` |
| `DEV_MAIL_TO_CONSOLE` | off | Set to `1` to print emails (including reset links) in the terminal when SMTP is not configured. For local development only. Without it, an unconfigured app logs a warning and sends nothing |

Examples:

```bash
# macOS / Linux
PORT=8000 python app.py
OLLAMA_MODEL=llama3.2:3b python app.py
HOST=0.0.0.0 python app.py                 # reachable from other devices on your network
MOTION_DB=/tmp/scratch.db python app.py    # use a separate database file
```

```powershell
# Windows PowerShell
$env:PORT = "8000"; python app.py
$env:OLLAMA_MODEL = "llama3.2:3b"; python app.py
$env:FLASK_DEBUG = "1"; python app.py
```

## Set up email (password reset)

"Forgot password?" needs a way to deliver the reset link. Pick one:

**1. No email at all (quickest, local only).** Start the app with `DEV_MAIL_TO_CONSOLE=1`. The reset email, link included, is printed in the terminal where `python app.py` runs. Copy the link into your browser.

```bash
DEV_MAIL_TO_CONSOLE=1 python app.py
```

**2. A test inbox such as [Mailtrap](https://mailtrap.io).** Nothing reaches a real inbox: every email lands in a web inbox you can open. Create a free account, open **Email Testing → Inboxes → your inbox → SMTP settings**, and copy the host, port, username and password:

```bash
export SMTP_HOST=sandbox.smtp.mailtrap.io
export SMTP_PORT=2525
export SMTP_USER=<mailtrap username>
export SMTP_PASSWORD=<mailtrap password>
export MAIL_FROM="Motion <noreply@example.com>"
python app.py
```

**3. Real email through Gmail.** Gmail does not accept your normal password over SMTP. You need an **App Password**:

1. Turn on 2-Step Verification for the Google account (App Passwords require it).
2. Go to **Google Account → Security → App passwords** (or search "App passwords" in the account settings), create one called "Motion", and copy the 16-character password.
3. Start the app:

```bash
export SMTP_HOST=smtp.gmail.com
export SMTP_PORT=587
export SMTP_USER=you@gmail.com
export SMTP_PASSWORD=<16-character app password, no spaces>
export MAIL_FROM="Motion <you@gmail.com>"
export APP_BASE_URL=http://127.0.0.1:5001
python app.py
```

Keep these values out of git: set them in your shell or a local, git-ignored file. Revoke the App Password in your Google account when you no longer need it. If someone else should be able to open the link (another device, a deployed server), set `APP_BASE_URL` to the address they use.

## Run the tests

```bash
pip install -r requirements-dev.txt
python -m pytest tests/
pip-audit -r requirements.txt     # check dependencies for known vulnerabilities
```

The tests use a temporary database and never touch `motion.db`. See [tests/README.md](../tests/README.md).

## Set up the AI (Ollama)

The chat and the **AI** button in the page editor use a model that runs on your own computer through [Ollama](https://ollama.com). Everything else in Motion works without it.

1. **Install Ollama.** On macOS with Homebrew: `brew install ollama`. On other systems, download it from [ollama.com/download](https://ollama.com/download).
2. **Start it.** On macOS: `brew services start ollama`. Elsewhere, start the Ollama app, or run `ollama serve` in its own terminal.
3. **Download the model.** This is about 5 GB:
   ```bash
   ollama pull llama3.1:8b
   ```
4. **Check that it works.**
   ```bash
   curl http://localhost:11434/api/tags
   ```
   The answer should list `llama3.1:8b`.

You do not need to restart Motion after installing Ollama.

**Slow or short on memory?** Use a smaller model, for example `ollama pull llama3.2:3b`, and start Motion with `OLLAMA_MODEL=llama3.2:3b`.

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| Port 5000 shows an "AirTunes" or 403 page | macOS uses port 5000 for AirPlay Receiver | Motion already uses 5001. If 5001 is also taken, set `PORT` to another number |
| `ModuleNotFoundError: No module named 'flask'` | The virtual environment is not active, or the packages are not installed | Activate `.venv`, then run `pip install -r requirements.txt` |
| Chat or AI button shows "Ollama server not running" | Ollama is not started | Start it (step 2 above) and try again |
| Chat or AI button shows a model error | The model is not downloaded | Run `ollama pull llama3.1:8b`, or set `OLLAMA_MODEL` to a model you have (`ollama list` shows them) |
| Everything is empty after restarting | You started the app from a different folder, so it created a new `motion.db` there | Always run `python app.py` from inside `Motion/` |
| You are logged out after every restart | The session key changed (for example `.secret_key` was deleted, or the app cannot write next to `app.py`) | Set a fixed `SECRET_KEY`, or make the `Motion` folder writable |
| You are logged out after 8 hours | Sessions expire 8 hours after login | Log in again |
| Login says "Too many requests" or "Too many failed attempts" | Login is limited to 5 tries a minute and 20 an hour per IP, and an email is locked for 15 minutes after 5 wrong passwords | Wait, then try again. Restarting the app clears the per-IP limit, not the email lock |
| A reset email never arrives and the terminal says "Email not sent: SMTP is not configured" | `SMTP_HOST` or `MAIL_FROM` is not set | Set them (see [Set up email](#set-up-email-password-reset)), or use `DEV_MAIL_TO_CONSOLE=1` |
| The terminal says "Sending email via smtp.gmail.com:587 failed: SMTPAuthenticationError" | Gmail rejected the login | Use an App Password, not your Google password, and check `SMTP_USER` is the full address |
| "Forgot password?" says "Too many reset requests" | 3 requests an hour per email, 10 per IP | Wait an hour, or restart the app (the limits are kept in memory) |
| The reset link opens the wrong address | `APP_BASE_URL` does not match how you open the app | Set `APP_BASE_URL` |
| A button does nothing and the browser console shows "Invalid or missing CSRF token" (`403`) | The page was open from an earlier session | Reload the page |
| Other devices on your network cannot open the app | The app only listens on `127.0.0.1` by default | Start it with `HOST=0.0.0.0` |

## Reset all data

Stop the app, delete `motion.db`, and start it again. The tables are created fresh. This removes every account, page, database and chat.

## Next

- See what the app looks like: [screenshots](screenshots/README.md)
- Understand how it works: [ARCHITECTURE.md](ARCHITECTURE.md)
