// @ts-check
const { test, expect } = require("@playwright/test");
const path = require("path");

const FIXTURE = path.join(__dirname, "fixtures", "spond-sample.xlsx");
const MIN = 60 * 1000;

// Playwright's actionability checks wait on animation frames, which the fake clock
// freezes, so taps go straight to the element instead.
const tap = (page, sel) => page.locator(sel).first().evaluate((el) => el.click());
const names = (page) => page.locator(".sq-row .nm").allTextContents();

test.beforeEach(async ({ page }) => {
  // Fonts are cosmetic; blocking them keeps tests fast and offline
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  // The app must never need the CDN spreadsheet library for a normal Spond file
  await page.route(/cdnjs\.cloudflare\.com/, (r) => r.abort());
  await page.clock.install();
  await page.goto("/index.html");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function importSquad(page) {
  await page.setInputFiles("input[data-ch=importFile]", FIXTURE);
  await expect(page.locator("#toast")).toContainText("Imported 33 names, 26 going");
}

test("imports a Spond export without the CDN library", async ({ page }) => {
  await importSquad(page);
  await expect(page.locator(".fchip.going b")).toHaveText("26");
  await expect(page.locator(".fchip.maybe b")).toHaveText("2");
  await expect(page.locator(".fchip.no b")).toHaveText("5");
  // Contact details in the file must never reach storage
  const stored = await page.evaluate(() => localStorage.getItem("wimborne-fairtime-v1"));
  expect(stored).not.toContain("example.com");
  expect(stored).not.toContain("+44");
});

test("squad list stays alphabetical and filters combine", async ({ page }) => {
  await importSquad(page);
  const before = await names(page);
  expect(before).toEqual([...before].sort((a, b) => a.localeCompare(b)));

  await tap(page, ".sq-row >> nth=0 >> button.no");
  expect(await names(page)).toEqual(before);

  await tap(page, ".fchip.going");
  await expect(page.locator(".sq-row")).toHaveCount(25);
  // A player changed while filtered stays visible until the filter changes
  await tap(page, ".sq-row >> nth=0 >> button.maybe");
  await expect(page.locator(".sq-row")).toHaveCount(25);
  await tap(page, ".fchip.maybe");
  await expect(page.locator(".sq-row")).toHaveCount(27);
  await tap(page, ".fchip.clear");
  await expect(page.locator(".sq-row")).toHaveCount(33);
});

test("runs a game: planned change, injury cover, summary", async ({ page }) => {
  await importSquad(page);
  await tap(page, "[data-a=toSetup]");
  await expect(page.locator("tr.sel")).toHaveCount(1);
  await tap(page, "[data-a=startDay]");
  await expect(page.locator(".chips .chip.field, .chips .chip.off")).toHaveCount(9);
  await tap(page, "[data-a=kickoff]");

  // The recommended plan for 13 players is 4 every 5 minutes
  await page.clock.runFor(5 * MIN + 5000);
  await expect(page.locator(".call-t")).toHaveText("Swap 4 now");
  await tap(page, "[data-a=callDone]");
  await expect(page.locator(".call")).toHaveCount(0);

  // Injure a pitch player: the bench cover comes on automatically
  const injured = await page.locator(".chips .chip.field .nm, .chips .chip.off .nm").first().textContent();
  await tap(page, ".chips .chip.field, .chips .chip.off");
  await tap(page, "[data-s=injured]");
  await expect(page.locator("#toast")).toContainText(`on for ${injured}`);
  await expect(page.locator(".chips .chip.field, .chips .chip.off")).toHaveCount(9);

  await page.clock.runFor(3 * MIN);
  await tap(page, "[data-a=halftime]");
  await expect(page.locator(".call-t")).toHaveText("Half-time changes");
  await tap(page, "[data-a=callDone]");
  await tap(page, "[data-a=secondHalf]");
  await page.clock.runFor(8 * MIN);
  if (await page.locator(".call").count()) await tap(page, "[data-a=callDone]");
  await tap(page, "[data-a=fulltime]");
  await expect(page.getByText("Game 1 recap")).toBeVisible();

  await tap(page, "[data-a=go][data-v=summary]");
  await expect(page.locator(".lines").first()).toContainText(`${injured} was injured`);
  await expect(page.locator(".lines").first()).toContainText("didn't return");
});

test("concussion cannot be cleared by the normal return option", async ({ page }) => {
  await importSquad(page);
  await tap(page, "[data-a=toSetup]");
  await tap(page, "[data-a=startDay]");
  await tap(page, "[data-a=kickoff]");
  await tap(page, ".chips .chip.field, .chips .chip.off");
  await tap(page, "[data-s=concussed]");
  await tap(page, ".chip.out");
  await expect(page.getByText("Fit to play again")).toHaveCount(0);
  await expect(page.getByText("Clear: entered by mistake")).toBeVisible();
});

test("match controls are tappable where they are drawn", async ({ page }) => {
  await importSquad(page);
  await tap(page, "[data-a=toSetup]");
  await tap(page, "[data-a=startDay]");
  await tap(page, "[data-a=kickoff]");
  // A tap lands on whatever is under the finger, so each button must be the top element at its own centre
  for (const a of ["pause", "subNow", "halftime"]) {
    const hit = await page.locator(`[data-a=${a}]`).evaluate((el) => {
      const r = el.getBoundingClientRect();
      return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest("[data-a]") === el;
    });
    expect(hit, a).toBe(true);
  }
});

test("works offline once loaded and accepts the Android share target", async ({ page, context }) => {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  const bytes = [...require("fs").readFileSync(FIXTURE)];
  await page.evaluate(async (arr) => {
    const fd = new FormData();
    fd.append("file", new File([new Uint8Array(arr)], "spond.xlsx"));
    await fetch("share", { method: "POST", body: fd });
  }, bytes);
  await page.goto("/?shared=1");
  await expect(page.locator("#toast")).toContainText("Imported 33 names");

  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveTitle(/Fair Time/);
  await page.goto("/guide.html");
  await expect(page.locator("h1")).toContainText("coach's guide");
});

test.describe("team builder", () => {
  const teamOf = (page, name) =>
    page.evaluate((n) => {
      const id = Object.keys(S.players).find((k) => S.players[k].name === n);
      return S.teams.findIndex((t) => t.pids.includes(id));
    }, name);
  const chip = (page, team, n = 0) => page.locator(`.team[data-ti="${team}"] .tchip`).nth(n);
  async function drag(page, from, to) {
    const a = await from.boundingBox();
    const b = await to.boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 10);
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 5 });
    await page.mouse.up();
  }

  test.beforeEach(async ({ page }) => {
    await importSquad(page);
    await tap(page, "[data-a=toSetup]");
    await page.locator(".tbar").evaluate((el) => el.scrollIntoView({ block: "start" }));
  });

  test("drag a player onto another team moves them", async ({ page }) => {
    const name = await chip(page, 0).textContent();
    await drag(page, chip(page, 0), page.locator('.team[data-ti="1"] .tstats'));
    expect(await teamOf(page, name)).toBe(1);
    await expect(page.locator('.team[data-ti="0"] .tchip')).toHaveCount(13);
    await expect(page.locator('.team[data-ti="1"] .tchip')).toHaveCount(15);
  });

  test("drop on a player in the other team swaps them, undo restores", async ({ page }) => {
    const a = await chip(page, 0, 2).textContent();
    const b = await chip(page, 1, 1).textContent();
    await drag(page, chip(page, 0, 2), chip(page, 1, 1));
    expect(await teamOf(page, a)).toBe(1);
    expect(await teamOf(page, b)).toBe(0);
    await expect(page.locator('.team[data-ti="0"] .tchip')).toHaveCount(14);
    await tap(page, "[data-a=teamUndo]");
    expect(await teamOf(page, a)).toBe(0);
    expect(await teamOf(page, b)).toBe(1);
  });

  test("tap to select, then tap Move here or another player", async ({ page }) => {
    const a = await chip(page, 0, 1).textContent();
    await tap(page, '.team[data-ti="0"] .tchip >> nth=1');
    await expect(page.locator(".tchip.sel")).toHaveCount(1);
    await tap(page, '.team[data-ti="1"] .movehere');
    expect(await teamOf(page, a)).toBe(1);

    const b = await chip(page, 0, 0).textContent();
    const c = await chip(page, 1, 0).textContent();
    await tap(page, '.team[data-ti="0"] .tchip >> nth=0');
    await tap(page, '.team[data-ti="1"] .tchip >> nth=0');
    expect(await teamOf(page, b)).toBe(1);
    expect(await teamOf(page, c)).toBe(0);
  });

  test("press and hold then drag works on touch", async ({ page }) => {
    const from = chip(page, 0, 3);
    const name = await from.textContent();
    const a = await from.boundingBox();
    const b = await page.locator('.team[data-ti="1"] .tstats').boundingBox();
    const ev = (type, x, y) =>
      page.evaluate(
        ([type, x, y]) => {
          const el = document.elementFromPoint(x, y) || document.body;
          el.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerType: "touch", isPrimary: true }));
        },
        [type, x, y],
      );
    const ax = a.x + a.width / 2;
    const ay = a.y + a.height / 2;
    await ev("pointerdown", ax, ay);
    await page.clock.runFor(400);
    await expect(page.locator(".dragghost")).toHaveCount(1);
    await ev("pointermove", b.x + b.width / 2, b.y + b.height / 2);
    await ev("pointerup", b.x + b.width / 2, b.y + b.height / 2);
    expect(await teamOf(page, name)).toBe(1);
    await expect(page.locator(".dragghost")).toHaveCount(0);
  });

  test("a quick touch swipe scrolls rather than dragging", async ({ page }) => {
    const a = await chip(page, 0, 3).boundingBox();
    await page.evaluate(
      ([x, y]) => {
        const el = document.elementFromPoint(x, y);
        el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: x, clientY: y, pointerType: "touch" }));
        el.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: x, clientY: y + 40, pointerType: "touch" }));
      },
      [a.x + a.width / 2, a.y + a.height / 2],
    );
    await page.clock.runFor(400);
    await expect(page.locator(".dragghost")).toHaveCount(0);
  });

  test("re-splitting after manual changes can be undone", async ({ page }) => {
    const name = await chip(page, 0).textContent();
    await drag(page, chip(page, 0), page.locator('.team[data-ti="1"] .tstats'));
    await tap(page, '[data-a=split][data-m="shuffle"]');
    await tap(page, "[data-a=teamUndo]");
    expect(await teamOf(page, name)).toBe(1);
  });

  test("undoing a change in the number of teams keeps every player once", async ({ page }) => {
    const placed = () => page.evaluate(() => S.teams.flatMap((t) => t.pids).sort());
    const before = await placed();
    await tap(page, '[data-a=param][data-k=teams][data-s="1"]');
    await expect(page.locator(".team")).toHaveCount(3);
    await tap(page, "[data-a=teamUndo]");
    await expect(page.locator(".team")).toHaveCount(2);
    expect(await page.evaluate(() => S.params.teams)).toBe(2);
    expect(await placed()).toEqual(before);
  });
});

