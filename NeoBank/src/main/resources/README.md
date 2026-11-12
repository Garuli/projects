# resources/

| File | Purpose |
|---|---|
| `application.properties` | Server port, database, JWT and H2 console settings. Secrets come from environment variables |
| `application-dev.properties` | Extra logging for development. Turn it on with `-Dspring.profiles.active=dev` |
| `static/index.html` | Page shell: login screen, app layout, tab bar |
| `static/app.css` | Dark theme, cards, charts, responsive rules (phone below 860 px) |
| `static/app.js` | All screens, API calls, SVG charts and hash routing. No framework |
