import { test, expect } from "@playwright/test";

// Use synthetic accounts through mocked API responses. No source passwords or
// customer records are embedded in screenshots or test fixtures.
import { fixture, order } from "./fixtures.js";
async function verify(page, name) {
  await expect(page.locator("body")).not.toHaveText("");
  await expect(
    page.getByRole("heading", { name: "This page could not load" }),
  ).toHaveCount(0);
  await expect(page.locator(".migration-loading")).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.querySelectorAll("img")]
          .filter((img) => img.getBoundingClientRect().top < window.innerHeight)
          .every((img) => img.complete && img.naturalWidth > 0),
      ),
    )
    .toBe(true);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 2,
  );
  expect(overflow, `${name} has horizontal page overflow`).toBe(false);
  await page.screenshot({
    path: `test-results/design-${name}.png`,
    animations: "disabled",
  });
}

test("original public website and account forms render on desktop and mobile", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await fixture(page, null);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Sizzling Good Food, Delivered Hot!" }),
  ).toBeVisible();
  await verify(page, "landing-desktop");
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
  await verify(page, "login-desktop");
  await page.goto("/register");
  await expect(
    page.getByRole("heading", { name: "Create Customer Account" }),
  ).toBeVisible();
  await verify(page, "register-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await verify(page, "register-mobile");
  await page.goto("/");
  await verify(page, "landing-mobile");
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await expect(page.locator(".mobile-nav-drawer")).toBeVisible();
  expect(errors).toEqual([]);
});

for (const role of ["customer", "admin", "rider", "superadmin"])
  test(`${role} screens and dialogs render without errors`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await fixture(page, role);
    await page.goto(`/${role}`);
    await verify(page, `${role}-desktop`);
    if (role === "customer") {
      await page.locator(".add-to-cart-btn-text").first().click();
      await page
        .getByRole("button", { name: "Shopping cart, 1 items" })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Your order" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Checkout", exact: true }).click();
      await expect(
        page.getByRole("dialog", { name: "Checkout" }),
      ).toBeVisible();
      await verify(page, "checkout-desktop");
      await page.getByRole("button", { name: "Close dialog" }).click();
    } else {
      const navigation =
        role === "admin"
          ? ["Inventory", "RecipeManager", "Menu", "Ticketing", "Order History"]
          : role === "rider"
            ? ["Dashboard", "Delivery History", "Profile"]
            : [
                "Dashboard",
                "Inventory",
                "RecipeManager",
                "Menu",
                "Ticketing",
                "Transactions",
                "Reports",
                "Customers",
                "Delivery",
                "Settings",
              ];
      for (const label of navigation) {
        await page
          .getByRole("navigation")
          .getByRole("button", { name: label, exact: true })
          .click();
        if (label === "Order History") {
          await page
            .getByRole("combobox", { name: "History status" })
            .selectOption("Completed");
          await expect(page.locator(".orders-table tbody tr")).toHaveCount(1);
          await page.getByRole("button", { name: "Reset Filters" }).click();
          await expect(page.locator(".orders-table tbody tr")).toHaveCount(2);
          const download = page.waitForEvent("download");
          await page.getByRole("button", { name: "Export Report" }).click();
          expect((await download).suggestedFilename()).toBe(
            "TasteNet-order-history.csv",
          );
        }
        if (label === "Reports") {
          await page
            .getByRole("combobox", { name: "Report period" })
            .selectOption("Daily");
          await expect(
            page.getByRole("img", { name: /^Revenue chart/ }),
          ).toBeVisible();
          await page
            .getByRole("button", { name: "Orders", exact: true })
            .click();
          await expect(
            page.getByRole("img", { name: /^Orders chart/ }),
          ).toBeVisible();
          await page
            .getByRole("button", { name: "Revenue", exact: true })
            .click();
          const download = page.waitForEvent("download");
          await page.getByRole("button", { name: "Export Report" }).click();
          expect((await download).suggestedFilename()).toBe(
            "TasteNet-report.xml",
          );
        }
        await verify(
          page,
          `${role}-${label.toLowerCase().replaceAll(" ", "-")}`,
        );
        if (["Reports", "Order History"].includes(label)) {
          await page.setViewportSize({ width: 390, height: 844 });
          await verify(
            page,
            `${role}-${label.toLowerCase().replaceAll(" ", "-")}-mobile`,
          );
          await page.setViewportSize({ width: 1440, height: 1000 });
        }
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await verify(page, `${role}-mobile`);
    expect(errors).toEqual([]);
  });

