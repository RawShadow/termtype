import { expect, test } from "@playwright/test";
import { failOnConsoleErrors, openArena } from "./helpers";

failOnConsoleErrors();

const sample = {
  clientRunId: "e2e-run",
  mode: "time",
  subMode: "15",
  modifiers: { punct: false, nums: false, strictness: "normal" },
  wpm: 80,
  rawWpm: 82,
  accuracy: 98,
  consistency: 80,
  durationSec: 15,
  playedAt: new Date().toISOString(),
  timing: { startTime: 1000, endTime: 16000, totalKeystrokes: 102, perSecondWpm: Array(15).fill(80) },
};

test.describe("/leaderboard", () => {
  test("is linked from the header and defaults to time 30s, all-time", async ({ page }) => {
    await openArena(page);
    await page.getByTestId("header-leaderboard").click();
    await expect(page).toHaveURL(/\/leaderboard$/);
    await expect(page.getByTestId("lb-tab-time-30")).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("lb-window-all")).toHaveAttribute("aria-current", "page");
    // Either ranked rows or the empty state, depending on the data.
    await expect(page.getByTestId("lb-table").or(page.getByTestId("lb-empty"))).toBeVisible();
    await expect(page.getByText("personal best per user · accuracy ≥ 90%")).toBeVisible();
  });

  test("tabs and window toggle drive the URL", async ({ page }) => {
    await page.goto("/leaderboard");
    await page.getByTestId("lb-tab-time-15").click();
    await expect(page).toHaveURL(/category=time-15&window=all/);
    await expect(page.getByTestId("lb-tab-time-15")).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("lb-tab-time-30")).not.toHaveAttribute("aria-current", "page");

    await page.getByTestId("lb-window-daily").click();
    await expect(page).toHaveURL(/category=time-15&window=daily/);
    await expect(page.getByTestId("lb-window-daily")).toHaveAttribute("aria-current", "page");
    await expect(page.getByText(/last 24 hours/)).toBeVisible();

    await page.getByTestId("lb-tab-code-30").click();
    await expect(page).toHaveURL(/category=code-30&window=daily/);

    await page.goBack();
    await expect(page.getByTestId("lb-tab-time-15")).toHaveAttribute("aria-current", "page");
  });

  test("unknown params fall back to the defaults", async ({ page }) => {
    await page.goto("/leaderboard?category=words-25&window=weekly");
    await expect(page.getByTestId("lb-tab-time-30")).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("lb-window-all")).toHaveAttribute("aria-current", "page");
  });

  test.describe("phone width", () => {
    test.use({ viewport: { width: 375, height: 812 } });
    test("never scrolls sideways", async ({ page }) => {
      await page.goto("/leaderboard");
      await expect(page.getByTestId("leaderboard")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBe(0);
    });
  });
});

test.describe("POST /api/results (no session)", () => {
  test("requires a session", async ({ request }) => {
    const res = await request.post("/api/results", { data: sample });
    expect(res.status()).toBe(401);
    expect(await res.json()).toEqual({ error: "sign in to save runs" });
  });

  test("blocks cross-site requests", async ({ request }) => {
    const res = await request.post("/api/results", {
      data: sample,
      headers: { Origin: "https://evil.example" },
    });
    expect(res.status()).toBe(403);
  });

  test("rejects malformed bodies", async ({ request }) => {
    // A Buffer is sent as-is (a string would be JSON-encoded into valid JSON).
    const bad = await request.post("/api/results", {
      data: Buffer.from("{not json"),
      headers: { "Content-Type": "application/json" },
    });
    expect(bad.status()).toBe(400);
    const text = await request.post("/api/results", {
      data: "hello",
      headers: { "Content-Type": "text/plain" },
    });
    expect(text.status()).toBe(415);
  });

  test("only accepts POST", async ({ request }) => {
    expect((await request.get("/api/results")).status()).toBe(405);
  });
});
