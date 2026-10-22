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
      FB.coach = "Alex";
      FB.records = [
        {
          id: "paste0001",
          player: playerHash("", "Alfie Sample"),
          name: "Alfie Sample",
          group: "",
          event: "",
          date: "",
          tag: "Handling",
          line: "before the file",
          coach: "Alex",
          at: 1,
        },
      ];
      saveFB();
    });
    await importSquad(page);
    expect(await page.evaluate(() => S.groupName)).toBe("Sample Rugby Club");
    const linked = await page.evaluate(() => FB.records.find((r) => r.id === "paste0001"));
    expect(linked.group).toBe("Sample Rugby Club");
    expect(linked.player).toBe(await page.evaluate(() => playerHash("Sample Rugby Club", "Alfie Sample")));

    await tap(page, '.sq-row:has-text("Alfie Sample") .nm');
    await expect(page.getByText("before the file")).toBeVisible();
    await page.locator("#fbLine").evaluate((el) => {
      el.value = "Stood tall";
    });
    await tap(page, '[data-tag="Tackle height"]');
    await expect(page.locator("#toast")).toContainText("Tackle height saved");
    await page.locator("#fbLine").evaluate((el) => {
      el.value = "Stood tall";
    });
    await tap(page, '[data-tag="Tackle height"]');
    await expect(page.locator("#toast")).toContainText("already noted");

    const stored = await page.evaluate(() => ({
      session: localStorage.getItem("wimborne-fairtime-v1"),
      notes: localStorage.getItem("wimborne-fairtime-feedback-v1"),
      summary: summaryText(),
    }));
    expect(stored.session).not.toContain("example.com");
    expect(stored.session).not.toContain("Tackle height");
    expect(stored.notes).toContain("Tackle height");
    expect(stored.notes).toContain("Stood tall");
    expect(stored.notes).not.toContain("example.com");
    expect(stored.summary).not.toContain("Tackle height");

    await tap(page, "[data-a=closeModal]");
    await tap(page, "[data-a=modal][data-m=menu]");
    await tap(page, "[data-a=modal][data-m=new]");
    await tap(page, "[data-a=newConfirm]");
    expect(await page.evaluate(() => Object.keys(S.players).length)).toBe(0);
    expect(await page.evaluate(() => FB.records.some((r) => r.line === "Stood tall"))).toBe(true);

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
          tag: "Tackle height",
          line: "From the side",
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
    expect(await page.evaluate(() => FB.records.filter((r) => r.name === "Alfie Sample" && r.tag === "Tackle height").length)).toBe(2);
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
    await expect(page.getByText("Development opportunities.")).toBeVisible();
    await page.locator("#fbNote").evaluate((el) => {
      el.value = "Stood tall";
    });
    await page.locator("#fbTreds").evaluate((el) => {
      el.value = "Helped a teammate up";
    });
    await tap(page, '[data-tag="Handling"]');
    await expect(page.locator("#toast")).toContainText("Handling saved");
    await expect(page.getByText("Noted by Alex")).toBeVisible();
    await expect(page.getByText("A positive behaviour.")).toBeVisible();
    await page.locator("#fbNote").evaluate((el) => {
      el.value = "Should stay on the note";
    });
    await page.locator("#fbTreds").evaluate((el) => {
      el.value = "Helped a teammate up";
    });
    await tap(page, '[data-tag="Teamwork"]');
    await expect(page.locator("#toast")).toContainText("Teamwork saved");
    const lines = await page.evaluate(() =>
      FB.records.filter((r) => r.coach === "Alex").map((r) => r.tag + ":" + r.line),
    );
    expect(lines).toContain("Handling:Stood tall");
    expect(lines).toContain("Teamwork:Helped a teammate up");
    expect(lines).not.toContain("Teamwork:Should stay on the note");
    expect(await page.evaluate(() => summaryText())).not.toContain("Handling");
    expect(await page.evaluate(() => summaryText())).not.toContain("Teamwork");
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
