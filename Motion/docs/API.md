# API reference

Every route in `app.py`. Routes that return HTML render a template. Routes under `/api/` return JSON.

## Conventions

| Topic | Rule |
|---|---|
| Login | Everything except the landing, login, register, logout, forgot-password and reset-password routes needs a logged-in session. Without one, the request is redirected to the landing page (HTTP `302`), for the API routes too. Sessions end 8 hours after login, on logout, and when the user's `session_version` changes |
| CSRF | Every `POST`, `PUT` and `DELETE` (including `/login`, `/register` and the JSON API) must send the session's CSRF token in an `X-CSRF-Token` header (or, for plain HTML forms, a `csrf_token` field). The token is in `<meta name="csrf-token">` on every page, and `static/js/csrf.js` adds the header to `fetch` calls automatically. A missing or wrong token gives `403` with `{"error": "Invalid or missing CSRF token"}` |
| Rate limits | `POST /login`: 5 per minute and 20 per hour per IP. `POST /register`: 10 per hour per IP. `POST /forgot-password`: 3 per hour per email and 10 per hour per IP. `POST /reset-password/<token>`: 10 per hour per IP. `POST /account/password`: 5 per minute and 20 per hour per IP. 5 failed logins for one email within 15 minutes lock that email for 15 minutes. Over the limit gives `429` with a JSON `error` |
| Ownership | A page, database, item, column or chat that belongs to another user is treated as not found (`404`) |
| Success | JSON such as `{"success": true, ...}` |
| Errors | JSON such as `{"error": "message"}` with an HTTP status (`400`, `403`, `404`, `413`, `429`, `503`). `/login`, `/register` and the password routes use `{"success": false, "message": "..."}` for their own validation errors |
| AI errors | If Ollama is not running or gives no answer, the AI routes return `503` with a message |
| Request bodies | A JSON object with `Content-Type: application/json`, at most 1 MB (`413` otherwise). A body that is not a JSON object, or fields with the wrong type or over their length limit, give `400` |

## Pages (HTML)