test("management editors, nested dialog focus, hover effects and mobile uploads", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await fixture(page, "superadmin");
  const writes = [];
  await page.route("**/api/manage/users/3/**", (route) =>
    route.fulfill({
      json: {
        user: {
          id: 3,
          full_name: "Sample rider",
          email: "rider@example.test",
          role: "rider",
        },
        orders: [order],
        documents: [
          {
            column: "driver_license_photo",
            url: "/original-assets/LOGO.png",
            status: "pending",
          },
        ],
      },
    }),
  );
  await page.route("**/api/manage/payment-methods", (route) => {
    writes.push(route.request().postDataJSON());
    return route.fulfill({ status: 201, json: { method: { id: 2 } } });
  });
  await page.goto("/superadmin?page=settings");
  await page.getByRole("button", { name: "Add Payment Method" }).click();
  const dialog = page.getByRole("dialog", { name: "Add Payment Method" });
  await expect(dialog).toBeVisible();
  await page.getByLabel("Method name").fill("Sample Wallet");
  await page.getByLabel("Account details").fill("Synthetic account");
  const save = page.getByRole("button", { name: "Save Changes" });
  await save.hover();
  await expect
    .poll(() => save.evaluate((el) => getComputedStyle(el).animationName))
    .toBe("tastenet-button-pulse");
  const close = page.getByRole("button", { name: "Close dialog" });
  await close.hover();
  await expect
    .poll(() => close.evaluate((el) => getComputedStyle(el).borderRadius))
    .toBe("50%");
  await expect
    .poll(() => close.evaluate((el) => getComputedStyle(el).transform))
    .toBe("matrix(0, 1, -1, 0, 0, 0)");
  await close.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(save).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await verify(page, "payment-editor-mobile");
  await save.click();
  await expect(dialog).toHaveCount(0);
  expect(writes[0].name).toBe("Sample Wallet");
  await page.goto("/superadmin?page=personnel");
  await page
    .getByRole("button", { name: "View Sample rider", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Rider Documents" }),
  ).toBeVisible();
  await verify(page, "rider-review-mobile");
  await page
    .getByRole("button", { name: "Remove Account", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Remove Account" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Sample rider" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove Account", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#root")).not.toHaveAttribute("inert");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/superadmin?page=settings");
  await page.getByRole("button", { name: "Add Payment Method" }).click();
  await page.getByRole("button", { name: "Close dialog" }).hover();
  await expect
    .poll(() =>
      page
        .getByRole("button", { name: "Close dialog" })
        .evaluate((el) => getComputedStyle(el).transform),
    )
    .toBe("none");
  expect(errors).toEqual([]);
});

test("customer cart persists and receipt confirmation opens rating", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await fixture(page, "customer");
  let status = "In Progress",
    rated = false;
  await page.route("**/api/orders/1/details", (route) =>
    route.fulfill({
      json: {
        order: { ...order, status },
        items: [
          {
            id: 1,
            menu_id: 1,
            food_name: "Tapsilog",
            quantity: 2,
            sub_total: 240,
          },
        ],
        proofs: [],
        history: [],
        rating: rated ? { rating: 5, comment: "Sample feedback" } : null,
      },
    }),
  );
  await page.route("**/api/orders/1/status", (route) => {
    status = route.request().postDataJSON().status;
    return route.fulfill({ json: { order: { ...order, status } } });
  });
  await page.route("**/api/orders/1/rating", (route) => {
    rated = true;
    return route.fulfill({ status: 201, json: { message: "Saved" } });
  });
  await page.goto("/customer");
  await page.locator(".add-to-cart-btn-text").first().click();
  await page.reload();
  await page.getByRole("button", { name: "Shopping cart, 1 items" }).click();
  await expect(page.getByRole("dialog", { name: "Your order" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "My account" }).click();
  await page.getByRole("button", { name: "My Orders" }).click();
  await page
    .getByRole("button", { name: "Details, Proofs & Rating" })
    .first()
    .click();
  await page.getByRole("button", { name: "Confirm Receipt" }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Submit Rating" }),
  ).toBeVisible();
  await page.getByLabel("Comment (optional)").fill("Sample feedback");
  await page.getByRole("button", { name: "Submit Rating" }).click();
  await expect(page.getByText(/Your rating: 5\/5/)).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await verify(page, "order-details-mobile");
  expect(errors).toEqual([]);
});

