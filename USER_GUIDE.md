# Fair Time: coach's guide

**Fair game time for every player, even when match day doesn't go to plan.**

Fair Time runs your substitutions on match day. You load the Spond attendee list and pick a substitution plan. The app then tells you who comes off and who goes on, keeps track of everyone's minutes, and produces a summary at the end.

When someone doesn't turn up, gets injured or arrives late, you tap their name and the rotation adjusts itself. There's no spreadsheet to redo on the touchline.

> This is an early version built by a club parent. Please try it and tell us what works and what doesn't: see [Feedback](#feedback) at the end.

**Open the app:** `https://1-jim.github.io/fair-time/`

---

## Contents

1. [Before match day](#1-before-match-day)
2. [Setting up teams](#2-setting-up-teams)
3. [On the touchline](#3-on-the-touchline)
4. [When things change](#4-when-things-change)
5. [After the games](#5-after-the-games)
6. [Good to know](#6-good-to-know)
7. [Feedback](#feedback)

---

## 1. Before match day

### Install it on your phone

Open the link above, then:

- **iPhone (Safari):** tap Share, then **Add to Home Screen**.
- **Android (Chrome):** tap the menu, then **Install app**.

Open it once with signal so it's saved on your phone. After that it works with no signal at the ground.

**iPhone users:** always open Fair Time from the home-screen icon. iPhones keep the home-screen app's data separate from Safari, so a squad loaded in one won't appear in the other.

### Get the squad from Spond

1. Open the event in Spond.
2. Tap the number of people going, then the **Excel** icon.
3. Get the file into Fair Time:
   - **Android:** choose **Fair Time** from the share menu. The squad loads straight in.
   - **iPhone:** save the file to Files. Open Fair Time and tap **Import Spond file**.

Fair Time reads only names and responses. Contact details, addresses and dates of birth in the Spond file are ignored and never stored.

No Spond file? Tap **Paste names** and paste a list, one name per line.

### Check the squad

Everyone appears on the **Squad** screen, marked as one of:

| Mark | Meaning |
| --- | --- |
| **Going** | Said yes in Spond |
| **Late** | Didn't answer, or might be late. They start as "not arrived" and join in when you tap them. |
| **Out** | Can't make it. Left out of the teams. |

Tap to change anyone's mark. Add a missing player at the bottom.

---

## 2. Setting up teams

On the **Setup** screen:

| Setting | Example |
| --- | --- |
| Teams | 2 |
| Players on the pitch | 9 |
| Minutes per game | 16 |
| Games per team | 3 |
| Halves per game | 2 |
| Full reshuffle at half-time and between games | On (recommended) |

### Choosing a substitution plan

Fair Time tries each plan against a whole match day before you pick, and shows how each one would turn out:

| Column | What it tells you |
| --- | --- |
| **Fairness gap** | The difference between the most and least time played across the day, if nobody drops out. Smaller is fairer. |
| **Stoppages** | How many times you'll be subbing during play. Half-time and between games don't count. |
| **Longest rest** | The longest anyone sits on the bench in one go. |

The plan marked **Best** balances fairness against disruption. For example, with 13 players and 9 on the pitch, "Swap 4 every 5 min" gives about a 3-minute gap with 6 stoppages. "Swap 4 every 2 min" gets the gap down to 2 minutes, but means 17 stoppages.

### Splitting the squad

- **Split A to Z** or **Shuffle** to make the teams.
- Tap a name to move that player to the other team.
- Rename teams by tapping the team name.

Tap **Start match day** when you're ready.

---

## 3. On the touchline

### The Match screen

The clock is at the top, with a countdown to the next change. Below it, every player is shown as a coloured card:

| Colour | Meaning |
| --- | --- |
| 🟩 Green | On the pitch |
| 🟥 Red | On the pitch, coming off next |
| 🟨 Amber | On the bench, going on next |
| 🟦 Blue | On the bench |
| ⬜ Grey | Not available (injured, gone home, not arrived) |

Each card shows the minutes played so far. It also shows how far that player is ahead (+) or behind (-) their fair share. The **Next change** list always shows exactly who swaps next.

With two teams on one phone, use the tabs at the top. A red dot on a tab means that team has a change due.

### Running a game

1. Tap **Kick off**.
2. When a change is due, the phone beeps and a full-screen alert shows the pairs: **coming off** on the left, **going on** on the right.
3. Make the swaps, then tap **Done**.
   - Ball not dead yet? Tap **Wait 30 sec**.
   - Want to keep a pair on? Tap that pair to leave it out.
   - Not the right moment at all? Tap **Skip this change**.
4. Stoppage before the change is due? Tap **Sub now** to do it early.
5. When time is up, the clock turns red but keeps running. Tap **Half-time** or **Full-time** when the referee blows.
6. At half-time and between games, Fair Time suggests a bigger reshuffle to even things out. Check it, then tap **Done**.

**Pause** stops the clock for long stoppages. **Undo** reverses your last action if you tap the wrong thing.

The screen stays on while a game is running. Keep the sound on: iPhones don't vibrate for web apps.

---

## 4. When things change

Tap any player's card for options.

| Situation | What to tap | What happens |
| --- | --- | --- |
| Injured | **Injured** | They come off and the bench player furthest behind comes on straight away. |
| Fit again | **Fit to play again** | They go to the bench and are prioritised, as they're now behind. |
| Head knock | **Suspected concussion** | They're out for the rest of the day and can't be put back by accident. |
| Arrives late | **Arrived** | They join the bench and start earning fair time from that moment. |
| Goes home early | **Gone home** | Removed from the rotation. |
| Opposition short | **Lend to the opposition** | Their time still counts as playing. |
| Manual swap | Pick a name under **Swap off for** or **Bring on for** | Swaps just those two. |
| Move between teams | **Move to** (before kick-off or at full-time) | Moves them with their minutes. |
| Not on the list at all | **Add player** at the bottom | Adds them to the bench. |

To change the plan mid-game, for example in heavy rain or with more players than expected, tap **Sub plan**.

### How fairness works

Fair Time doesn't follow a fixed rota, which is why it copes when plans fall apart. It shares the pitch time evenly among whoever is available at each moment. At every change, it brings on the bench players furthest behind and takes off those furthest ahead.

So a player who arrives in game 2 isn't "owed" game 1. An injured player isn't owed the time they were off either.

---

## 5. After the games

At full-time, each game gets a quick recap. After the last game, open **Summary** for the whole day:

- A plain-English list of what happened, for example:
  - "Josh was injured 4:06 into game 1 and didn't return."
  - "Sam and Alfie got 1 minute more than their fair share."
- A table of minutes for every player in every game, with anyone outside the threshold highlighted.

Buttons at the top of the Summary:

- **Share summary** sends the text to WhatsApp, email or anywhere else.
- **Export CSV** gives you the minutes as a spreadsheet.
- **Backup (JSON)** saves the whole session. Use **Menu > Restore a backup** to load it on another phone.

### Starting next week

**Menu > Start a new session** clears everything on the phone. It warns you first and offers a backup, so export anything you want to keep.

---

## 6. Good to know

- **One phone per team** works best if coaches are on different pitches. Each phone keeps its own data; there's no syncing between phones yet.
- **Everything stays on your phone.** Nothing is sent to a server, and no player data is stored online.
- **No signal at the ground is fine**, as long as you've opened the app once beforehand.
- **Reloading or locking the phone is safe.** The clock keeps correct time and nothing is lost.
- **Changing the "flag anyone this far from fair share" setting** (in Setup) controls what the summary highlights. The default is 1 minute.

### Not in this version yet

- Position rules, such as always keeping enough scrum-trained players on.
- Tracking fairness across a whole season rather than one day.
- Live sync between two coaches' phones.
- Pulling the squad directly from Spond, rather than via the Excel file.

---

## Feedback

This was built for our age group, and we'd like it to work for every team at the club. After you've used it on a match day, please tell us:

1. **Did it keep game time fair?** Did the summary match how the day actually felt?
2. **Was it usable on the touchline?** Was anything hard to read, too small, or too slow in the moment?
3. **What went wrong?** Include the phone type (iPhone or Android) and what you tapped, if you can remember.
4. **Which plan did you use**, and would you pick it again?
5. **What's missing?** Which feature from "Not in this version yet", or anything else, would make the biggest difference to your team?

**How to send it:**

- Raise an issue on GitHub: `https://github.com/1-jim/fair-time/issues`

Screenshots help a lot, especially of the Summary screen or anything that looks wrong.

Thank you for trying it.
