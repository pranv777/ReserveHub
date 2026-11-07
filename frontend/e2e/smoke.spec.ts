import { expect, test } from "@playwright/test";

// Deterministic, backend-free checks of the access-control shell.
test("anonymous visitors see the homepage and can reach sign in", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Book a slot. If it's taken, join the line." })).toBeVisible();
  await page.getByRole("link", { name: "Sign in" }).first().click();
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByRole("heading", { name: "Sign in to ReserveHub" })).toBeVisible();
});

test("protected pages redirect anonymous visitors to sign in", async ({ page }) => {
  await page.goto("/availability");
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByRole("heading", { name: "Sign in to ReserveHub" })).toBeVisible();
});

test("the documentation page is public", async ({ page }) => {
  await page.goto("/docs");
  await expect(page.getByRole("heading", { level: 1, name: "ReserveHub documentation" })).toBeVisible();
});

test("admin routes are not reachable anonymously", async ({ page }) => {
  await page.goto("/admin/resources");
  await expect(page).toHaveURL(/\/signin$/);
});

test("sign-in form validates before calling the provider", async ({ page }) => {
  await page.goto("/signin");
  await page.getByLabel("Email").fill("nope");
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Enter a valid email address")).toBeVisible();
});