test("squad file round-trips teams, marks and settings onto a fresh phone", async ({ page }) => {
  const fs = require("fs");
  const os = require("os");
  await importSquad(page);
  const row = page.locator('.sq-row:has(button.going[aria-pressed="true"])').first();
  const who = await row.locator(".nm").textContent();
  await row.locator("button.maybe").evaluate((el) => el.click());

  await page.locator("input.event").fill("U12 home");
  await page.locator("input.event").evaluate((el) => el.dispatchEvent(new Event("change", { bubbles: true })));
  await tap(page, "[data-a=toSetup]");
  await page.locator('.team[data-ti="0"] input.inp').fill("Colts");
  await page.locator('.team[data-ti="0"] input.inp').evaluate((el) => el.dispatchEvent(new Event("change", { bubbles: true })));
  await tap(page, '[data-a=param][data-k=gameMins][data-s="1"]');

  await page.evaluate(() => {
    Object.defineProperty(Navigator.prototype, "canShare", { configurable: true, value: () => false });
  });
  const [download] = await Promise.all([page.waitForEvent("download"), tap(page, "[data-a=exportRoster]")]);
  const raw = fs.readFileSync(await download.path(), "utf8");
  const roster = JSON.parse(raw);
  const file = path.join(os.tmpdir(), "fair-time-roster.json");
  fs.writeFileSync(file, raw);
  expect(roster.kind).toBe("fair-time-roster");
  expect(roster.eventName).toBe("U12 home");
  expect(roster.params.gameMins).toBe(17);
  expect(roster.teams.map((t) => t.name)).toContain("Colts");
  expect(roster.players.find((p) => p.name === who).resp).toBe("maybe");
  const fileTeam = roster.teams.find((t) => t.players.includes(who)).name;
  expect(roster.players.filter((p) => p.resp === "no").every((p) => !roster.teams.some((t) => t.players.includes(p.name)))).toBe(true);
  expect(roster.players.filter((p) => p.resp === "no").length).toBeGreaterThan(0);
  expect(raw).not.toContain("example.com");
  expect(raw).not.toContain("callType");

  page.once("dialog", (d) => d.dismiss());
  await page.setInputFiles("#app input[data-ch=rosterFile]", file);
  await expect(page.locator('.team[data-ti="0"] input.inp')).toHaveValue("Colts");

  await page.evaluate(() => localStorage.clear());
  await page.reload();
  let dialogs = 0;
  page.on("dialog", async (d) => {
    dialogs++;
    await d.dismiss();
  });
  await page.setInputFiles("#app input[data-ch=rosterFile]", file);
  await expect(page.locator("#toast")).toContainText("Imported 33 players and 2 teams");
  expect(dialogs).toBe(0);
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("wimborne-fairtime-v1")));
  expect(state.eventName).toBe("U12 home");
  expect(state.params.gameMins).toBe(17);
  expect(state.started).toBe(false);
  expect(state.view).toBe("setup");
  const imported = Object.values(state.players).find((p) => p.name === who);
  expect(imported.resp).toBe("maybe");
  expect(state.teams.find((t) => t.pids.includes(imported.id)).name).toBe(fileTeam);
  expect(state.teams.some((t) => t.name === "Colts")).toBe(true);
  await expect(page.locator("input.event")).toHaveValue("U12 home");
});

