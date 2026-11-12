# Projects

A collection of the software projects I have built. Every project lives in its own folder with a README, setup instructions and documentation.

**Gjergj Garuli** · Software Engineering graduate · Tirana, Albania

## Projects

| Project | What it is | Built with | Status |
|---|---|---|---|
| [Motion](Motion/) | A Notion-style workspace prototype: pages, databases with table, board, calendar and list views, and a local AI assistant (Ollama, runs on your computer) | Python, Flask, SQLite, JavaScript, Ollama | Working. Team course project |
| [NeoBank](NeoBank/) | A banking system with a web dashboard and REST API: accounts, transfers with business rules, transaction history, reports, JWT login and tests | Java 21, Spring Boot, JPA, H2, JWT, Maven | Working. Also used as a Software Engineering course project at UNYT |
| [Tame Impala fan site](Tame-Impala/) | An unofficial multi-page fan site: an in-page music player with official videos, album pages with real covers, live clips, short films, tour dates and a demo shop | HTML, CSS, JavaScript, YouTube IFrame API | Working. Web development class project, rebuilt with real data |

More projects will be added here as I clean them up and document them.

## Repository layout

```
projects/
├── README.md          ← you are here
├── .gitignore         ← keeps virtual environments, databases and secrets out of git
├── .gitattributes     ← keeps line endings consistent across Windows, macOS and Linux
├── NeoBank/           ← the banking app (see NeoBank/README.md)
│   ├── README.md
│   ├── pom.xml
│   ├── src/           ← main/java (code), main/resources (settings, dashboard), test/
│   └── docs/          ← architecture, API, database, screenshots
├── Tame-Impala/       ← the fan site (see Tame-Impala/README.md)
│   ├── README.md
│   ├── index.html, music.html, albums.html, live.html, tours.html, films.html, band.html, shop.html
│   ├── css/           ← style.css
│   ├── js/            ← data.js (content) and app.js (behaviour)
│   └── docs/          ← architecture, data guide, screenshots
└── Motion/            ← the Motion project (see Motion/README.md)
    ├── README.md
    ├── app.py
    ├── database.py
    ├── mailer.py
    ├── requirements.txt
    ├── requirements-dev.txt
    ├── templates/     ← HTML pages
    ├── static/        ← CSS and JavaScript
    │   ├── css/
    │   └── js/
    ├── tests/         ← automated security and password reset tests
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

Open the project's folder and follow its README. Each project has its own quick start. For Motion:

```bash
git clone https://github.com/Garuli/projects.git
cd projects/Motion
```

Then continue with the quick start in [Motion/README.md](Motion/README.md).

For NeoBank (needs Java 21 and Maven):

```bash
cd projects/NeoBank
mvn spring-boot:run
```

Then open http://localhost:8080. More details are in [NeoBank/README.md](NeoBank/README.md).

For the Tame Impala fan site, which needs no installation:

```bash
cd projects/Tame-Impala
python3 -m http.server 8000
```

Then open http://localhost:8000. More details are in [Tame-Impala/README.md](Tame-Impala/README.md).
