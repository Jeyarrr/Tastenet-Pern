import { test, expect } from "@playwright/test";
import { fixture } from "./fixtures.js";

for (const role of [null, "customer"]) {
  test(`${role || "public"} content and controls remain visible when scroll callbacks never arrive`, async ({
    page,
  }) => {
    await fixture(page, role);
    // Simulate a stalled visibility observer, including sections below the fold.
    await page.addInitScript(() => {
      window.IntersectionObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
    });
    await page.goto(role ? "/customer" : "/");
    await expect(page.locator(".menu-container")).toHaveCount(2);
    await expect
      .poll(() => page.locator(".storefront-reveal").count())
      .toBeGreaterThan(20);
    const hidden = await page
      .locator(".storefront-reveal")
      .evaluateAll((elements) =>
        elements
          .filter((element) => element.getClientRects().length > 0)
          .filter((element) => {
            const style = getComputedStyle(element);
            return (
              Number(style.opacity) < 1 ||
              style.visibility !== "visible" ||
              style.pointerEvents === "none"
            );
          })
          .map((element) => element.className),
      );
    expect(hidden).toEqual([]);
    for (const selector of ["#menu", "#about", "#contact", ".main-footer"]) {
      await page.locator(selector).scrollIntoViewIfNeeded();
      await expect(page.locator(selector)).toBeVisible();
    }
    await page.locator(".add-to-cart-btn-text").first().click();
    if (role) {
      await expect(
        page.getByRole("button", { name: "Shopping cart, 1 items" }),
      ).toBeVisible();
    } else {
      await expect(
        page.getByRole("dialog", { name: "Sign in to start your order" }),
      ).toBeVisible();
    }
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  });
}
