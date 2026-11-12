# static/js/

The JavaScript of Motion. Plain JavaScript that talks to the Flask API with `fetch`. There are no libraries.

| File | Lines | What it does | Loaded by |
|---|---|---|---|
| `csrf.js` | 24 | Wraps `window.fetch` so every same-origin request that is not GET sends the CSRF token from `<meta name="csrf-token">` as an `X-CSRF-Token` header. Must load before the other scripts | `base.html` and every page that loads `auth.js` |
| `main.js` | 528 | The app shell and the page editor: light/dark toggle (remembered in `localStorage`), sidebar and search, Markdown preview, auto-save, tags, export to Markdown, and the **AI** button that improves your text. Also reads the page data block and dispatches `data-action` buttons (see below) | `base.html` (every page inside the app) |
| `database.js` | 717 | Everything in the database screen: draws the Table, Board, Calendar and List views, adds, edits and deletes items and columns, and applies filters and sorting | `database.html` |
| `chat.js` | 77 | The AI chat: sends your message to the server and shows the reply | `chat.html` |
| `auth.js` | 236 | The login, register, forgot-password, reset-password and change-password forms, including the live password checklist | `login.html`, `register.html`, `forgot_password.html`, `reset_password.html`, `change_password.html` |
| `landing.js` | 33 | Small interactions on the landing page | `landing.html` |

## API calls made by each script

| Script | Calls |
|---|---|
| `main.js` | `/api/search`, `/api/pages/<id>` (save), `/api/pages/<id>/tags`, `/api/export/<id>`, `/api/ai/improve` |
| `database.js` | `/api/databases/<id>`, `/api/databases/<id>/items`, `/api/items/<id>`, `/api/databases/<id>/properties`, `/api/databases/<id>/filter` |
| `chat.js` | `/api/chats`, `/api/chats/<id>/messages` |
| `auth.js` | `/login`, `/register`, `/forgot-password`, `/reset-password/<token>`, `/account/password` |

Details of every route are in the [API reference](../../docs/API.md).

## Rules for the Content-Security-Policy

The server sends a CSP that blocks inline JavaScript and inline styles, so:

- **No `onclick="..."` (or any `on...=` attribute).** Give the element `data-action="name"` and add `name` to `actionHandlers` (in `main.js`, or with `Object.assign(actionHandlers, {...})` in a page script). `main.js` calls the handler as `handler(element, event)`.
- **No inline `<script>` blocks.** Templates pass data in `<script type="application/json" id="motion-data">`, which `main.js` parses into `motionData`. Page scripts (`database.js`, `chat.js`) go in the `scripts` block of the template so they load after `main.js`.
- **No `style="..."` attributes in templates.** Use a CSS class. Setting `element.style` from JavaScript is fine.
- **Never put user text into `innerHTML` unescaped.** Use `textContent`, build elements with `document.createElement`, or wrap the value in `escapeHtml()` (from `main.js`, safe for element content and quoted attributes).

## Related

- Templates that load these files: [`../../templates/`](../../templates/README.md)
- Stylesheets: [`../css/`](../css/README.md)
