// Full-stack flows. They need the running stack (API + Postgres + Supabase Auth) and seeded
// users; they are skipped unless E2E_FULL=1. See docs/testing-and-evaluation.md for setup.
import { expect, test, type Page } from "@playwright/test";

declare const process: { env: Record<string, string | undefined> };

const full = process.env.E2E_FULL === "1";
const MEMBER = { email: process.env.E2E_MEMBER_EMAIL ?? "", password: process.env.E2E_PASSWORD ?? "" };
const MEMBER2 = { email: process.env.E2E_MEMBER2_EMAIL ?? "", password: process.env.E2E_PASSWORD ?? "" };
const ADMIN = { email: process.env.E2E_ADMIN_EMAIL ?? "", password: process.env.E2E_PASSWORD ?? "" };

async function signIn(page: Page, who: { email: string; password: string }) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password").fill(who.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/availability$/);
}

const stamp = () => Date.now().toString(36);

async function adminCreatesSlot(page: Page, name: string) {
  await signIn(page, ADMIN);
  await page.goto("/admin/resources");
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create resource" }).click();
  await expect(page.getByText("Resource created.")).toBeVisible();
  await page.getByRole("button", { name: `Add slot to ${name}` }).click();
  const start = new Date(Date.now() + 48 * 3600e3);
  const end = new Date(start.getTime() + 3600e3);
  const fmt = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  await page.getByLabel("Start").fill(fmt(start));
  await page.getByLabel("End").fill(fmt(end));
  await page.getByRole("button", { name: "Create slot" }).click();
  await expect(page.getByText("Slot created.")).toBeVisible();
}

test.describe("full stack", () => {
  test.skip(!full, "set E2E_FULL=1 with a running stack");

  test("admin creates resource+slot; member books it, cancels it; waitlist promotes", async ({ browser }) => {
    const name = `E2E Room ${stamp()}`;
    const adminCtx = await browser.newContext();
    await adminCreatesSlot(await adminCtx.newPage(), name);

    const m1 = await (await browser.newContext()).newPage();
    await signIn(m1, MEMBER);
    await m1.getByLabel("Location").fill("");
    await m1.getByRole("link", { name: new RegExp(`View ${name}`) }).first().click();
    await m1.getByRole("button", { name: "Book this slot" }).click();
    await m1.getByRole("button", { name: "Confirm booking" }).click();
    await expect(m1).toHaveURL(/\/bookings$/);
    await expect(m1.getByText(name)).toBeVisible();

    const m2 = await (await browser.newContext()).newPage();
    await signIn(m2, MEMBER2);
    await m2.getByRole("checkbox", { name: "Available only" }).uncheck();
    await m2.getByRole("link", { name: new RegExp(`View ${name}`) }).first().click();
    await m2.getByRole("button", { name: "Join the waitlist" }).click();
    await expect(m2).toHaveURL(/\/waitlist$/);
    await expect(m2.getByText("Position in queue: 1")).toBeVisible();

    await m1.getByRole("button", { name: `Cancel booking for ${name}` }).click();
    await m1.getByRole("button", { name: "Yes, cancel booking" }).click();
    await expect(m1.getByText(`Your booking for ${name} was cancelled.`)).toBeVisible();

    await m2.goto("/bookings");
    await expect(m2.getByText(name)).toBeVisible();
    await m2.goto("/notifications");
    await expect(m2.getByText(/A spot opened up/)).toBeVisible();
  });

  test("member cannot reach admin pages", async ({ page }) => {
    await signIn(page, MEMBER);
    await page.goto("/admin/resources");
    await expect(page.getByRole("alert")).toContainText("Not authorised");
  });
});
