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

## Environment variables

All are optional.

| Variable | Default | What it does |
|---|---|---|
| `PORT` | `5001` | The port the app listens on |
| `SECRET_KEY` | a development value in `app.py` | Signs the login session cookie. Set your own if anyone else can reach the app |
| `OLLAMA_MODEL` | `llama3.1:8b` | The Ollama model used by the chat and the AI button |

Examples:

```bash
# macOS / Linux
PORT=8000 python app.py
OLLAMA_MODEL=llama3.2:3b python app.py
```

```powershell
# Windows PowerShell
$env:PORT = "8000"; python app.py
$env:OLLAMA_MODEL = "llama3.2:3b"; python app.py
```

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
| You are logged out after every restart | The session key changed | Set a fixed `SECRET_KEY` |

## Reset all data

Stop the app, delete `motion.db`, and start it again. The tables are created fresh. This removes every account, page, database and chat.

## Next

- See what the app looks like: [screenshots](screenshots/README.md)
- Understand how it works: [ARCHITECTURE.md](ARCHITECTURE.md)
