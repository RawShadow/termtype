import { expect, test, type Page } from "@playwright/test";
import { area, failOnConsoleErrors, openArena, setConfig, targets } from "./helpers";

/**
 * Guest-side account behavior. Never signs in or creates accounts: requests
 * to Supabase are either counted (and expected to be zero) or answered by a
 * local mock.
 */
failOnConsoleErrors();

const SUPABASE = "**/*.supabase.co/**";

/** Records every request to Supabase so tests can assert guests make none. */
async function watchSupabase(page: Page): Promise<string[]> {
  const hits: string[] = [];
  page.on("request", (req) => {
    if (/\.supabase\.co\//.test(req.url())) hits.push(req.url());
  });
  return hits;
}

async function finishWords10(page: Page) {
  const words = await targets(page);
  for (let i = 0; i < words.length; i++) {
    await page.keyboard.type(i < words.length - 1 ? words[i] + " " : words[i]);
    await page.clock.runFor(500);
  }
  await expect(area(page)).toHaveAttribute("data-status", "finished");
}

test("guests type with zero Supabase traffic, even if it's unreachable", async ({ page }) => {
  await page.route(SUPABASE, (route) => route.abort());
  const hits = await watchSupabase(page);
  await openArena(page);
  await expect(page.getByTestId("header-login")).toBeVisible();

  const [first, second] = await targets(page);
  await page.keyboard.type(`${first} ${second} `);
  await expect(area(page)).toHaveAttribute("data-status", "running");
  expect(hits).toEqual([]);
});

test("/profile sends guests to login", async ({ page }) => {
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/login\?next=%2Fprofile|\/login\?next=\/profile/);
  await expect(page.getByTestId("auth-form")).toBeVisible();
});

test("login form validates locally before contacting Supabase", async ({ page }) => {
  const hits = await watchSupabase(page);
  await page.goto("/login");
  await expect(page.getByTestId("auth-email")).toBeFocused();
  // OAuth buttons stay hidden unless NEXT_PUBLIC_AUTH_PROVIDERS enables them.
  await expect(page.locator('[data-testid^="auth-oauth-"]')).toHaveCount(0);

  await page.getByTestId("auth-submit").click();
  await expect(page.getByTestId("auth-error")).toHaveText("enter a valid email address");

  await page.getByTestId("auth-email").fill("typist@example.invalid");
  await page.getByTestId("auth-submit").click();
  await expect(page.getByTestId("auth-error")).toHaveText("enter your password");

  await page.getByTestId("auth-tab-signup").click();
  await expect(page.getByTestId("auth-submit")).toHaveText("create account");
  await page.getByTestId("auth-password").fill("short");
  await page.getByTestId("auth-submit").click();
  await expect(page.getByTestId("auth-error")).toHaveText("password needs at least 8 characters");
  expect(hits).toEqual([]);
});

test("login page shows known error codes only", async ({ page }) => {
  await page.goto("/login?error=link");
  await expect(page.getByTestId("auth-error")).toContainText("invalid or has expired");
  await page.goto("/login?error=%3Cb%3Ehi%3C%2Fb%3E");
  await expect(page.getByTestId("auth-form")).toBeVisible();
  await expect(page.getByTestId("auth-error")).toHaveCount(0);
});

test("sign-up without a session asks the user to confirm by email (mocked)", async ({ page }) => {
  // Answer locally: no account is created anywhere.
  await page.route("**/auth/v1/signup**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "00000000-0000-0000-0000-000000000001",
        aud: "authenticated",
        role: "",
        email: "typist@example.invalid",
        confirmation_sent_at: new Date().toISOString(),
        app_metadata: { provider: "email", providers: ["email"] },
        user_metadata: {},
        identities: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    }),
  );
  await page.goto("/login");
  await page.getByTestId("auth-tab-signup").click();
  await page.getByTestId("auth-email").fill("typist@example.invalid");
  await page.getByTestId("auth-password").fill("long-enough-password");
  await page.getByTestId("auth-submit").click();
  await expect(page.getByTestId("auth-check-email")).toContainText("typist@example.invalid");
});

test("results: guests can open sign-in without losing the run", async ({ page, context, baseURL }) => {
  const hits = await watchSupabase(page);
  await setConfig(context, baseURL, { mode: "words", words: 10 });
  await page.clock.install();
  await openArena(page);
  await finishWords10(page);

  await expect(page.getByTestId("save-status")).toHaveText("kept in this browser");
  await page.getByTestId("save-cta").click();
  await expect(page.getByTestId("auth-modal")).toBeVisible();
  await expect(page.getByTestId("auth-email")).toBeFocused();

  // Typing in the form never reaches the test.
  await page.keyboard.type("hello world");
  await expect(page.getByTestId("auth-email")).toHaveValue("hello world");
  await expect(area(page)).toHaveAttribute("data-status", "finished");

  // The run is remembered for auto-sync after sign-in.
  const pending = await page.evaluate(() => localStorage.getItem("termtype_pending_sync"));
  const runs = await page.evaluate(() => JSON.parse(localStorage.getItem("termtype_guest_runs") ?? "[]"));
  expect(pending).toBe(runs[0].id);

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("auth-modal")).toHaveCount(0);
  await expect(page.getByTestId("result")).toBeVisible();

  // Tab+Enter still restarts after the modal closes.
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(area(page)).toHaveAttribute("data-status", "idle");
  expect(hits).toEqual([]);
});

test("failed runs offer no sign-in to save", async ({ page, context, baseURL }) => {
  await setConfig(context, baseURL, { strictness: "master" });
  await openArena(page);
  const [first] = await targets(page);
  await page.keyboard.type(first[0] + (first[1] === "q" ? "z" : "q"));
  await expect(area(page)).toHaveAttribute("data-status", "finished");
  await expect(page.getByTestId("save-cta")).toHaveCount(0);
});
