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
