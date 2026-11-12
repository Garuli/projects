# static/

The files the browser downloads directly: stylesheets and JavaScript. Flask serves this folder automatically, and the templates reference the files with `url_for('static', filename='...')`.

## Structure

```
static/
├── README.md
├── css/    ← how the app looks
└── js/     ← how the app behaves
```

| Folder | Contents | Details |
|---|---|---|
| `css/` | 4 stylesheets | [css/README.md](css/README.md) |
| `js/` | 6 scripts | [js/README.md](js/README.md) |

There are no frameworks or build steps. The CSS and JavaScript are plain files, so editing one and refreshing the browser is enough to see the change.
