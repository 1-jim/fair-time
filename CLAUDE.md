# Fair Time - notes for Claude Code

Fair game-time rotation app for Wimborne RFC age-grade rugby. Coaches import a Spond attendee export, pick a substitution plan, and the app runs subs live on the touchline, handling no-shows, injuries and late arrivals. Hosted on GitHub Pages as a static PWA.

## Hard rules

- **No em dashes anywhere** (code, comments, UI copy, docs). Use hyphens.
- **No build step, no runtime dependencies.** The app is one file, `index.html`. Only Google Fonts load from outside, and the app must work if they fail. Do not add CDN scripts: the iOS Claude app blocked the old SheetJS CDN load, which is why the xlsx reader is built in.
- **Never store or commit personal data.** The Spond file contains parents' names, phones, emails, addresses and children's dates of birth. Only player names and responses may be read into state. Never commit a real Spond export; use `tests/fixtures/spond-sample.xlsx` (fake names).
- **Relative paths only** (`guide.html`, `sw.js`, `icons/...`). Pages serves the app from `/<repo>/`, not the domain root.
- **Every release: bump `VERSION` in `sw.js`**, or installed phones keep the old cached app.
- **Guide changes:** edit `USER_GUIDE.md`, then run `npm run guide` to regenerate `guide.html`. When a user-facing feature changes, update the guide in the same change.
- Plain, active UI copy in sentence case, written for volunteer parent coaches on a phone, often in the rain. Touch targets at least 44px.

## Layout

| Path | What |
| --- | --- |
| `index.html` | Entire app: CSS, markup shell, JS |
| `sw.js` | Offline cache (network-first pages, cache-first assets) and the Android share target (`POST ./share`) |
| `manifest.webmanifest` | PWA install, icons, `share_target` |
| `USER_GUIDE.md` / `guide.html` | Coach guide source / rendered page linked from the app |
| `build_guide.py` | Markdown to `guide.html` (needs `pip install markdown`) |
| `tests/` | Playwright suite and fake Spond fixture |

## How the app works (index.html)

State is one object `S`, saved to `localStorage["wimborne-fairtime-v1"]` with `v: 1`. If the shape changes incompatibly, add a migration in `load()` rather than bumping the key, or coaches lose a match day mid-way.

Engine (pure-ish, reused by the simulator):
- Each team in `S.T[teamId]` has player states `ps[pid]` with `st` (`field|bench|injured|concussed|absent|late|lent`), `on` (ms played), `ent` (fair-share entitlement ms), per-game `gOn`.
- `settle(t)` advances time: every available player earns `dt * playing / available` of entitlement. Injured, late or absent players earn nothing, so a late arrival is never "owed" the time before they arrived.
- `lists(t)` ranks field (most ahead first) and bench (most behind first). Deficits are rounded to 5 s buckets (`dd`) to stop ties flickering.
- `planPairs` = in-play swaps (only applied if beneficial), `breakPairs` = full reshuffle at half-time or between games, `fillPairs` = cover for missing players.
- Clock is wall-clock based (`acc` + `Date.now() - res`), so locking the phone or reloading never loses time. Half-time and full-time never stop the clock automatically; the coach taps on the whistle.
- `simulate(n, k, iv)` runs a whole match day through the same engine to score each plan; `strategies(n)` ranks them (fairness gap, stoppages, longest rest).
- Suspected concussion locks a player out for the day by design. Do not add a quick "return" path for it.

UI:
- `render()` rebuilds the view from `S`. The 250 ms `tick()` only re-renders when `gameSig()` changes; otherwise `liveUpdate()` patches `[data-live]` text. Re-rendering every tick replaces buttons mid-tap, so anything that changes the structure of the Match screen must be reflected in `gameSig()`.
- Clicks are delegated: `data-a="name"` calls `A.name(dataset)`, then `save()` and `render()`. File inputs use `data-ch` and `C`.
- Transient UI state lives in `UI`, not `S`.
- Downloads use the Claude `downloads` capability when present, falling back to an anchor download on Pages.

Spond import: `readSheets()` handles `.xlsx` with a built-in zip/XML reader (`DecompressionStream`, iOS 16.4+), plus CSV. `parseWorkbook()` accepts Spond's "For import" sheet (Status + Name columns), then the "For print" sheet ("Going (26)" sections), then any sheet with a Name column.

## Testing

```bash
npm install
npx playwright install chromium
npm test
```

The suite serves the folder with `http-server` on port 8765 and emulates an iPhone-sized viewport. Tests use a fake clock (`page.clock`), and taps go through `tap()`, because Playwright's actionability checks stall under a frozen clock. Add a test for any engine or import change. Run `npm run serve` to try it at http://localhost:8765.

## Releasing

1. Make the change and update `USER_GUIDE.md` if coaches will notice it, then `npm run guide`.
2. Bump `VERSION` in `sw.js`.
3. `npm test`.
4. Commit and push to `main`. Pages redeploys in about a minute.
