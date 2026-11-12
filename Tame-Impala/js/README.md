# js/

| File | Purpose |
|---|---|
| `data.js` | All the content: albums, songs, videos, tours, band, timeline and shop items. See [docs/DATA.md](../docs/DATA.md) |
| `app.js` | Builds the header and footer, draws each page from the data, and runs the player, hero tilt, countdown and cart |

## How `app.js` works

`app.js` checks which elements exist on the current page and only runs the code for those. For example, if the page has `#yt` it starts the player, and if it has `#shop` it builds the cart.

| Element id | Page | Code that runs |
|---|---|---|
| `#home-albums`, `#home-next` | Home | Album cards and the next three shows |
| `.tilt` | Home | 3D tilt that follows the mouse or finger |
| `#albums` | Albums | Album cards with tracklists linked to the player |
| `#yt` | Music | YouTube player, playlist and controls |
| `#live`, `#films` | Live, Films | Thumbnails that load the video on click |
| `#upcoming`, `#past`, `#countdown`, `#timeline` | Tours, Band | Tables, cards and countdown |
| `#band` | Band | Member cards |
| `#shop` | Shop | Products and the cart saved in `localStorage` |

All text from `data.js` is escaped before it is put on the page, so content can never inject HTML.
