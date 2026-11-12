<p align="center">
  <img src="docs/images/logo.png" alt="Motion logo" width="140">
</p>

<h1 align="center">Motion</h1>

<p align="center">
  A Notion-style workspace with pages, databases and a local AI assistant, built with Flask and SQLite.
</p>

---

## Overview

Motion lets you write notes, organise work in databases and chat with an AI model that runs on your own computer. Pages are saved automatically, databases can be viewed as a table, a Kanban board, a calendar or a list, and the AI features use [Ollama](https://ollama.com), so your text never leaves your machine.

> **A prototype.** Motion is a learning project that recreates the core ideas of [Notion](https://www.notion.so) (pages, databases and several views of the same data) to practise building a complete web app. It is not affiliated with or endorsed by Notion Labs, Inc., and it is not a finished product. Its chatbot is not a cloud service: it runs on your own computer through Ollama (see [the AI assistant](#the-ai-assistant-runs-locally)).

<p align="center">
  <img src="docs/screenshots/landing.png" alt="Motion landing page" width="820">
</p>

## Features

| Area | What it does |
|---|---|
| **Accounts** | Register and log in. Passwords must have 8+ characters with an uppercase letter, a lowercase letter, a number and a special character. Passwords are stored salted and hashed (scrypt, through Werkzeug) |
| **Password reset** | "Forgot password?" emails a single-use link that expires after 30 minutes. Resetting logs out every device and sends a "password changed" notice. Logged-in users can change their password (🔑 in the sidebar). Email goes out over SMTP, or is printed in the terminal during development. See [Set up email](docs/SETUP.md#set-up-email-password-reset) |
| **Pages** | Create, edit and delete pages. Markdown-style editor with a Preview toggle, auto-save, tags, search across your pages, and export to a Markdown file |
| **Databases** | Notion-style databases with Name, Status, Priority and Due Date columns by default. Add or delete your own columns, filter and sort items, and switch between four views: **Table**, **Board**, **Calendar** and **List** |
| **AI assistant** | Chat with a local Llama model through Ollama, and use the **AI** button in the page editor to improve the clarity and grammar of your text. See [how the AI works](#the-ai-assistant-runs-locally) |
| **Interface** | Landing page, sidebar navigation, light and dark mode |

## The AI assistant (runs locally)

Motion's chatbot is **not** a cloud service like ChatGPT. It uses [Ollama](https://ollama.com), a free program that runs language models on your own computer, and Motion talks to it at `http://localhost:11434`. The default model is `llama3.1:8b`.

| Question | Answer |
|---|---|
| Where does the model run? | On your computer, through Ollama. Not on a server and not in the cloud |
| Is my text sent anywhere? | No. It goes only from Motion to Ollama on the same machine (`localhost`). Nothing is sent to an outside service |
| Do I need an account or an API key? | No. There is no key and no usage cost |
| Does it need internet? | Only once, to download the model (about 5 GB). After that it works offline |
| Where are my chats stored? | In the local database file `motion.db`, together with your pages |
| What if Ollama is not running? | Motion keeps working. The chat and the AI button show a clear error until you start Ollama |

What it does in the app:

- **AI chat.** Ask questions in a conversation, and keep several chats.
- **AI button.** In the page editor, it improves the clarity and grammar of your text.

Because this is a prototype running a small local model, expect some limits: answers can be wrong or generic, the first reply is slower while the model loads, and the speed depends on your computer. You can use a smaller or larger model with the `OLLAMA_MODEL` environment variable. To set it up, follow the [Ollama setup](docs/SETUP.md#set-up-the-ai-ollama).

## Screenshots

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/page-editor.png" alt="Page editor"><br><sub>Page editor with Preview, AI and Export</sub></td>
    <td width="50%"><img src="docs/screenshots/database-table.png" alt="Database table view"><br><sub>Database in Table view</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/database-calendar.png" alt="Database calendar view"><br><sub>The same database in Calendar view</sub></td>
    <td width="50%"><img src="docs/screenshots/database-list.png" alt="Database list view"><br><sub>List view with status and priority tags</sub></td>
  </tr>
</table>

More screens, including the Board view and dark mode, are in the [screenshot gallery](docs/screenshots/README.md). The data in the screenshots is sample data.

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Python 3, Flask 3.1 (Werkzeug 3.1), Flask-Limiter |
| Database | SQLite through the built-in `sqlite3` module |
| Frontend | Jinja2 templates, plain JavaScript, plain CSS (no frameworks) |
| Authentication | Flask signed sessions, scrypt password hashing, CSRF tokens, rate limiting |
| AI | [Ollama](https://ollama.com) running `llama3.1:8b` by default (change it with the `OLLAMA_MODEL` environment variable) |

## Quick start

You need Python 3.10 or newer and Git.

```bash
git clone https://github.com/Garuli/projects.git
cd projects/Motion
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Open **http://127.0.0.1:5001** and create an account.

- The app uses port **5001** because macOS uses port 5000 for AirPlay Receiver. To use another port, run `PORT=8000 python app.py`.
- The database file `motion.db` is created automatically in the folder you run the command from.
- On the first run the app creates `.secret_key` next to `app.py`. It signs the login cookies, so keep it private (it is in `.gitignore`).
- The chat and the AI button need Ollama. Everything else works without it. See [Ollama setup](docs/SETUP.md#set-up-the-ai-ollama).

A full guide for macOS, Windows and Linux, with troubleshooting, is in [docs/SETUP.md](docs/SETUP.md).

## Project structure

```
Motion/
├── README.md              ← this file
├── app.py                 ← Flask app: all routes and the Ollama calls
├── database.py            ← Database class: all SQL
├── mailer.py              ← sends email over SMTP (password reset)
├── requirements.txt       ← Python dependencies
├── requirements-dev.txt   ← extra tools for development (pytest, pip-audit)
├── templates/             ← HTML pages
├── static/                ← CSS and JavaScript served to the browser
│   ├── css/
│   └── js/
├── tests/                 ← automated security and password reset tests (pytest)
└── docs/                  ← documentation
    ├── screenshots/
    └── images/
```

| Path | What it contains | Details |
|---|---|---|
| `app.py` | Routes for accounts, password reset, pages, databases, chat, search, export and AI | [API reference](docs/API.md) |
| `database.py` | Table creation and every database query | [Database reference](docs/DATABASE.md) |
| `mailer.py` | Outgoing email (SMTP with STARTTLS), configured with `SMTP_*` and `MAIL_FROM` | [Setup: email](docs/SETUP.md#set-up-email-password-reset) |
| `templates/` | The 11 page templates and 2 email templates | [templates/README.md](templates/README.md) |
| `static/` | Stylesheets and scripts | [static/README.md](static/README.md) |
| `tests/` | Security tests for login, access control, CSRF, rate limits and XSS, plus the password reset flow | [tests/README.md](tests/README.md) |
| `docs/` | Setup, architecture, API, database, screenshots | [docs/README.md](docs/README.md) |

## Documentation

| Guide | What you will find |
|---|---|
| [Setup](docs/SETUP.md) | Step-by-step install, environment variables, email, Ollama, troubleshooting |
| [Architecture](docs/ARCHITECTURE.md) | How the pieces fit together, with diagrams |
| [API](docs/API.md) | Every route with its method, purpose and an example |
| [Database](docs/DATABASE.md) | Tables, columns and relationships |
| [Screenshots](docs/screenshots/README.md) | Every screen of the app |

## Notes and limitations

- **Safe defaults, still a development server.** The app listens only on `127.0.0.1` with debug mode off. `python app.py` uses Flask's built-in server, so put a production server (such as gunicorn) and HTTPS in front of it before letting other people use it. See [SETUP.md](docs/SETUP.md#environment-variables).
- **Secret key.** Read from `SECRET_KEY`, or generated once and saved to `.secret_key` (permissions `600`). Never commit that file.
- **Security hardening.** CSRF tokens on every write, rate-limited login, sign-up and password reset, hashed single-use reset tokens, a strict Content-Security-Policy, server-side session revocation on logout, and escaping of everything users type. Details and remaining gaps are in [ARCHITECTURE.md](docs/ARCHITECTURE.md#security).
- **Rate limits live in memory.** They reset when the app restarts and are per process. Behind a reverse proxy, configure `ProxyFix`, or all users will share one IP address.
- **AI features need Ollama.** If Ollama is not running, the chat and the AI button return a clear error instead of a reply.
- **Tests.** Run `pip install -r requirements-dev.txt` and then `python -m pytest tests/`. See [tests/README.md](tests/README.md).

## Credits

Motion started as a team project for a university Software Engineering course (Fall 2025). The logo was generated with ChatGPT. The original team repository, with the full commit history, is at [Garuli/SE-Fall-25-Project](https://github.com/Garuli/SE-Fall-25-Project).
