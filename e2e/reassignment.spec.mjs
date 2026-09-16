import { test, expect } from "@playwright/test";
import { deck } from "../engine.mjs";

test("last joker kill cycles a royal and restores the blocked hand for armour", async ({
  page,
}, testInfo) => {
  const prefix = "S6 S7 S8 H5 C3 C4 H3 D4 D5 S11 X0 D9 H2".split(" ");
  const ids = deck().map((c) => c.id);
  const desired = [...prefix, ...ids.filter((id) => !prefix.includes(id))];
  // Drive the real shuffle, without replacing engine code or injecting game state.
  const randoms = [];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = ids.indexOf(desired[i]);
    randoms.push((j + 0.5) / (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  expect(ids).toEqual(desired);
  await page.addInitScript((values) => {
    Math.random = () => values.shift();
  }, randoms);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.locator("#keep").click();
  await page.locator("#draw").click();
  await expect(page.locator("#pending strong")).toHaveText("J♠");
  await page.locator("#royal-2").click();
  await page.locator("#draw").click();
  await page.locator("#draw").click();
  await expect(page.locator("#pending strong")).toHaveText("9♦");
  await page.locator("#grid-4").click();
  await page.locator("#draw").click();
  await expect(page.locator("#pending strong")).toHaveText("2♥");
  await expect(page.locator(".grid-card.legal")).toHaveCount(0);
  await page.getByRole("button", { name: /Reassign/ }).click();
  await page.locator("#grid-4").click();
  await page.locator("#grid-8").click();
  await expect(page.locator("#royal-2")).toHaveAttribute(
    "aria-label",
    /defeated/,
  );
  await expect(page.getByRole("button", { name: /Reassign/ })).toBeDisabled();
  await expect(page.locator("#pending strong")).toHaveText("Q♠");
  await expect(page.locator("#hint")).toHaveText(
    "Select a highlighted border slot. Ties are your choice.",
  );
  await expect(page.locator("#deck-count")).toHaveText("40");
  await page.locator(".royal.legal").first().click();
  await expect(page.locator("#pending strong")).toHaveText("2♥");
  await expect(page.locator(".royal.legal")).toHaveCount(1);
  await page.locator(".royal.legal").click();
  await expect(page.locator("#status")).toHaveText("Q♠ now has 14 health.");
  await expect(page.locator("#draw")).toBeEnabled();
  await expect(page.locator("#terminal")).toBeHidden();
  await page.locator("#draw").click();
  await expect(page.locator("#pending strong")).toHaveText("K♠");
  await expect(page.locator(".royal.legal").first()).toBeVisible();
  expect(errors).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("reassignment-recovered.png"),
    fullPage: true,
  });
});