test("share team list sends the event, the teams and the plan", async ({ page }) => {
  await importSquad(page);
  await page.locator("input.event").fill("U12 home");
  await page.locator("input.event").evaluate((el) => el.dispatchEvent(new Event("change", { bubbles: true })));
  await tap(page, "[data-a=toSetup]");
  await page.locator('.team[data-ti="0"] input.inp').fill("Colts");
  await page.locator('.team[data-ti="0"] input.inp').evaluate((el) => el.dispatchEvent(new Event("change", { bubbles: true })));
  await tap(page, "[data-a=startDay]");
  await page.evaluate(() => {
    window.__shared = null;
    Object.defineProperty(Navigator.prototype, "share", {
      configurable: true,
      writable: true,
      value(data) {
        window.__shared = data;
        return Promise.resolve();
      },
    });
  });
  await tap(page, "[data-a=shareRoster]");
  const shared = await page.evaluate(() => window.__shared);
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("wimborne-fairtime-v1")));
  expect(shared.title).toBe("U12 home");
  expect(shared.text).toContain("U12 home");
  expect(shared.text).toContain("Colts (");
  expect(shared.text).toContain(state.players[state.teams[0].pids[0]].name);
  expect(shared.text).toContain("(late)");
  expect(shared.text).toContain("Not playing");
  expect(shared.text).toContain("on the pitch");
  expect(shared.files).toBeFalsy();
});

