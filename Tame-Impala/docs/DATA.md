# Editing the content (`js/data.js`)

Every page reads from `window.TI`, defined in `js/data.js`. Edit it, save, and refresh the browser.

| Key | Used by | Fields |
|---|---|---|
| `albums` | Home, Albums | `id`, `title`, `year`, `date`, `cover`, `blurb`, `tracks` (list of names) |
| `songs` | Music player, Albums | `title`, `album`, `year`, `yt` (YouTube id), `kind` |
| `live` | Live | `title`, `where`, `yt`, `note` |
| `films` | Films | `title`, `length`, `yt`, `blurb` |
| `tours.upcoming` | Tours, Home | `date`, `city`, `venue`, `extra` |
| `tours.past` | Tours | `name`, `year`, `text` |
| `band` | Band | `name`, `role`, `text` |
| `timeline` | Band | `[year, text]` pairs |
| `shop` | Shop | `id`, `name`, `price`, `color` |

## Add a song to the player

1. Open the video on YouTube. The id is the part after `v=` in the address, for example `pFptt7Cargc`.
2. Add a line to `songs`:

```js
{ title: "Song name", album: "Album name", year: 2020, yt: "VIDEO_ID", kind: "Official video" },
```

3. If the song is on an album with that exact `album` name and title in its `tracks` list, it turns pink on the Albums page automatically.

## Check that a video can be embedded

Some uploads block embedding. Open `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=VIDEO_ID&format=json` in the browser. If you see JSON, it works. If you see an error such as `401`, `403` or `404`, pick another upload.

## Add a tour date

Add a line to `tours.upcoming`, in date order:

```js
{ date: "12 Jul 2027", city: "City", venue: "Venue", extra: "Festival" },
```

The countdown on the Tours page uses the date set in `app.js` (`first`), so change it there if the first show changes.

## Album covers

`cover` uses the helper `COVER(path, file)`, which builds a Wikimedia thumbnail address. To use a local image instead, save it in an `img/` folder and write `cover: "img/lonerism.jpg"`.
