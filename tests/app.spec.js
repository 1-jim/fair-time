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

test("coach name can be set from the squad screen", async ({ page }) => {
  await expect(page.locator("[data-a=coachOpen]")).toHaveText("Set coach name");
  await tap(page, "[data-a=coachOpen]");
  await page.locator("#coachName").evaluate((el) => {
    el.value = "Alex";
  });
  await tap(page, "[data-a=coachSave]");
  await expect(page.locator("[data-a=coachOpen]")).toHaveText("Coach name: Alex");
  await expect(page.locator("h2", { hasText: "Player notes" })).toHaveCount(0);
  expect(await page.evaluate(() => FB.coach)).toBe("Alex");
});

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
  expect(await page.locator(".call-k span").allTextContents()).toEqual(["Coming on", "", "Coming off"]);
  const readsOnForOff = await page.locator(".pair").first().evaluate((el) => {
    const on = el.querySelector(".pi");
    const off = el.querySelector(".po");
    return !!(on && off && on.compareDocumentPosition(off) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(readsOnForOff).toBe(true);
  const swapReadsOnForOff = await page.locator(".swap").first().evaluate((el) => {
    const chips = [...el.querySelectorAll(".chip")];
    return chips[0]?.classList.contains("next") && chips[1]?.classList.contains("off");
  });
  expect(swapReadsOnForOff).toBe(true);
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

test("overtime shows on the clock and a forgotten half ends itself", async ({ page }) => {
  await importSquad(page);
  await tap(page, "[data-a=toSetup]");
  await tap(page, "[data-a=startDay]");
  await tap(page, "[data-a=kickoff]");
  await expect(page.locator(".clocks .clock").first()).toContainText("Elapsed");
  await expect(page.locator(".clocks .clock.ot")).toContainText("Overtime");
  await expect(page.locator("[data-live^=elapsed]")).toHaveText("0:00");
  await expect(page.locator("[data-live^=over]").first()).toHaveText("0:00");

  const half = await page.evaluate(() => H());
  const into = await page.evaluate(() => {
    const t = S.T[S.teams[S.active].id];
    return clock(t) - t.halfStart;
  });
  await page.clock.runFor(half - into + 30 * 1000);
  await expect(page.locator(".board")).toHaveClass(/alert/);
  expect(await page.locator("[data-live^=over]").first().textContent()).toMatch(/^0:3/);

  await page.clock.runFor(30 * 1000);
  await expect(page.locator("#toast")).toContainText("Overtime");
  expect(await page.evaluate(() => S.T[S.teams[S.active].id].otPing)).toBeGreaterThan(0);

  const left = await page.evaluate(() => {
    const t = S.T[S.teams[S.active].id];
    return H() * 0.25 - (clock(t) - t.halfStart - H());
  });
  await page.clock.runFor(left + 400);
  await expect(page.getByRole("dialog", { name: "Half-time changes" })).toContainText("with no tap");
  const log = await page.evaluate(() => S.T[S.teams[S.active].id].log.filter((e) => e.type === "autoend"));
  expect(log).toHaveLength(1);
  expect(log[0].reason).toBe("no interaction");
  expect(log[0].elapsed).toBeGreaterThan(log[0].over);

  await tap(page, "[data-a=undo]");
  await page.clock.runFor(1000);
  expect(await page.evaluate(() => S.T[S.teams[S.active].id].stage)).toBe("running");
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

test("player notes stay after a new session and combine across coaches", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem("wimborne-fairtime-feedback-v1", JSON.stringify({
        v: 1,
        coach: "Alex",
        records: [
          {
            id: "oldtag01",
            player: playerHash("", "Alfie Sample"),
            name: "Alfie Sample",
            group: "",
            event: "",
            date: "",
            tag: "Handling",
            line: "old topic",
            coach: "Alex",
            at: 1,
          },
          {
            id: "paste0001",
            player: playerHash("", "Alfie Sample"),
            name: "Alfie Sample",
            group: "",
            event: "",
            date: "",
            tag: "Ball catch",
            line: "Hands early",
            side: 1,
            coach: "Alex",
            at: 1,
          },
        ],
      }));
      FB = loadFB();
    });
    expect(await page.evaluate(() => FB.records.map((r) => r.tag))).toEqual(["Ball catch"]);
    expect(await page.evaluate(() => localStorage.getItem("wimborne-fairtime-feedback-v1"))).not.toContain("Handling");
    await importSquad(page);
    expect(await page.evaluate(() => S.groupName)).toBe("Sample Rugby Club");
    const linked = await page.evaluate(() => FB.records.find((r) => r.id === "paste0001"));
    expect(linked.group).toBe("Sample Rugby Club");
    expect(linked.player).toBe(await page.evaluate(() => playerHash("Sample Rugby Club", "Alfie Sample")));

    await tap(page, '.sq-row:has-text("Alfie Sample") .nm');
    await expect(page.getByText("Hands early · Alex")).toBeVisible();
    await tap(page, '[data-tag="Fix & pass"][data-side="1"]');
    await expect(page.locator("#toast")).toContainText("Committed saved");
    await tap(page, '[data-tag="Fix & pass"][data-side="1"]');
    await expect(page.locator("#toast")).toContainText("Committed saved");
    await expect(page.locator(".splittally")).toHaveText("+2");

    const stored = await page.evaluate(() => ({
      session: localStorage.getItem("wimborne-fairtime-v1"),
      notes: localStorage.getItem("wimborne-fairtime-feedback-v1"),
      summary: summaryText(),
    }));
    expect(stored.session).not.toContain("example.com");
    expect(stored.session).not.toContain("Fix & pass");
    expect(stored.notes).toContain("Fix & pass");
    expect(stored.notes).toContain("Committed");
    expect(stored.notes).not.toContain("example.com");
    expect(stored.summary).not.toContain("Fix & pass");

    await tap(page, "[data-a=closeModal]");
    await tap(page, "[data-a=modal][data-m=menu]");
    await tap(page, "[data-a=modal][data-m=new]");
    await tap(page, "[data-a=newConfirm]");
    expect(await page.evaluate(() => Object.keys(S.players).length)).toBe(0);
    expect(await page.evaluate(() => FB.records.some((r) => r.line === "Committed" && r.side === 1))).toBe(true);

    await importSquad(page);
    await expect(page.locator('.sq-row:has-text("Alfie Sample") .fbmark')).toHaveText("2 notes");

    const extra = await page.evaluate(() => ({
      kind: "fair-time-feedback",
      v: 1,
      records: [
        {
          id: "second01",
          player: playerHash(S.groupName, "Alfie Sample"),
          name: "Alfie Sample",
          group: S.groupName,
          event: S.eventName,
          date: S.eventDate,
          tag: "Fix & pass",
          line: "Committed",
          side: 1,
          coach: "Sam",
          at: 2,
        },
      ],
    }));
    const file = path.join(require("os").tmpdir(), "fair-time-notes-test.json");
    require("fs").writeFileSync(file, JSON.stringify(extra));
    await tap(page, "[data-a=modal][data-m=menu]");
    await tap(page, "[data-a=modal][data-m=notes]");
    await page.setInputFiles("input[data-ch=feedbackFile]", file);
    await expect(page.locator("#toast")).toContainText("Added 1 note");
    await expect(page.getByText("Reaffirmed by 2 coaches")).toBeVisible();
    await page.setInputFiles("input[data-ch=feedbackFile]", file);
    await expect(page.locator("#toast")).toContainText("already on this phone");
    expect(await page.evaluate(() => FB.records.filter((r) => r.name === "Alfie Sample" && r.tag === "Fix & pass").length)).toBe(3);
  });

  test("a match card can record a player note", async ({ page }) => {
    await importSquad(page);
    await page.evaluate(() => {
      FB.coach = "Alex";
      saveFB();
    });
    await tap(page, "[data-a=toSetup]");
    await tap(page, "[data-a=startDay]");
    await tap(page, ".chips .chip.field, .chips .chip.off");
    await expect(page.getByText("The collision and the line.")).toBeVisible();
    await expect(page.getByText("Shape and moving the ball.")).toBeVisible();
    await expect(page.getByText("The breakdown and the set piece.")).toBeVisible();
    await expect(page.locator('[data-tag="Fix & pass"][data-side="1"]')).toHaveText("Committed");
    await expect(page.locator('[data-tag="Fix & pass"][data-side="-1"]')).toHaveText("Shovelled");
    await expect(page.locator('[data-tag="Tackle height"][data-side="1"]')).toHaveText("Low contact");
    await expect(page.locator('[data-tag="Ruck arrival"][data-side="1"]')).toHaveText("Clean over");
    await page.locator("#fbTreds").evaluate((el) => {
      el.value = "Helped a teammate up";
    });
    await tap(page, '[data-tag="Fix & pass"][data-side="1"]');
    await expect(page.locator("#toast")).toContainText("Committed saved");
    await expect(page.getByText("Noted by Alex")).toBeVisible();
    await expect(page.locator(".splittally").first()).toHaveText("+1");
    await tap(page, '[data-tag="Fix & pass"][data-side="-1"]');
    await expect(page.locator("#toast")).toContainText("Shovelled saved");
    await expect(page.getByText("A positive behaviour.")).toBeVisible();
    await page.locator("#fbTreds").evaluate((el) => {
      el.value = "Helped a teammate up";
    });
    await tap(page, '[data-tag="Teamwork"]');
    await expect(page.locator("#toast")).toContainText("Teamwork saved");
    const lines = await page.evaluate(() =>
      FB.records.filter((r) => r.coach === "Alex").map((r) => r.tag + ":" + r.side + ":" + r.line),
    );
    expect(lines).toContain("Fix & pass:1:Committed");
    expect(lines).toContain("Fix & pass:-1:Shovelled");
    expect(lines).not.toContain("Fix & pass:1:Helped a teammate up");
    expect(lines).toContain("Teamwork:0:Helped a teammate up");
    expect(lines).not.toContain("Teamwork:0:Committed");
    expect(await page.evaluate(() => summaryText())).not.toContain("Fix & pass");
    expect(await page.evaluate(() => summaryText())).not.toContain("Teamwork");
  });

  test("summary shares skill feedback before a match starts", async ({ page }) => {
  await expect(page.locator('[data-a=go][data-v=summary]')).toBeDisabled();
  await expect(page.locator('[data-a=go][data-v=game]')).toBeDisabled();
  await importSquad(page);
  await expect(page.locator('[data-a=go][data-v=summary]')).toBeEnabled();
  await expect(page.locator('[data-a=go][data-v=game]')).toBeDisabled();
  await tap(page, '[data-a=go][data-v=summary]');
  await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();
  await expect(page.getByText("No skill notes yet.")).toBeVisible();
  await expect(page.locator("[data-a=shareSkill]")).toBeDisabled();

  await tap(page, '[data-a=go][data-v=squad]');
  await page.evaluate(() => {
    FB.coach = "Alex";
    saveFB();
  });
  await tap(page, '.sq-row:has-text("Alfie Sample") .nm');
  await tap(page, '[data-tag="Tackle height"][data-side="1"]');
  await tap(page, '[data-tag="Tackle height"][data-side="-1"]');
  await tap(page, "[data-a=closeModal]");
  await tap(page, '[data-a=go][data-v=summary]');
  await expect(page.getByRole("heading", { name: "Squad", level: 3 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Alfie Sample", level: 3 })).toBeVisible();
  await expect(page.getByText("Tackle height: +1 -1")).toHaveCount(2);

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
  await tap(page, "[data-a=shareSkill]");
  const shared = await page.evaluate(() => window.__shared);
  expect(shared.title).toBe("Skill feedback");
  expect(shared.text).toContain("Tackle height: +1 -1");
  expect(shared.text).toContain("Alfie Sample");
  expect(shared.text).not.toContain("example.com");
  expect(await page.evaluate(() => summaryText())).not.toContain("Tackle height");
});

test("player id is a hash of the group name and the player name", async ({ page }) => {
    const got = await page.evaluate(() => ({
      hash: playerHash("Sample Rugby Club", "Alfie Sample"),
      again: playerHash("  sample rugby   club ", "alfie sample"),
      other: playerHash("Other Group", "Alfie Sample"),
      email: playerHash("", "parent@example.com"),
    }));
    const crypto = require("crypto");
    const expectHex = crypto.createHash("sha256").update("sample rugby club\nalfie sample").digest("hex");
    expect(got.hash).toBe(expectHex);
    expect(got.again).toBe(got.hash);
    expect(got.other).not.toBe(got.hash);
    expect(got.hash).not.toBe(got.email);
  });

test("squad file round-trips teams, marks and settings onto a fresh phone", async ({ page }) => {
  const fs = require("fs");
  const os = require("os");
  await importSquad(page);
  const row = page.locator('.sq-row:has(button.going[aria-pressed="true"])').first();
  const who = await row.locator(".nm").evaluate((el) => el.childNodes[0].textContent.trim());
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

test("pasting a shared team list replaces the squad and keeps the event", async ({ page }) => {
  let dialogs = 0;
  const onDialog = (d) => {
    dialogs++;
    return d.dismiss();
  };
  page.on("dialog", onDialog);
  await tap(page, "[data-a=modal][data-m=paste]");
  await page.locator("#pasteBox").fill("Alex Quinn\nBlair Quinn");
  await tap(page, "[data-a=pasteApply]");
  expect(dialogs).toBe(0);
  await expect(page.locator("#toast")).toContainText("Added 2 names");
  page.off("dialog", onDialog);

  await importSquad(page);
  await page.locator("input.event").fill("U12 home");
  await page.locator("input.event").evaluate((el) => el.dispatchEvent(new Event("change", { bubbles: true })));
  await tap(page, "[data-a=toSetup]");
  const snap = await page.evaluate(() => ({
    eventName: S.eventName,
    eventDate: S.eventDate,
    text: rosterText(),
    late: Object.values(S.players)
      .filter((p) => p.resp === "maybe")
      .map((p) => p.name),
    out: Object.values(S.players)
      .filter((p) => p.resp === "no")
      .map((p) => p.name),
  }));
  expect(snap.late.length).toBeGreaterThan(0);
  expect(snap.out.length).toBeGreaterThan(0);
  await page.evaluate(() => {
    const id = "zz";
    S.players[id] = { id, name: "Zed Extra", resp: "going" };
    S.order.push(id);
    alignTeams();
    save();
    render();
  });

  await tap(page, "[data-a=go][data-v=squad]");
  await tap(page, "[data-a=modal][data-m=paste]");
  await page.locator("#pasteBox").fill(snap.text);
  page.once("dialog", (d) => d.dismiss());
  await tap(page, "[data-a=pasteApply]");
  expect(await page.evaluate(() => Object.values(S.players).some((p) => p.name === "Zed Extra"))).toBe(true);
  expect(await page.evaluate(() => S.teams.length)).toBeGreaterThan(0);

  await page.locator("#pasteBox").fill(snap.text);
  let warning = "";
  page.once("dialog", async (d) => {
    warning = d.message();
    await d.accept();
  });
  await tap(page, "[data-a=pasteApply]");
  expect(warning).toContain("replaces the squad list");
  expect(warning).toContain("event title and date stay");
  await expect(page.locator("#toast")).toContainText("Squad list replaced");
  const after = await page.evaluate(() => ({
    names: S.order.map((id) => S.players[id].name),
    eventName: S.eventName,
    eventDate: S.eventDate,
    teams: S.teams.length,
    late: Object.values(S.players)
      .filter((p) => p.resp === "maybe")
      .map((p) => p.name)
      .sort(),
    out: Object.values(S.players)
      .filter((p) => p.resp === "no")
      .map((p) => p.name)
      .sort(),
  }));
  expect(after.names).not.toContain("Zed Extra");
  expect(after.names).not.toContain("U12 home");
  expect(after.names.some((n) => /pitch|Swap/.test(n))).toBe(false);
  expect(after.eventName).toBe("U12 home");
  expect(after.eventDate).toBe(snap.eventDate);
  expect(after.teams).toBe(0);
  expect(after.late).toEqual(snap.late.slice().sort());
  expect(after.out).toEqual(snap.out.slice().sort());
  await expect(page.locator("input.event")).toHaveValue("U12 home");
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

test("squad and setup exports keep the same teams, and import does not reshuffle them", async ({ page }) => {
  await importSquad(page);
  await page.evaluate(() => {
    const id = "extra1";
    S.players[id] = { id, name: "Zed Extra", resp: "going" };
    S.order.push(id);
  });
  await page.setInputFiles("input[data-ch=importFile]", FIXTURE);
  await expect.poll(() => page.evaluate(() => S.order.length)).toBe(33);
  await expect.poll(() => page.evaluate(() => S.order.map((id) => S.players[id].name))).not.toContain("Zed Extra");
  expect(await page.evaluate(() => S.teams)).toEqual([]);

  await tap(page, "[data-a=toSetup]");
  const moved = await page.evaluate(() => {
    const id = S.teams[0].pids[0];
    const name = S.players[id].name;
    teamMove(id, 1, null);
    return name;
  });
  const before = await page.evaluate(() => rosterData());
  await page.evaluate(() => render());
  expect(await page.evaluate(() => rosterData())).toEqual(before);

  await tap(page, "[data-a=go][data-v=squad]");
  await page.locator(".sq-row", { hasText: moved }).locator("button.maybe").evaluate((el) => el.click());
  const fromSquad = await page.evaluate(() => {
    flushEditors();
    alignTeams();
    return rosterData();
  });
  await tap(page, "[data-a=go][data-v=setup]");
  const fromSetup = await page.evaluate(() => rosterData());
  expect(fromSetup.teams).toEqual(fromSquad.teams);
  expect(fromSetup.players).toEqual(fromSquad.players);
  expect(fromSetup.params).toEqual(fromSquad.params);
  expect(fromSetup.teams[1].players).toContain(moved);
  expect(fromSetup.teams[0].players).not.toContain(moved);

  page.once("dialog", (d) => d.accept());
  await page.evaluate((o) => {
    S.teams.reverse();
    receiveRoster(o);
    save();
    render();
  }, fromSetup);
  const imported = await page.evaluate(() => rosterData());
  expect(imported.teams).toEqual(fromSetup.teams);
  expect(imported.params).toEqual(fromSetup.params);
  await page.reload();
  const reloaded = await page.evaluate(() => rosterData());
  expect(reloaded.teams).toEqual(fromSetup.teams);
  expect(reloaded.params.k).toBe(fromSetup.params.k);
  expect(reloaded.params.interval).toBe(fromSetup.params.interval);
});

test("a WhatsApp-style squad file replaces a game under way after a warning", async ({ page }) => {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await importSquad(page);
  await tap(page, "[data-a=toSetup]");
  await tap(page, "[data-a=startDay]");
  await expect(page.locator("[data-a=kickoff]")).toBeVisible();

  const roster = JSON.stringify({
    kind: "fair-time-roster",
    v: 1,
    eventName: "U12 away",
    eventDate: "",
    params: { teams: 1, onField: 9, gameMins: 16, games: 3, halves: 2, k: 2, interval: 4, breakReshuffle: true, outlier: 1 },
    stratPicked: true,
    players: [
      { name: "Alex Quinn", resp: "going" },
      { name: "Blair Quinn", resp: "maybe" },
      { name: "Casey Quinn", resp: "no" },
    ],
    teams: [{ name: "Blues", players: ["Alex Quinn", "Blair Quinn"] }],
  });
  const share = (body) =>
    page.evaluate(async (body) => {
      const fd = new FormData();
      // WhatsApp shares documents without a .json name, as a generic file
      fd.append("file", new File([body], "WhatsApp File", { type: "application/octet-stream" }));
      await fetch("share", { method: "POST", body: fd });
    }, body);

  await share(roster);
  const declined = new Promise((resolve) => {
    page.once("dialog", async (d) => {
      resolve(d.message());
      await d.dismiss();
    });
  });
  await page.goto("/?shared=1");
  expect(await declined).toContain("game already under way");
  await expect(page.locator("[data-a=kickoff]")).toBeVisible();

  await share(roster);
  const accepted = new Promise((resolve) => {
    page.once("dialog", async (d) => {
      resolve(d.message());
      await d.accept();
    });
  });
  await page.goto("/?shared=1");
  await accepted;
  await expect(page.locator("#toast")).toContainText("Imported 3 players and 1 team");
  await expect(page.locator("input.event")).toHaveValue("U12 away");
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("wimborne-fairtime-v1")));
  expect(state.started).toBe(false);
  expect(Object.keys(state.players)).toHaveLength(3);
  expect(state.teams[0].name).toBe("Blues");
});

test("a shared spreadsheet does not replace a game under way", async ({ page }) => {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await importSquad(page);
  await tap(page, "[data-a=toSetup]");
  await tap(page, "[data-a=startDay]");
  await expect(page.locator("[data-a=kickoff]")).toBeVisible();

  const bytes = [...require("fs").readFileSync(FIXTURE)];
  await page.evaluate(async (arr) => {
    const fd = new FormData();
    fd.append("file", new File([new Uint8Array(arr)], "spond.xlsx"));
    await fetch("share", { method: "POST", body: fd });
  }, bytes);
  await page.goto("/?shared=1");
  await expect(page.locator("#toast")).toContainText("Match day is under way");
  await expect(page.locator("[data-a=kickoff]")).toBeVisible();
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("wimborne-fairtime-v1")));
  expect(state.started).toBe(true);
  expect(Object.keys(state.players).length).toBeGreaterThan(10);
});

test("import squad file from the menu replaces a game under way after a warning", async ({ page }) => {
  const fs = require("fs");
  const os = require("os");
  const file = path.join(os.tmpdir(), "fair-time-roster-live.json");
  fs.writeFileSync(
    file,
    JSON.stringify({
      kind: "fair-time-roster",
      v: 1,
      eventName: "U12 away",
      eventDate: "",
      params: { teams: 1, onField: 9, gameMins: 16, games: 3, halves: 2, k: 2, interval: 4, breakReshuffle: true, outlier: 1 },
      stratPicked: true,
      players: [{ name: "Casey Quinn", resp: "going" }],
      teams: [{ name: "Blues", players: ["Casey Quinn"] }],
    }),
  );
  await importSquad(page);
  await tap(page, "[data-a=toSetup]");
  await tap(page, "[data-a=startDay]");
  await tap(page, "[data-a=modal][data-m=menu]");
  await expect(page.locator(".sheet input[data-ch=rosterFile]")).toBeAttached();

  page.once("dialog", (d) => d.dismiss());
  await page.setInputFiles(".sheet input[data-ch=rosterFile]", file);
  await expect(page.locator("[data-a=kickoff]")).toBeVisible();

  await tap(page, "[data-a=modal][data-m=menu]");
  const warned = new Promise((resolve) => {
    page.once("dialog", async (d) => {
      resolve(d.message());
      await d.accept();
    });
  });
  await page.setInputFiles(".sheet input[data-ch=rosterFile]", file);
  expect(await warned).toContain("can't be undone");
  await expect(page.locator("#toast")).toContainText("Imported 1 player and 1 team");
  await expect(page.locator("input.event")).toHaveValue("U12 away");
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("wimborne-fairtime-v1")));
  expect(state.started).toBe(false);
  expect(Object.values(state.players).map((p) => p.name)).toEqual(["Casey Quinn"]);
});
