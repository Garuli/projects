# templates/

The HTML pages of Motion. They are [Jinja2](https://jinja.palletsprojects.com) templates that Flask renders in `app.py`.

## Files

| File | Shown at | Purpose | Extends `base.html` | Loads |
|---|---|---|---|---|
| `base.html` | not shown on its own | The shared layout for every page inside the app: sidebar with your pages, databases and chats, search box, **New Page / New Database / Open Chat** buttons, and the light/dark toggle | no (it is the base) | `style.css`, `database.css`, `main.js` |
| `landing.html` | `/` | Public home page for visitors who are not logged in | no | `landing.css`, `landing.js` |
| `login.html` | `/login` | Login form | no | `auth.css`, `auth.js` |
| `register.html` | `/register` | Sign-up form with a live password checklist | no | `auth.css`, `auth.js` |
| `dashboard.html` | `/dashboard` | Welcome screen after login with shortcuts to create a page or a database | yes | |
| `page.html` | `/page/<id>` | The page editor: title, tags, Markdown editor, Preview, AI and Export buttons | yes | |
| `database.html` | `/database/<id>` | A database with its view switcher (Table, Board, Calendar, List) and the toolbar | yes | `database.js` |
| `chat.html` | `/chat`, `/chat/<id>` | The AI chat | yes | `chat.js` |

## How the templates fit together

```
base.html  ──extends──►  dashboard.html
           ──extends──►  page.html
           ──extends──►  database.html
           ──extends──►  chat.html

landing.html, login.html, register.html   (standalone, with their own CSS and JS)
```

`base.html` defines three blocks that child templates fill in:

| Block | Used for |
|---|---|
| `title` | The browser tab title |
| `content` | The main area to the right of the sidebar |
| `scripts` | Extra scripts that only one page needs (`database.js`, `chat.js`) |

## Related

- Styles for these pages: [`../static/css/`](../static/css/README.md)
- Scripts for these pages: [`../static/js/`](../static/js/README.md)
- Routes that render them: [API reference](../docs/API.md)
