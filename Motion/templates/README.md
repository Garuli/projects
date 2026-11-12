# templates/

The HTML pages of Motion. They are [Jinja2](https://jinja.palletsprojects.com) templates that Flask renders in `app.py`.

## Files

| File | Shown at | Purpose | Extends `base.html` | Loads |
|---|---|---|---|---|
| `base.html` | not shown on its own | The shared layout for every page inside the app: sidebar with your pages, databases and chats, search box, **New Page / New Database / Open Chat** buttons, and the light/dark toggle | no (it is the base) | `style.css`, `database.css`, `csrf.js`, `main.js` |
| `landing.html` | `/` | Public home page for visitors who are not logged in | no | `landing.css`, `landing.js` |
| `login.html` | `/login` | Login form | no | `auth.css`, `csrf.js`, `auth.js` |
| `register.html` | `/register` | Sign-up form with a live password checklist | no | `auth.css`, `csrf.js`, `auth.js` |
| `forgot_password.html` | `/forgot-password` | Asks for an email and always shows the same "if an account exists" message | no | `auth.css`, `csrf.js`, `auth.js` |
| `reset_password.html` | `/reset-password/<token>` | New-password form with the live checklist when `valid` is true, otherwise an "invalid or expired" message with a link to request a new one. Its URL holds the token, so it loads first-party files only | no | `auth.css`, `csrf.js`, `auth.js` |
| `change_password.html` | `/account/password` | Current + new password for a logged-in user (🔑 in the sidebar) | no | `auth.css`, `csrf.js`, `auth.js` |
| `email/reset_password.html` | in the reset email | HTML part of the reset email (the plain-text part is built in `app.py`) | no | nothing |
| `email/password_changed.html` | in the notification email | HTML part of the "Your password was changed" email | no | nothing |
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

landing.html, login.html, register.html,
forgot_password.html, reset_password.html,
change_password.html                      (standalone, with their own CSS and JS)

email/*.html                              (rendered into emails, never served as pages)
```

`base.html` defines three blocks that child templates fill in:

| Block | Used for |
|---|---|
| `title` | The browser tab title |
| `content` | The main area to the right of the sidebar |
| `scripts` | Extra scripts that only one page needs (`database.js`, `chat.js`). They load after `main.js`, which they depend on |

## Security rules for templates

- Every template has `<meta name="csrf-token" content="{{ csrf_token() }}">` (child templates get it from `base.html`).
- No inline JavaScript, `onclick=` handlers or `style=` attributes: the Content-Security-Policy blocks them. Pass data in `<script type="application/json" id="motion-data">{{ {...}|tojson }}</script>` and use `data-action` on buttons. See [static/js/README.md](../static/js/README.md#rules-for-the-content-security-policy).
- Logout is a `POST` form with a hidden `csrf_token` field, not a link.
- Let Jinja2 escape values (`{{ value }}`). Never use `|safe` on user data.
- The email templates in `email/` are the exception to the `style=` rule: email clients ignore stylesheets, so they use inline styles. The CSP does not apply to email, and these files are never served to the browser.

## Related

- Styles for these pages: [`../static/css/`](../static/css/README.md)
- Scripts for these pages: [`../static/js/`](../static/js/README.md)
- Routes that render them: [API reference](../docs/API.md)
