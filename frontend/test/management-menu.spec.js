import { test, expect } from "@playwright/test";
import { fixture, menu } from "./fixtures.js";

const items = Array.from({ length: 36 }, (_, index) => ({
  ...menu[index % menu.length],
  id: index + 1,
  food_name: `Sample Meal ${index + 1}`,
  food_type: ["Silog", "Sizzling Specials", "Beverage"][Math.floor(index / 12)],
}));

for (const role of ["admin", "superadmin"]) {
  for (const width of [1440, 390]) {
    test(`${role} menu remains readable while scrolling and hovering at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await fixture(page, role);
      await page.route("**/api/staff/menu", (route) =>
        route.fulfill({ json: { items } }),
      );
      await page.goto(`/${role}?page=menu`);
      await expect(page.locator(".menu-card")).toHaveCount(items.length);
      const surface = page.locator("main.content");
      const bounds = await surface.boundingBox();
      await page.mouse.move(bounds.x + bounds.width / 2, 450);
      for (const delta of [600, 750, 900, -650, 1200, 1400]) {
        const previous = await surface.evaluate((el) => el.scrollTop);
        await page.mouse.wheel(0, delta);
        await expect
          .poll(() => surface.evaluate((el) => el.scrollTop))
          .not.toBe(previous);
        const visible = await page
          .locator(".menu-card")
          .evaluateAll((elements) =>
            elements
              .filter((el) => {
                const rect = el.getBoundingClientRect();
                return rect.top < innerHeight && rect.bottom > 0;
              })
              .map((el) => {
                let readable = true;
                for (let node = el; node; node = node.parentElement) {
                  const style = getComputedStyle(node);
                  if (
                    Number(style.opacity) !== 1 ||
                    style.visibility !== "visible"
                  )
                    readable = false;
                }
                return { readable, title: el.querySelector("h3").textContent };
              }),
          );
        expect(visible.length).toBeGreaterThan(0);
        expect(visible.every((item) => item.readable && item.title)).toBe(true);
      }
      const card = page.locator(".menu-card").first();
      await card.scrollIntoViewIfNeeded();
      await page.mouse.move(0, 0);
      const initial = await card.boundingBox();
      // A fixed pointer at the card's edge previously triggered repeated lift/scale.
      await page.mouse.move(initial.x + initial.width / 2, initial.y + 2);
      const movement = await card.evaluate(async (el) => {
        const positions = [];
        for (let i = 0; i < 20; i++) {
          await new Promise((resolve) => requestAnimationFrame(resolve));
          const rect = el.getBoundingClientRect();
          positions.push([rect.x, rect.y, rect.width, rect.height]);
        }
        return positions;
      });
      for (const [x, y, w, h] of movement) {
        expect(
          Math.abs(x - initial.x) +
            Math.abs(y - initial.y) +
            Math.abs(w - initial.width) +
            Math.abs(h - initial.height),
        ).toBeLessThan(1);
      }
      await page.screenshot({
        path: `test-results/menu-stable-${role}-${width}.png`,
        animations: "disabled",
      });
      await page.getByLabel("Search menu").fill("Sample Meal 36");
      await expect(page.locator(".menu-card")).toHaveCount(1);
      await page
        .getByRole("button", { name: "View Sample Meal 36", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.getByRole("button", { name: "Close dialog" }).click();
      await page.getByRole("button", { name: "Add Menu", exact: true }).hover();
      await expect
        .poll(() =>
          page
            .getByRole("button", { name: "Add Menu", exact: true })
            .evaluate((el) => getComputedStyle(el).animationName),
        )
        .toBe("tastenet-button-pulse");
      expect(errors).toEqual([]);
    });
  }
}
