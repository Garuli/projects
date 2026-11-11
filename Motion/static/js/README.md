# static/js/

The JavaScript of Motion. Plain JavaScript that talks to the Flask API with `fetch`. There are no libraries.

| File | Lines | What it does | Loaded by |
|---|---|---|---|
| `main.js` | 464 | The app shell and the page editor: light/dark toggle (remembered in `localStorage`), sidebar and search, Markdown preview, auto-save, tags, export to Markdown, and the **AI** button that improves your text | `base.html` (every page inside the app) |
| `database.js` | 711 | Everything in the database screen: draws the Table, Board, Calendar and List views, adds, edits and deletes items and columns, and applies filters and sorting | `database.html` |
| `chat.js` | 75 | The AI chat: sends your message to the server and shows the reply | `chat.html` |
| `auth.js` | 139 | The login and register forms, including the live password checklist | `login.html`, `register.html` |
| `landing.js` | 33 | Small interactions on the landing page | `landing.html` |

## API calls made by each script

| Script | Calls |
|---|---|
| `main.js` | `/api/search`, `/api/pages/<id>` (save), `/api/pages/<id>/tags`, `/api/export/<id>`, `/api/ai/improve` |
| `database.js` | `/api/databases/<id>`, `/api/databases/<id>/items`, `/api/items/<id>`, `/api/databases/<id>/properties`, `/api/databases/<id>/filter` |
| `chat.js` | `/api/chats`, `/api/chats/<id>/messages` |
| `auth.js` | `/login`, `/register` |

Details of every route are in the [API reference](../../docs/API.md).

## Related

- Templates that load these files: [`../../templates/`](../../templates/README.md)
- Stylesheets: [`../css/`](../css/README.md)
