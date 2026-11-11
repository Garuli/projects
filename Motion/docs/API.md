# API reference

Every route in `app.py`. Routes that return HTML render a template. Routes under `/api/` return JSON.

## Conventions

| Topic | Rule |
|---|---|
| Login | Everything except the landing, login, register and logout routes needs a logged-in session. Without one, the request is redirected to the landing page (HTTP `302`), for the API routes too |
| Ownership | A page, database, item, column or chat that belongs to another user is treated as not found (`404`) |
| Success | JSON such as `{"success": true, ...}` |
| Errors | JSON such as `{"error": "message"}` with an HTTP status (`400`, `404`, `503`) |
| AI errors | If Ollama is not running or gives no answer, the AI routes return `503` with a message |
| Request bodies | JSON with `Content-Type: application/json` |

## Pages (HTML)

| Method | Path | Login | Purpose |
|---|---|---|---|
| GET | `/` | no | Landing page (redirects to the dashboard when logged in) |
| GET, POST | `/register` | no | Sign-up form. POST body: `name`, `email`, `password` |
| GET, POST | `/login` | no | Login form. POST body: `email`, `password` |
| GET | `/logout` | no | Ends the session |
| GET | `/dashboard` | yes | Welcome screen |
| GET | `/page/<id>` | yes | Page editor |
| GET | `/database/<id>` | yes | Database with its views |
| GET | `/chat` | yes | Chat home |
| GET | `/chat/<id>` | yes | One chat |

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
| DELETE | `/api/properties/<id>` | Delete a column (only if its database is yours) |
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

Register an account in the browser first, then log in and keep the session cookie:

```bash
# log in and save the cookie
curl -s -c cookies.txt -X POST http://127.0.0.1:5001/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"YourPassword1!"}'

# create a page
curl -s -b cookies.txt -X POST http://127.0.0.1:5001/api/pages \
  -H "Content-Type: application/json" \
  -d '{"title":"Hello","content":"# Hello from curl"}'

# list your pages
curl -s -b cookies.txt http://127.0.0.1:5001/api/pages

# create a database and add an item
curl -s -b cookies.txt -X POST http://127.0.0.1:5001/api/databases \
  -H "Content-Type: application/json" -d '{"title":"Tasks"}'
curl -s -b cookies.txt -X POST http://127.0.0.1:5001/api/databases/1/items \
  -H "Content-Type: application/json" \
  -d '{"properties":{"Name":"Write README","Status":"To Do","Priority":"High","Due Date":"2026-11-20"}}'
```

## Related

- How requests are handled: [ARCHITECTURE.md](ARCHITECTURE.md)
- The tables behind these routes: [DATABASE.md](DATABASE.md)
