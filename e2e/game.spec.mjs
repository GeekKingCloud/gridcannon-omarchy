import { test, expect } from "@playwright/test";
async function opening(page) {
  while (
    (await page.locator("#phase").textContent()) === "OPENING DEAL" &&
    (await page.locator(".royal.legal").count())
  )
    await page.locator(".royal.legal").first().click();
  if (await page.locator("#keep").isVisible())
    await page.locator("#keep").click();
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let seed = 421;
    Math.random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  });
});
test("desktop: legal opening, keyboard draw/place, ploys, rules and restart", async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("#board .card")).toHaveCount(21);
  await opening(page);
  await page.locator("h1").click();
  await page.keyboard.press("Space");
  await expect(page.locator("#turn")).toHaveText("TURN 01");
  if (await page.locator(".grid-card.legal").count()) {
    const id = await page
      .locator(".grid-card.legal")
      .first()
      .getAttribute("id");
    await page.keyboard.press(String(Number(id.split("-")[1]) + 1));
    await expect(page.locator("#draw")).toBeEnabled();
  }
  let actions = 0;
  let ploys = 0;
  for (; actions < 80; actions++) {
    if (await page.locator("#terminal").isVisible()) break;
    if (await page.locator(".royal.legal").count())
      await page.locator(".royal.legal").first().click();
    else if (await page.locator(".grid-card.legal").count())
      await page.locator(".grid-card.legal").first().click();
    else if (await page.locator("#draw").isEnabled())
      await page.locator("#draw").click();
    else if (await page.locator("#tools button:enabled").count()) {
      await page.locator("#tools button:enabled").first().click();
      ploys++;
    } else throw new Error("Game stalled without a legal UI action");
  }
  expect(actions).toBeGreaterThan(15);
  expect(ploys).toBeGreaterThan(0);
  await page.screenshot({
    path: testInfo.outputPath("desktop.png"),
    fullPage: true,
  });
  await page.locator("#rules-open").click();
  await expect(page.locator("#rules")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#rules")).not.toBeVisible();
  const oldTurn = await page.locator("#turn").textContent();
  await page.locator("#new").click();
  await page.locator("#confirm-no").click();
  await expect(page.locator("#turn")).toHaveText(oldTurn);
  await page.locator("#new").click();
  await page.locator("#confirm-yes").click();
  await expect(page.locator("#turn")).toHaveText("TURN 00");
  expect(errors).toEqual([]);
});
test("mobile: no horizontal overflow, classic centre, mode confirmation and accessible controls", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator("#mode").selectOption("classic");
  await page.locator("#confirm-no").click();
  await expect(page.locator("#mode")).toHaveValue("revised");
  await page.locator("#mode").selectOption("classic");
  await page.locator("#confirm-yes").click();
  await expect(page.locator("#mode-badge")).toHaveText("CLASSIC / V1");
  await expect(page.locator("#grid-4")).toHaveAttribute(
    "aria-label",
    /Empty, stack 0/,
  );
  await opening(page);
  await page.locator("#draw").click();
  await expect(page.locator("#turn")).toHaveText("TURN 01");
  if (await page.locator(".grid-card.legal").count())
    await page.locator(".grid-card.legal").first().click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(await page.locator("#board button[aria-label]").count()).toBe(21);
  await page.screenshot({
    path: testInfo.outputPath("mobile.png"),
    fullPage: true,
  });
});
