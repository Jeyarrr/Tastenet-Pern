import { test, expect } from "@playwright/test";
import { fixture } from "./fixtures.js";

test("original sidebar and palette remain, report panels stay anchored", async ({
  page,
}) => {
  await fixture(page, "superadmin");
  await page.goto("/superadmin?page=reports");
  await expect(page.locator(".logo-text")).toHaveText("Caballeros Tastenet");
  await expect(page.locator(".content")).toHaveCSS(
    "background-color",
    "rgb(255, 250, 243)",
  );
  const card = page.locator(".chart-box").first();
  await card.hover();
  await expect(card).toHaveCSS("transform", "none");
  const bounds = await card.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 2);
  const drift = await card.evaluate(async (el) => {
    const start = el.getBoundingClientRect();
    let max = 0;
    for (let i = 0; i < 25; i++) {
      await new Promise(requestAnimationFrame);
      const now = el.getBoundingClientRect();
      max = Math.max(
        max,
        Math.abs(now.y - start.y) + Math.abs(now.height - start.height),
      );
    }
    return max;
  });
  expect(drift).toBeLessThan(1);
  const point = page.locator(".migration-revenue-svg circle").first();
  await point.focus();
  await expect(page.locator(".v2-chart-readout strong")).toBeVisible();
});

test("rider profile avatars stay circular on desktop and mobile", async ({
  page,
}) => {
  await fixture(page, "rider");
  await page.goto("/rider?page=profile");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const avatar = page
      .locator(".account-photo-button .account-avatar")
      .first();
    await expect(avatar).toBeVisible();
    const bounds = await avatar.boundingBox();
    expect(Math.abs(bounds.width - bounds.height)).toBeLessThan(1);
  }
});