test("a squad file is not a match backup, and a backup is not a squad file", async ({ page }) => {
  const fs = require("fs");
  const os = require("os");
  await importSquad(page);
  await page.evaluate(() => {
    Object.defineProperty(Navigator.prototype, "canShare", { configurable: true, value: () => false });
  });
  const [squadDl] = await Promise.all([page.waitForEvent("download"), tap(page, "[data-a=exportRoster]")]);
  const squadPath = path.join(os.tmpdir(), "ft-squad.json");
  fs.writeFileSync(squadPath, fs.readFileSync(await squadDl.path()));

  await tap(page, "[data-a=modal][data-m=menu]");
  const [backupDl] = await Promise.all([page.waitForEvent("download"), tap(page, "[data-a=exportJSON]")]);
  const backupPath = path.join(os.tmpdir(), "ft-backup.json");
  fs.writeFileSync(backupPath, fs.readFileSync(await backupDl.path()));
  await tap(page, "[data-a=closeModal]");

  await page.setInputFiles("#app input[data-ch=rosterFile]", backupPath);
  await expect(page.locator("#toast")).toContainText("full backup");
  await expect(page.locator(".fchip.going b")).toHaveText("26");

  await tap(page, "[data-a=modal][data-m=menu]");
  await page.setInputFiles(".sheet input[data-ch=restoreFile]", squadPath);
  await expect(page.locator("#toast")).toContainText("squad file");
  await expect(page.locator(".fchip.going b")).toHaveText("26");
});

test("android share target imports a squad file", async ({ page }) => {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  const roster = {
    kind: "fair-time-roster",
    v: 1,
    eventName: "U12 away",
    eventDate: "Sun 18 Oct",
    params: { teams: 2, onField: 9, gameMins: 16, games: 3, halves: 2, k: 2, interval: 4, breakReshuffle: true, outlier: 1 },
    stratPicked: true,
    players: [
      { name: "Alex Quinn", resp: "going" },
      { name: "Blair Quinn", resp: "maybe" },
      { name: "Casey Quinn", resp: "no" },
    ],
    teams: [{ name: "Blues", players: ["Alex Quinn", "Blair Quinn"] }],
  };
  await page.evaluate(async (body) => {
    const fd = new FormData();
    fd.append("file", new File([body], "fair-time-squad.json", { type: "application/json" }));
    await fetch("share", { method: "POST", body: fd });
  }, JSON.stringify(roster));
  await page.goto("/?shared=1");
  await expect(page.locator("#toast")).toContainText("Imported 3 players and 1 team");
  await expect(page.locator("input.event")).toHaveValue("U12 away");
  await expect(page.locator(".tchip")).toHaveCount(2);
  await expect(page.locator(".tchip.maybe")).toHaveText("Blair Quinn");
  await expect(page.getByText("Sun 18 Oct")).toBeVisible();
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("wimborne-fairtime-v1")));
  expect(Object.values(state.players).find((p) => p.name === "Casey Quinn").resp).toBe("no");
  expect(state.teams[0].name).toBe("Blues");
});
