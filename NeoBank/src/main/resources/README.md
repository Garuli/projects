# resources/

| File | Purpose |
|---|---|
| `application.properties` | Server port, database, JWT and H2 console settings. Secrets come from environment variables |
| `application-dev.properties` | Extra logging for development. Turn it on with `-Dspring.profiles.active=dev` |
| `static/index.html` | The whole dashboard: HTML, CSS and JavaScript in one file, served at `/` |
