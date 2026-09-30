# Fair Time - Wimborne RFC

Fair game-time rotation for age-grade rugby match days. Import the Spond attendee list, set the format, and the app runs the substitutions, handles injuries and late arrivals, and produces a summary at the end.

It is a single static page. There is no server and no account: all match data stays in the browser on the phone that runs it.

See [USER_GUIDE.md](USER_GUIDE.md) for the full coach guide.

## Using it

1. Open the site on your phone and add it to the home screen (Safari: Share > Add to Home Screen; Chrome: menu > Install app).
2. In Spond, open the event, tap the number going, tap the Excel icon and share or save the file.
   - Android (installed app): pick **Fair Time** straight from the share sheet.
   - iPhone: save to Files, then tap **Import Spond file**.
3. Set up teams and the substitution plan, then start match day.

Back up a session from the menu (JSON) to move it to another phone or keep a record.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The whole app |
| `USER_GUIDE.md` | Coach's guide (source) |
| `guide.html` | Coach's guide as shown in the app. Rebuild with `python3 build_guide.py` (needs `pip install markdown`) after editing the guide |
| `sw.js` | Offline support and the Android share target |
| `manifest.webmanifest` | Home-screen install, icons, share target |
| `icons/` | App icons made from the club crest |

## Releasing a change

Edit `index.html`, then bump `VERSION` in `sw.js` (for example `fairtime-v1.2.1`) so installed copies update. Phones pick up the new version the next time the app is opened with signal.

## Privacy

Only player names and Spond responses are read from the import. Contact details in the Spond file are ignored and never stored. Nothing is sent anywhere.
