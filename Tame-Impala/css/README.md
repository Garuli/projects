# css/

| File | Purpose |
|---|---|
| `style.css` | All styling for every page |

## How `style.css` is organised

| Section | What it styles |
|---|---|
| `:root` | Colour and size variables (`--pink`, `--purple`, `--blue`, `--peach`, `--bg`). Change a colour here and the whole site follows |
| nav | The sticky header and the mobile menu (below 820 px) |
| hero | The gradient background and the 3D tilt cover |
| sections, cards, buttons | Shared building blocks used on every page |
| albums | Album cards and the full album layout |
| player | The video screen, controls and playlist |
| video cards | The lazy-loaded video thumbnails |
| tours, band, shop | Page-specific parts: table, timeline, member cards, cart |
| footer | Disclaimer and links |

## Responsive breakpoints

| Width | Change |
|---|---|
| 860 px | The player stacks above the playlist |
| 820 px | The menu becomes a Menu button, and the hero stacks |
| 700 px | Album layouts use one column |
| 640 px | The tours table becomes stacked rows |