| Method | Path | Login | Purpose |
|---|---|---|---|
| GET | `/` | no | Landing page (redirects to the dashboard when logged in) |
| GET, POST | `/register` | no | Sign-up form. POST body: `name`, `email`, `password` |
| GET, POST | `/login` | no | Login form. POST body: `email`, `password` |
| GET, POST | `/forgot-password` | no | "Forgot password?" form. POST body: `email`. See [Password reset](#password-reset) |
| GET, POST | `/reset-password/<token>` | no | New-password form from the emailed link. POST body: `password` |
| GET, POST | `/account/password` | yes | Change password. POST body: `current_password`, `new_password` |
| POST | `/logout` | no | Ends the session and revokes all of the user's session cookies, then redirects to `/`. Needs the CSRF token. `GET` gives `405` |
| GET | `/dashboard` | yes | Welcome screen |
| GET | `/page/<id>` | yes | Page editor |
| GET | `/database/<id>` | yes | Database with its views |
| GET | `/chat` | yes | Chat home |
| GET | `/chat/<id>` | yes | One chat |

## Password reset

| Request | Response |
|---|---|
| `POST /forgot-password` `{"email": "..."}` | Always `200` `{"success": true, "message": "If an account exists for that email, we've sent a reset link."}`, whether or not the account exists. The lookup and the email run in a background thread, so the timing is the same too. A malformed email gives `400`. Over a limit gives `429` with a message saying which limit (this email, or your network) |
| `GET /reset-password/<token>` | `200` with the new-password form if the token is valid, otherwise `400` with a "link is invalid or expired" page and a link to request a new one. Always sends `Cache-Control: no-store` and `Referrer-Policy: no-referrer` |
| `POST /reset-password/<token>` `{"password": "..."}` | `200` `{"success": true, "redirect": "/login"}`. The password is changed, the token is used up, every session of that user is logged out, the browser's own session is cleared (no auto-login) and the login page shows "Password changed. Please log in." An invalid, expired or used token, or a password that breaks the rules, gives `400` `{"success": false, "message": "..."}` |
| `POST /account/password` `{"current_password": "...", "new_password": "..."}` | `200` `{"success": true, "message": "..."}`. Every other session is logged out, this one stays logged in. A wrong current password or a weak new one gives `400` |

Tokens are single-use, expire after 30 minutes, and a new request cancels the previous link. A successful reset or change also emails a "Your password was changed" notice. The password rules are the same as for `/register`. Details: [ARCHITECTURE.md](ARCHITECTURE.md#password-reset).

## Pages API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/pages` | List your pages |
| POST | `/api/pages` | Create a page. Body: `title`, `content` |
| GET | `/api/pages/<id>` | Get one page |
| PUT | `/api/pages/<id>` | Update a page (used by auto-save) |
| DELETE | `/api/pages/<id>` | Delete a page |
| POST | `/api/pages/<id>/tags` | Set the tags of a page. Body: `{"tags": ["study", "ideas"]}`. This **replaces** the page's current tags |
| GET | `/api/search?q=<text>` | Search your pages |
| GET | `/api/export/<id>` | Download a page as a Markdown file |

## Databases API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/databases` | List your databases |
| POST | `/api/databases` | Create a database. Body: `title`. It starts with the columns **Name**, **Status**, **Priority** and **Due Date** |
| GET | `/api/databases/<id>` | Get one database. The answer has three parts: `database`, `properties` (the columns) and `items` |
| PUT | `/api/databases/<id>` | Update a database. Body: `title`, `view_type` |
| DELETE | `/api/databases/<id>` | Delete a database |
| POST | `/api/databases/<id>/items` | Add an item. Body: `{"properties": {"Name": "...", "Status": "...", ...}}` |
| GET, PUT, DELETE | `/api/items/<id>` | Read, update or delete one item |
| POST | `/api/databases/<id>/properties` | Add a column. Body: `name`, `type`, optional `options` |
| DELETE | `/api/properties/<id>` | Delete a column (only if its database is yours, otherwise `404`) |
| POST | `/api/databases/<id>/filter` | Filter and sort items (see below) |

### Filter and sort

Body of `POST /api/databases/<id>/filter`:

```json
{
  "filters": [
    {"property": "Status", "operator": "equals", "value": "Done"}
  ],
  "sort_by": "Due Date",
  "sort_order": "asc"
}
```

| Operator | Keeps items where... |
|---|---|
| `equals` | the value equals `value` |
| `contains` | the value contains `value`, ignoring case |
| `is_empty` | the property has no value |
| `is_not_empty` | the property has a value |

`sort_order` is `asc` (default) or `desc`. The answer is `{"items": [...], "count": N}`.

## Chat and AI API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/chats` | List your chats |
| POST | `/api/chats` | Start a new chat. Optional body: `title` (defaults to `New Chat`) |
| GET | `/api/chats/<id>/messages` | Read the messages of a chat |
| POST | `/api/chats/<id>/messages` | Send a message. The server asks Ollama and stores both the message and the reply |
| POST | `/api/ai/improve` | Improve a piece of text with the AI. Body: `content`. Answer: `{"success": true, "improved": "..."}`. Errors: `400` if the text is empty, `503` if Ollama is not running, `500` for anything unexpected |

## Try it with curl

Register an account in the browser first. Every write needs the CSRF token, which you can read from any page. Log in and keep the session cookie:

```bash
# get a session cookie and its CSRF token
TOKEN=$(curl -s -c cookies.txt http://127.0.0.1:5001/login \
  | sed -n 's/.*name="csrf-token" content="\([0-9a-f]*\)".*/\1/p')

# log in (the session is replaced, so read the new token afterwards)
curl -s -b cookies.txt -c cookies.txt -X POST http://127.0.0.1:5001/login \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $TOKEN" \
  -d '{"email":"you@example.com","password":"YourPassword1!"}'
TOKEN=$(curl -s -b cookies.txt -c cookies.txt http://127.0.0.1:5001/dashboard \
  | sed -n 's/.*name="csrf-token" content="\([0-9a-f]*\)".*/\1/p')

# create a page
curl -s -b cookies.txt -X POST http://127.0.0.1:5001/api/pages \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $TOKEN" \
  -d '{"title":"Hello","content":"# Hello from curl"}'

# list your pages
curl -s -b cookies.txt http://127.0.0.1:5001/api/pages

# create a database and add an item
curl -s -b cookies.txt -X POST http://127.0.0.1:5001/api/databases \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $TOKEN" -d '{"title":"Tasks"}'
curl -s -b cookies.txt -X POST http://127.0.0.1:5001/api/databases/1/items \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $TOKEN" \
  -d '{"properties":{"Name":"Write README","Status":"To Do","Priority":"High","Due Date":"2026-11-20"}}'
```

## Related

- How requests are handled: [ARCHITECTURE.md](ARCHITECTURE.md)
- The tables behind these routes: [DATABASE.md](DATABASE.md)
