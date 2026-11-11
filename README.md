# Projects

A collection of the software projects I have built. Every project lives in its own folder with a README, setup instructions and documentation.

**Gjergj Garuli** · Software Engineering graduate · Tirana, Albania

## Projects

| Project | What it is | Built with | Status |
|---|---|---|---|
| [Motion](Motion/) | A Notion-style workspace: pages, databases with table, board, calendar and list views, and a local AI assistant | Python, Flask, SQLite, JavaScript, Ollama | Working. Team course project |

More projects will be added here as I clean them up and document them.

## Repository layout

```
projects/
├── README.md          ← you are here
├── .gitignore         ← keeps virtual environments, databases and secrets out of git
├── .gitattributes     ← keeps line endings consistent across Windows, macOS and Linux
└── Motion/            ← the Motion project (see Motion/README.md)
    ├── README.md
    ├── app.py
    ├── database.py
    ├── requirements.txt
    ├── templates/     ← HTML pages
    ├── static/        ← CSS and JavaScript
    │   ├── css/
    │   └── js/
    └── docs/          ← setup guide, architecture, API, database, screenshots
        ├── screenshots/
        └── images/
```

## How each project folder is organised

| Item | Purpose |
|---|---|
| `README.md` | What the project is, what it does, and how to run it in a few commands |
| Source files and folders | The code. Each folder has its own `README.md` that explains what is inside |
| `docs/` | Longer documentation: detailed setup, architecture, API and database reference, screenshots |

## Running a project

Open the project's folder and follow its README. For Motion:

```bash
git clone https://github.com/Garuli/projects.git
cd projects/Motion
```

Then continue with the quick start in [Motion/README.md](Motion/README.md).
