# static/css/

The stylesheets of Motion. Plain CSS, no preprocessor.

| File | Lines | Styles | Loaded by |
|---|---|---|---|
| `style.css` | 721 | The app shell: sidebar, buttons, page editor and the overall theme | `base.html` (every page inside the app) |
| `database.css` | 933 | Databases: toolbar, table, Kanban board, calendar, list view and their tags | `base.html` |
| `landing.css` | 677 | The public landing page: hero, feature sections and buttons | `landing.html` |
| `auth.css` | 319 | The login and register cards, including the password checklist | `login.html`, `register.html` |

## Which file do I edit?

| I want to change... | Edit |
|---|---|
| The sidebar, buttons or editor | `style.css` |
| How a database view looks | `database.css` |
| The home page before login | `landing.css` |
| The login or sign-up forms | `auth.css` |

## Related

- Templates that load these files: [`../../templates/`](../../templates/README.md)
- Scripts: [`../js/`](../js/README.md)
