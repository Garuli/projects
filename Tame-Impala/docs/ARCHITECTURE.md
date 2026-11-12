# Architecture

The site is static: there is no server code and no database. The browser loads an HTML page, and JavaScript fills it in from one data file.

```mermaid
flowchart LR
    H["HTML page<br/>(index, music, tours ...)"] --> D["js/data.js<br/>all content"]
    H --> A["js/app.js<br/>draws the page"]
    D --> A
    H --> C["css/style.css"]
    A -->|"IFrame API"| Y["YouTube player"]
    A -->|"localStorage"| S["Saved cart"]
    A -->|"img tags"| W["Wikimedia covers"]
```

## Layers

| Layer | File | Responsibility |
|---|---|---|
| Structure | `*.html` | Each page is a small shell with empty containers such as `<div id="albums">` |
| Content | `js/data.js` | The only place where songs, dates and names are written |
| Behaviour | `js/app.js` | Fills the containers, shares the header and footer, runs the player and cart |
| Looks | `css/style.css` | All colours, layout and responsive rules |

## Example: playing a song

```mermaid
sequenceDiagram
    participant U as Visitor
    participant A as app.js
    participant Y as YouTube player

    U->>A: clicks a song in the playlist
    A->>A: looks up the video id in data.js
    A->>Y: loadVideoById(id)
    Y-->>A: state: playing
    A-->>U: button changes to pause, progress bar moves
    Y-->>A: state: ended
    A->>Y: loads the next song
    Note over A,Y: If the video cannot be embedded, onError shows a message and a YouTube search link
```

## Design choices

| Choice | Why |
|---|---|
| Plain HTML, CSS and JavaScript | No tools to install. Edit a file and refresh |
| One data file | Changing a date or adding a song is one edit, and every page updates |
| YouTube embeds, not self-hosted audio | The music belongs to the artist. Playing it through the official channel is legal and free |
| `youtube-nocookie.com` | Fewer tracking cookies before the visitor presses play |
| Thumbnails first on Live and Films | The page does not load a dozen players until someone wants one |
| Gradient fallback for covers | If an image cannot load, the card still looks right |
| Header and footer written by JavaScript | The menu is defined once, not copied into eight files |

## Known limits

| Limit | Effect | Possible improvement |
|---|---|---|
| Needs the internet for videos, covers and fonts | Does not work offline | Save the covers into the repository |
| Videos can be removed or blocked by their owners | A song may show an error message | Re-check the ids from time to time |
| Menu and content need JavaScript | Without it the pages are mostly empty | Generate the pages with a small build script |
| Demo shop only | No real products or payments | Link to the official store |
