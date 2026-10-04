import { test, expect } from "@playwright/test";
import { fixture } from "./fixtures.js";

test("signup is a two-column landing dialog with username availability and a success-to-login flow", async ({
  page,
}) => {
  await fixture(page, null);
  let registration;
  await page.route("**/api/auth/username-availability?**", (route) =>
    route.fulfill({
      json: {
        available:
          new URL(route.request().url()).searchParams.get("username") !==
          "existing",
      },
    }),
  );
  await page.route("**/api/auth/register", (route) => {
    registration = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { user: { id: 8 } } });
  });
  await page.goto("/login");
  await expect(
    page.getByRole("dialog", { name: "Sign In", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".customer-storefront")).toHaveCount(1);
  await expect
    .poll(() =>
      page
        .locator(".modal-auth-login > .migration-modal")
        .evaluate((el) => getComputedStyle(el).animationName),
    )
    .toBe("login-glowPulse");
  await page.getByRole("link", { name: "Create your account" }).click();
  const form = page.getByRole("dialog", {
    name: "Create Customer Account",
    exact: true,
  });
  await expect(
    form.getByRole("link", { name: "Back to sign in" }),
  ).toBeVisible();
  await expect(form.getByText("Gender", { exact: true })).toHaveCount(0);
  await expect(form.getByLabel("Middle Initial")).toHaveCount(0);
  await form.getByLabel("Username", { exact: true }).fill("existing");
  await expect(
    form.getByText("Already taken. Try another username."),
  ).toBeVisible();
  await expect(
    form.getByRole("button", { name: "REGISTER", exact: true }),
  ).toBeDisabled();
  await form.getByLabel("Username", { exact: true }).fill("sample_new");
  await expect(form.getByText("This username is available.")).toBeVisible();
  await form.getByLabel("First Name", { exact: true }).fill("New");
  await form.getByLabel("Last Name", { exact: true }).fill("Customer");
  await form.getByLabel("Email", { exact: true }).fill("new@example.test");
  await form.getByLabel("Mobile number", { exact: true }).fill("09123456789");
  await form.getByLabel("House / Building No.", { exact: true }).fill("12");
  await form.getByLabel("Street", { exact: true }).fill("Sample Street");
  await form
    .getByLabel("Barangay", { exact: true })
    .selectOption("Sample Barangay");
  await form
    .getByLabel("Password", { exact: true })
    .fill("Synthetic-Password1!");
  await form
    .getByLabel("Confirm Password", { exact: true })
    .fill("Synthetic-Password1!");
  await form
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await expect(form.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await expect(
    form.getByLabel("Confirm Password", { exact: true }),
  ).toHaveAttribute("type", "password");
  await page.setViewportSize({ width: 390, height: 844 });
  const row = await form
    .locator(".account-fields-grid")
    .first()
    .evaluate((el) => {
      const a = el.children[0].getBoundingClientRect(),
        b = el.children[1].getBoundingClientRect();
      return Math.abs(a.top - b.top) < 1 && b.left > a.left;
    });
  expect(row).toBe(true);
  await form.getByRole("button", { name: "REGISTER", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Account Created" }),
  ).toBeVisible();
  expect(registration.phone).toBe("+639123456789");
  expect(registration.addressDetails.barangay).toBe("Sample Barangay");
  expect(registration).not.toHaveProperty("gender");
  expect(registration.fullName).toBe("New Customer");
  await page.getByRole("button", { name: "Log In", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Sign In", exact: true }),
  ).toBeVisible();
});

for (const role of ["customer", "rider", "admin", "superadmin"])
  test(`landing login routes ${role} to its assigned portal`, async ({
    page,
  }) => {
    await fixture(page, null);
    await page.route("**/api/auth/login", (route) =>
      route.fulfill({
        json: {
          user: {
            id: role === "rider" ? 3 : 1,
            role,
            username: `sample_${role}`,
            email: `${role}@example.test`,
            fullName: `Sample ${role}`,
          },
        },
      }),
    );
    await page.route("**/api/auth/profile", (route) =>
      route.fulfill({
        json: {
          profile: {
            id: 1,
            role,
            full_name: `Sample ${role}`,
            email: `${role}@example.test`,
            phone: "09123456789",
          },
        },
      }),
    );
    await page.goto("/login");
    await page
      .getByLabel("Username or email", { exact: true })
      .fill(`sample_${role}`);
    await page
      .getByLabel("Password", { exact: true })
      .fill("Synthetic-Password1!");
    await page.getByRole("button", { name: "LOGIN", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${role}$`));
    await expect(
      page.getByRole("dialog", { name: "Sign In", exact: true }),
    ).toHaveCount(0);
  });

test("customer cart badge and right-side drawer, read-only profile, password-protected editing and photo preview", async ({
  page,
}) => {
  await fixture(page, "customer");
  const writes = [];
  await page.route("**/api/auth/profile", async (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    const body = route.request().postDataJSON();
    writes.push(body);
    if (body.currentPassword !== "Synthetic-Password1!")
      return route.fulfill({
        status: 403,
        json: { error: { message: "Your current password is incorrect" } },
      });
    return route.fulfill({
      json: {
        profile: {
          id: 1,
          role: "customer",
          username: "sample_customer",
          full_name: body.fullName,
          email: body.email,
          phone: body.phone,
          address: "12 Sample Street",
          address_details: body.addressDetails,
          profile_photo: "/original-assets/LOGO.png",
        },
      },
    });
  });
  await page.goto("/customer");
  await page.locator(".add-to-cart-btn-text").first().click();
  await page.locator(".add-to-cart-btn-text").first().click();
  await expect(page.locator(".storefront-cart-count")).toHaveText("2");
  await expect(page.locator(".storefront-cart-count")).toBeVisible();
  await page.getByRole("button", { name: "Shopping cart, 2 items" }).click();
  const cart = page.getByRole("dialog", { name: "Your order", exact: true });
  await expect(cart).toBeVisible();
  await expect
    .poll(async () => {
      let box = await cart.boundingBox();
      return (
        box.x > page.viewportSize().width / 2 &&
        box.x + box.width > page.viewportSize().width - 50
      );
    })
    .toBe(true);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "My account" }).click();
  await page.getByRole("button", { name: "My Profile", exact: true }).click();
  const profile = page.getByRole("dialog", { name: "My Profile", exact: true });
  await expect(profile.locator("input")).toHaveCount(0);
  await profile
    .getByRole("button", { name: "Edit Profile", exact: true })
    .click();
  const editor = page.getByRole("dialog", {
    name: "Edit Profile",
    exact: true,
  });
  await editor
    .getByLabel("Full name", { exact: true })
    .fill("Updated Customer");
  await editor
    .getByLabel("Email", { exact: true })
    .fill("updated@example.test");
  await editor
    .getByLabel("Mobile number", { exact: true })
    .fill("+639987654321");
  await editor.getByLabel("Update delivery address").check();
  await editor.getByLabel("House / Building No.", { exact: true }).fill("12");
  await editor.getByLabel("Street", { exact: true }).fill("Sample Street");
  await editor
    .getByLabel("Barangay", { exact: true })
    .selectOption("Sample Barangay");
  await editor
    .getByLabel("Current password", { exact: true })
    .fill("Wrong-Password1!");
  await editor
    .getByRole("button", { name: "Save Changes", exact: true })
    .click();
  await expect(editor.getByRole("alert")).toContainText("incorrect");
  await expect(editor).toBeVisible();
  await editor
    .getByLabel("Current password", { exact: true })
    .fill("Synthetic-Password1!");
  await page.setViewportSize({ width: 390, height: 844 });
  await editor
    .getByRole("button", { name: "Save Changes", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  await expect(profile).toContainText("updated@example.test");
  await expect(profile).toContainText("+639987654321");
  expect(writes.at(-1).addressDetails).toEqual({
    houseNumber: "12",
    street: "Sample Street",
    barangay: "Sample Barangay",
  });
  await profile.getByRole("button", { name: "View profile picture" }).click();
  const preview = page.getByRole("dialog", {
    name: "Profile Picture",
    exact: true,
  });
  await expect(preview.locator(".account-avatar img")).toBeVisible();
  await expect(preview.locator(".account-avatar")).toHaveCSS(
    "border-radius",
    "50%",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 2,
    ),
  ).toBe(false);
});

test("rider profile starts read-only and submits vehicle details with password confirmation", async ({
  page,
}) => {
  await fixture(page, "rider");
  let saved;
  await page.route("**/api/auth/profile", (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    saved = route.request().postDataJSON();
    return route.fulfill({
      json: {
        profile: {
          id: 3,
          role: "rider",
          full_name: saved.fullName,
          email: saved.email,
          phone: saved.phone,
        },
      },
    });
  });
  await page.goto("/rider?page=profile");
  await expect(
    page.getByRole("button", { name: "Edit Information", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".account-profile-panel input")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Edit Information", exact: true })
    .click();
  const editor = page.getByRole("dialog", { name: "Edit Rider Information" });
  await editor.getByLabel("License Plate", { exact: true }).fill("SAMPLE-123");
  await editor
    .getByLabel("Current password", { exact: true })
    .fill("Synthetic-Password1!");
  await editor
    .getByRole("button", { name: "Save Changes", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  expect(saved.vehicleDetails.licensePlate).toBe("SAMPLE-123");
  expect(saved.currentPassword).toBe("Synthetic-Password1!");
});

test("superadmin account status dialogs require password for customers, riders and staff", async ({
  page,
}) => {
  await fixture(page, "superadmin");
  const writes = [];
  await page.route("**/api/manage/users/*/active", (route) => {
    const body = route.request().postDataJSON();
    writes.push(body);
    return body.currentPassword === "Synthetic-Password1!"
      ? route.fulfill({ json: { user: {} } })
      : route.fulfill({
          status: 403,
          json: { error: { message: "Your current password is incorrect" } },
        });
  });
  for (const [tab, button] of [
    ["customers", "Block Sample customer"],
    ["personnel", "Block Sample rider"],
    ["settings", "Deactivate"],
  ]) {
    await page.goto(`/superadmin?page=${tab}`);
    await page
      .getByRole("button", { name: button, exact: true })
      .first()
      .click();
    const dialog = page.getByRole("dialog", { name: "Deactivate Account" });
    await expect(
      dialog.getByRole("button", { name: "Confirm", exact: true }),
    ).toBeDisabled();
    await dialog
      .getByLabel("Superadmin password", { exact: true })
      .fill("wrong");
    await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("incorrect");
    await dialog
      .getByLabel("Superadmin password", { exact: true })
      .fill("Synthetic-Password1!");
    await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(dialog).toHaveCount(0);
  }
  expect(
    writes.filter((body) => body.currentPassword === "Synthetic-Password1!"),
  ).toHaveLength(3);
  const card = page.locator(".settings-card").first();
  await card.hover({
    position: { x: 10, y: (await card.boundingBox()).height - 2 },
  });
  await expect(card).toHaveCSS("transform", "none");
});