test("forgot password stays in a landing modal, returns to login and submits the email code", async ({
  page,
}) => {
  await fixture(page, null);
  const writes = [];
  await page.route("**/api/auth/password/**", (route) => {
    writes.push({
      path: new URL(route.request().url()).pathname,
      ...route.request().postDataJSON(),
    });
    return route.fulfill({ json: { message: "OK" } });
  });
  await page.goto("/login");
  await page.getByLabel("Username or email").fill("sample@example.test");
  await page
    .locator(".customer-storefront")
    .evaluate((el) => (el.dataset.recoveryBackground = "preserved"));
  await page
    .getByRole("button", { name: "Forgot Password?", exact: true })
    .click();
  const recovery = page.getByRole("dialog", {
    name: "Forgot Password?",
    exact: true,
  });
  await expect(recovery).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator(".customer-storefront")).toHaveAttribute(
    "data-recovery-background",
    "preserved",
  );
  await expect(page.locator("#root")).toHaveAttribute("inert");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Sign In", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Username or email")).toHaveValue(
    "sample@example.test",
  );
  await page
    .getByRole("button", { name: "Forgot Password?", exact: true })
    .click();
  await recovery.getByRole("button", { name: "Close dialog" }).click();
  await expect(
    page.getByRole("dialog", { name: "Sign In", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Forgot Password?", exact: true })
    .click();
  await page.getByLabel("Email address").fill("sample@example.test");
  await page.getByRole("button", { name: "SEND CODE", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await verify(page, "recovery-code-mobile");
  await page.getByLabel("Verification code").fill("123456");
  await page
    .getByLabel("New password", { exact: true })
    .fill("Test-password-123!");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("does-not-match");
  await page
    .getByRole("button", { name: "RESET PASSWORD", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Passwords do not match");
  await page
    .getByRole("button", { name: "Show new password", exact: true })
    .click();
  await expect(
    page.getByLabel("New password", { exact: true }),
  ).toHaveAttribute("type", "text");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("Test-password-123!");
  await page
    .getByRole("button", { name: "RESET PASSWORD", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Password reset successfully",
  );
  expect(writes.at(-1).code).toBe("123456");
  await verify(page, "recovery-mobile");
  await page
    .getByRole("button", { name: "Back to Sign In", exact: true })
    .click();
  await expect(page.getByLabel("Username or email")).toHaveValue(
    "sample@example.test",
  );
  await page.goto("/forgot-password");
  await expect(recovery).toBeVisible();
  await expect(page.locator(".customer-storefront")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Back to Sign In", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Sign In", exact: true }),
  ).toBeVisible();
});

test("guest cart actions require an account from the menu and meal details", async ({
  page,
}) => {
  await fixture(page, null);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Hungry? Order Now!", exact: true }),
  ).toHaveCount(1);
  await page.locator(".add-to-cart-btn-text").first().click();
  const prompt = page.getByRole("dialog", {
    name: "Sign in to start your order",
  });
  await expect(prompt).toBeVisible();
  await expect(
    prompt.getByRole("link", { name: "Sign In", exact: true }),
  ).toHaveAttribute("href", "/login");
  await expect(
    prompt.getByRole("link", { name: "Create Account" }),
  ).toHaveAttribute("href", "/register");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Shopping cart, 0 items" }),
  ).toBeVisible();
  await page.locator(".view-btn").first().click();
  await page.getByRole("button", { name: "Add to Cart", exact: true }).click();
  await expect(prompt).toBeVisible();
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Shopping cart, 0 items" }),
  ).toBeVisible();
});

test("rider navigation, photo upload, camera capture and camera denial", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await fixture(page, "rider");
  await page.route("https://www.google.com/maps**", (route) =>
    route.fulfill({ contentType: "text/html", body: "Synthetic map" }),
  );
  // Synthetic video avoids accessing any real camera or personal photos.
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      if (window.denyTestCamera)
        throw new DOMException("Denied", "NotAllowedError");
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      const drawing = canvas.getContext("2d");
      const draw = () => {
        drawing.fillStyle = "#7d0a22";
        drawing.fillRect(0, 0, 640, 480);
      };
      draw();
      const stream = canvas.captureStream(10);
      const timer = setInterval(draw, 100);
      const track = stream.getVideoTracks()[0];
      const stop = track.stop.bind(track);
      track.stop = () => {
        clearInterval(timer);
        stop();
      };
      window.testCameraTrack = track;
      return stream;
    };
  });
  const uploads = [],
    completions = [];
  await page.route("**/api/files?**", (route) => {
    uploads.push({
      type: route.request().headers()["content-type"],
      length: route.request().postDataBuffer().length,
      url: route.request().url(),
    });
    return route.fulfill({
      status: 201,
      json: { url: "/original-assets/LOGO.png" },
    });
  });
  await page.route("**/api/orders/1/status", (route) => {
    completions.push(route.request().postDataJSON());
    return route.fulfill({
      json: { order: { ...order, status: "Completed" } },
    });
  });
  await page.goto("/rider");
  await page.getByRole("button", { name: "Navigate", exact: true }).click();
  const navigation = page.getByRole("dialog", { name: "Delivery Navigation" });
  await expect(navigation).toContainText(order.delivery_address);
  const destination = new URL(
    await navigation
      .getByRole("link", { name: "Start Navigation" })
      .getAttribute("href"),
  );
  expect(destination.searchParams.get("destination")).toBe(
    order.delivery_address,
  );
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Mark as Delivered", exact: true })
    .click();
  const confirmation = page.getByRole("dialog", { name: "Confirm Delivery" });
  await expect(
    confirmation.getByRole("button", {
      name: "Mark as Delivered",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    confirmation.getByRole("button", { name: /Use Camera/ }),
  ).toBeVisible();
  await expect(
    confirmation.getByRole("button", { name: /Upload Image/ }),
  ).toBeVisible();
  const chooser = page.waitForEvent("filechooser");
  await confirmation.getByRole("button", { name: /Upload Image/ }).click();
  await (
    await chooser
  ).setFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
      "base64",
    ),
  });
  await expect(
    confirmation.getByAltText("Delivery proof ready to submit"),
  ).toBeVisible();
  expect(uploads[0].type).toBe("image/png");
  expect(new URL(uploads[0].url).searchParams.get("purpose")).toBe(
    "delivery-proof",
  );
  await confirmation.getByRole("button", { name: /Use Camera/ }).click();
  const camera = page.getByRole("dialog", { name: "Take a Delivery Photo" });
  await expect(
    camera.getByRole("button", { name: "Take Photo" }),
  ).toBeEnabled();
  await camera.getByRole("button", { name: "Take Photo" }).click();
  await expect(camera).toHaveCount(0);
  expect(uploads.at(-1).type).toBe("image/jpeg");
  expect(uploads.at(-1).length).toBeGreaterThan(100);
  expect(await page.evaluate(() => window.testCameraTrack.readyState)).toBe(
    "ended",
  );
  await page.evaluate(() => {
    window.denyTestCamera = true;
  });
  await confirmation.getByRole("button", { name: /Use Camera/ }).click();
  await expect(camera.getByRole("alert")).toContainText(
    "Camera permission was denied",
  );
  await expect(
    camera.getByRole("button", { name: "Take Photo" }),
  ).toBeDisabled();
  await camera.getByRole("button", { name: "Back to Photo Options" }).click();
  await confirmation
    .getByRole("button", { name: "Mark as Delivered", exact: true })
    .click();
  await expect(confirmation).toHaveCount(0);
  expect(completions).toEqual([
    { status: "Completed", proofUrl: "/original-assets/LOGO.png" },
  ]);
  expect(errors).toEqual([]);
});
