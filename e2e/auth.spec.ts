import { expect, test, type Page } from "@playwright/test";
import { area, failOnConsoleErrors, openArena, setConfig, targets } from "./helpers";

/**
 * Real sign-in against your Supabase project. Skipped unless you create a
 * test account and put its credentials in .env.test.local:
 *
 *   TEST_USER_EMAIL=...
 *   TEST_USER_PASSWORD=...
 *   TEST_USERNAME=e2e_typist   # used if the account has no username yet
 *
 * Runs here save real results to that account, through /api/results, so
 * SUPABASE_SERVICE_ROLE_KEY must be set in .env.local as well.
 */
const email = process.env.TEST_USER_EMAIL;
const password = process.env.TEST_USER_PASSWORD;
const username = process.env.TEST_USERNAME ?? "e2e_typist";

test.describe("signed-in flows", () => {
  test.skip(!email || !password, "set TEST_USER_EMAIL and TEST_USER_PASSWORD in .env.test.local");
  test.describe.configure({ mode: "serial" });
  failOnConsoleErrors();

  async function signIn(page: Page, from: "page" | "modal") {
    if (from === "page") await page.goto("/login");
    await page.getByTestId("auth-email").fill(email!);
    await page.getByTestId("auth-password").fill(password!);
    await page.getByTestId("auth-submit").click();
    // First sign-in: choose a username.
    const onboarding = page.getByTestId("username-modal");
    const header = page.getByTestId("header-profile");
    await expect(onboarding.or(header)).toBeVisible();
    if (await onboarding.isVisible()) {
      await page.screenshot({ path: "test-results/auth-username-modal.png" });
      await page.getByTestId("username-input").fill(username);
      await page.getByTestId("username-submit").click();
      await expect(onboarding).toHaveCount(0);
    }
    await expect(header).toHaveText(/^@/);
  }

  async function finishWords10(page: Page) {
    const words = await targets(page);
    for (let i = 0; i < words.length; i++) {
      await page.keyboard.type(i < words.length - 1 ? words[i] + " " : words[i]);
      await page.clock.runFor(500);
    }
    await expect(area(page)).toHaveAttribute("data-status", "finished");
  }

  test("sign in, save a run, see it on the profile, log out", async ({ page, context, baseURL }) => {
    await signIn(page, "page");
    await setConfig(context, baseURL, { mode: "words", words: 10 });
    await page.clock.install();
    await openArena(page);
    const saved = page.waitForResponse((r) => r.url().endsWith("/api/results") && r.request().method() === "POST");
    await finishWords10(page);
    expect((await saved).status()).toBe(201);
    await expect(page.getByTestId("save-status")).toHaveText(/saved to profile/);
    await expect(page.getByTestId("recent-runs")).toHaveAttribute("data-source", "profile");

    await page.goto("/profile");
    await expect(page.getByTestId("profile-username")).toHaveText(/^@/);
    await expect(page.getByTestId("pb-words-10")).not.toContainText("--");
    await page.screenshot({ path: "test-results/auth-profile.png", fullPage: true });

    await page.getByTestId("header-logout").click();
    await expect(page.getByTestId("header-login")).toBeVisible();
  });

  test("a ranked time 15 run appears on the leaderboard, highlighted", async ({ page, context, baseURL }) => {
    await signIn(page, "page");
    await setConfig(context, baseURL, { mode: "time", time: 15 });
    await page.clock.install();
    await openArena(page);
    const saved = page.waitForResponse((r) => r.url().endsWith("/api/results") && r.request().method() === "POST");
    // Type correctly for the whole 15 seconds (100% accuracy), then let the timer end it.
    for (let i = 0; i < 15; i++) {
      const word = (await targets(page))[i];
      await page.keyboard.type(word + " ");
      await page.clock.runFor(1000);
    }
    await page.clock.runFor(1000);
    await expect(area(page)).toHaveAttribute("data-status", "finished");
    expect((await saved).status()).toBe(201);

    await page.goto("/leaderboard?category=time-15&window=daily");
    const mine = page.locator('[data-testid="lb-row"][data-user]');
    await expect(mine).toBeVisible();
    await expect(mine).toContainText("< you");
    await page.screenshot({ path: "test-results/auth-leaderboard.png", fullPage: true });

    await page.getByTestId("header-logout").click();
    await expect(page.getByTestId("header-login")).toBeVisible();
  });

  test("a guest run is saved after logging in from the results screen", async ({ page, context, baseURL }) => {
    await setConfig(context, baseURL, { mode: "words", words: 10 });
    await page.clock.install();
    await openArena(page);
    await finishWords10(page);
    await page.getByTestId("save-cta").click();
    await signIn(page, "modal");

    await expect(page.getByTestId("toast")).toContainText("run saved to your profile");
    await page.screenshot({ path: "test-results/auth-sync-toast.png" });
    await expect(page.getByTestId("save-status")).toHaveText(/saved to profile/);
    const left = await page.evaluate(() => JSON.parse(localStorage.getItem("termtype_guest_runs") ?? "[]"));
    expect(left).toHaveLength(0);

    await page.getByTestId("header-logout").click();
    await expect(page.getByTestId("header-login")).toBeVisible();
  });
});
