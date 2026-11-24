import { expect, test, type Page } from "@playwright/test";
import { area, failOnConsoleErrors, openArena, setConfig, targets, word, wrongFor } from "./helpers";

failOnConsoleErrors();

const palette = (page: Page) => page.getByTestId("command-palette");
const opt = (page: Page, id: string) => page.getByTestId(`opt-${id}`);

/** Types every target word, advancing the fake clock between words so the chart has data. */
async function typeAll(page: Page, words: string[], msPerWord = 600) {
  for (let i = 0; i < words.length; i++) {
    await page.keyboard.type(i < words.length - 1 ? words[i] + " " : words[i]);
    await page.clock.runFor(msPerWord);
  }
}

test.describe("command palette", () => {
  test("esc opens it, a command switches mode, focus returns to typing", async ({ page }) => {
    await openArena(page);
    await page.keyboard.press("Escape");
    await expect(palette(page)).toBeVisible();
    await expect(palette(page).getByRole("textbox")).toBeFocused();

    await page.keyboard.type("words 10");
    // "words 100" also matches; the exact prefix match is selected first.
    await expect(page.getByRole("option", { selected: true })).toContainText("words 10");
    await page.keyboard.press("Enter");

    await expect(palette(page)).toHaveCount(0);
    await expect(area(page)).toBeFocused();
    await expect(area(page)).toHaveAttribute("data-mode", "words");
    await expect(opt(page, "val-10")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("[data-word]")).toHaveCount(10);

    const [first] = await targets(page);
    await page.keyboard.type(first[0]);
    await expect(page.getByTestId("live-counter")).toHaveText("0/10");
  });

  test("arrow keys pick a command and esc closes without changes", async ({ page }) => {
    await openArena(page);
    await page.keyboard.press("Escape");
    await page.keyboard.type("strict");
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("option", { selected: true })).toContainText("strict expert");
    await page.keyboard.press("Escape");
    await expect(palette(page)).toHaveCount(0);
    await expect(area(page)).toBeFocused();
    await expect(opt(page, "strict-normal")).toHaveAttribute("aria-pressed", "true");
  });

  test("accepts the run --mode CLI syntax and reports errors", async ({ page }) => {
    await openArena(page);
    await page.keyboard.press("Escape");
    await page.keyboard.type("run --mode time --val 45");
    await expect(page.getByTestId("palette-run-preview")).toHaveText("invalid --val for time: 45");
    await page.keyboard.press("Enter");
    await expect(palette(page)).toBeVisible();

    await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");
    await page.keyboard.type("60 --nums");
    await expect(page.getByTestId("palette-run-preview")).toContainText("time 60 · nums");
    await page.keyboard.press("Enter");
    await expect(palette(page)).toHaveCount(0);
    await expect(opt(page, "val-60")).toHaveAttribute("aria-pressed", "true");
    await expect(opt(page, "nums")).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("command bar", () => {
  test("mouse clicks switch modes and toggle modifiers", async ({ page }) => {
    await openArena(page);
    await opt(page, "mode-words").click();
    await expect(area(page)).toBeFocused();
    await opt(page, "val-50").click();
    await expect(page.locator("[data-word]")).toHaveCount(50);

    await opt(page, "punct").click();
    await opt(page, "nums").click();
    const words = await targets(page);
    expect(words.some((w) => /^[A-Z"(]/.test(w))).toBe(true);
    expect(words.some((w) => /[.,?!;:]$/.test(w))).toBe(true);
    expect(words.some((w) => /\d/.test(w))).toBe(true);
    expect(words[words.length - 1]).toMatch(/[.?!]$/);

    // Modifiers are only offered where they apply.
    await opt(page, "mode-quote").click();
    await expect(opt(page, "punct")).toHaveCount(0);
    await expect(opt(page, "val-short")).toBeVisible();
  });

  test("settings survive a reload", async ({ page }) => {
    await openArena(page);
    await opt(page, "mode-code").click();
    await opt(page, "val-15").click();
    await opt(page, "strict-expert").click();
    await page.reload();
    await expect(area(page)).toBeFocused();
    await expect(area(page)).toHaveAttribute("data-mode", "code");
    await expect(opt(page, "val-15")).toHaveAttribute("aria-pressed", "true");
    await expect(opt(page, "strict-expert")).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("results screen", () => {
  test("words 10: full readout, chart, history, repeat and next", async ({ page, context, baseURL }) => {
    await setConfig(context, baseURL, { mode: "words", words: 10 });
    await page.clock.install();
    await openArena(page);
    const words = await targets(page);
    expect(words).toHaveLength(10);

    await typeAll(page, words);
    await expect(area(page)).toHaveAttribute("data-status", "finished");
    await expect(page.getByTestId("result-status")).toHaveText("test complete");
    await expect(page.getByTestId("result-acc")).toHaveText("100%");
    for (const id of ["result-wpm", "result-raw", "result-consistency", "result-time"]) {
      await expect(page.getByTestId(id)).toHaveText(/\d/);
    }
    const chars = words.join("").length;
    await expect(page.getByTestId("result-chars")).toHaveText(`${chars}/0/0/0`);
    await expect(page.getByTestId("wpm-chart").locator("svg.recharts-surface")).toBeVisible();
    await expect(page.getByTestId("wpm-chart").locator(".recharts-line")).toHaveCount(2);
    // A clean run has no error dots.
    await expect(page.getByTestId("wpm-chart").locator(".recharts-scatter-symbol")).toHaveCount(0);

    await expect(page.getByTestId("recent-run")).toHaveCount(1);
    await expect(page.locator('[data-testid="recent-run"][data-current]')).toHaveCount(1);
    await expect(page.getByTestId("pb-badge")).toBeVisible();

    await page.getByTestId("repeat-test").click();
    await expect(area(page)).toHaveAttribute("data-status", "idle");
    await expect(area(page)).toBeFocused();
    expect(await targets(page)).toEqual(words);

    // Repeat it slower: still saved, but not a new personal best.
    await typeAll(page, words, 1200);
    await expect(page.getByTestId("recent-run")).toHaveCount(2);
    await expect(page.getByTestId("pb-badge")).toHaveCount(0);

    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(area(page)).toHaveAttribute("data-status", "idle");
    expect(await targets(page)).not.toEqual(words);

    // History lives in localStorage and survives a reload.
    await page.reload();
    await expect(area(page)).toBeFocused();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("termtype_guest_runs") ?? "[]"));
    expect(stored).toHaveLength(2);
    expect(stored[0]).toMatchObject({ mode: "words", subMode: "10", accuracy: 100, failReason: null });
  });

  test("errors show as dots on the chart", async ({ page, context, baseURL }) => {
    await setConfig(context, baseURL, { mode: "words", words: 10 });
    await page.clock.install();
    await openArena(page);
    const words = await targets(page);
    await page.keyboard.type(wrongFor(words[0][0]));
    await page.keyboard.press("Backspace");
    await typeAll(page, words);
    await expect(area(page)).toHaveAttribute("data-status", "finished");
    await expect(page.getByTestId("result-acc")).not.toHaveText("100%");
    await expect(page.getByTestId("wpm-chart").locator(".recharts-scatter-symbol")).toHaveCount(1);
  });
});

test.describe("strictness", () => {
  test("master fails on the first wrong key", async ({ page, context, baseURL }) => {
    await setConfig(context, baseURL, { strictness: "master" });
    await openArena(page);
    const [first] = await targets(page);
    await page.keyboard.type(first[0] + wrongFor(first[1] ?? "a"));
    await expect(area(page)).toHaveAttribute("data-status", "finished");
    await expect(page.getByTestId("result-status")).toContainText("test failed - master");
    await expect(page.locator('[data-testid="recent-run"][data-current]')).toContainText("failed");
  });

  test("expert fails when a wrong word is submitted, not before", async ({ page, context, baseURL }) => {
    await setConfig(context, baseURL, { mode: "words", words: 10, strictness: "expert" });
    await openArena(page);
    const [first] = await targets(page);
    await page.keyboard.type(first.slice(0, -1) + wrongFor(first[first.length - 1]));
    await expect(area(page)).toHaveAttribute("data-status", "running");
    await page.keyboard.press("Space");
    await expect(area(page)).toHaveAttribute("data-status", "finished");
    await expect(page.getByTestId("result-status")).toContainText("test failed - expert");
  });
});

test.describe("modes", () => {
  test("quote mode ends at the last word and credits the author", async ({ page, context, baseURL }) => {
    await setConfig(context, baseURL, { mode: "quote", quoteLength: "short" });
    await page.clock.install();
    await openArena(page);
    const words = await targets(page);
    expect(words.length).toBeLessThanOrEqual(15);
    await page.keyboard.type(words[0][0]);
    await expect(page.getByTestId("live-counter")).toHaveText(`0/${words.length}`);
    await page.keyboard.type(words[0].slice(1) + " ");
    await typeAll(page, words.slice(1));
    await expect(area(page)).toHaveAttribute("data-status", "finished");
    await expect(page.getByTestId("result-quote-author")).not.toBeEmpty();
  });

  test("code mode streams commands and snippets and is timed", async ({ page, context, baseURL }) => {
    await setConfig(context, baseURL, { mode: "code", codeTime: 15 });
    await page.clock.install();
    await openArena(page);
    const tokens = await targets(page);
    const text = tokens.join(" ");
    expect(text).toMatch(/[-./"=(){}:$@|]/);
    expect(text).toMatch(/\b(git|docker|npm|npx|const|import|def|return|grep|curl)\b/);

    await page.keyboard.type(tokens[0] + " ");
    await expect(page.getByTestId("live-counter")).toHaveText("15");
    await page.clock.runFor(16_000);
    await expect(area(page)).toHaveAttribute("data-status", "finished");
    await expect(page.getByTestId("result-time")).toHaveText("15s");
  });

  test("time 15 ends after 15 seconds", async ({ page, context, baseURL }) => {
    await setConfig(context, baseURL, { mode: "time", time: 15 });
    await page.clock.install();
    await openArena(page);
    const [first] = await targets(page);
    await page.keyboard.type(first + " ");
    await page.clock.runFor(14_000);
    await expect(area(page)).toHaveAttribute("data-status", "running");
    await page.clock.runFor(2_000);
    await expect(area(page)).toHaveAttribute("data-status", "finished");
  });
});

test.describe("phone width", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("code mode keeps 3 lines and never scrolls sideways", async ({ page, context, baseURL }) => {
    await setConfig(context, baseURL, { mode: "code" });
    await openArena(page);
    const viewport = (await page.getByTestId("words-viewport").boundingBox())!;
    const line = (await word(page, 0).boundingBox())!;
    expect(Math.abs(viewport.height - 3 * line.height)).toBeLessThan(1);
    const overflow = await page.evaluate(() => {
      const vp = document.querySelector('[data-testid="words-viewport"]')!.getBoundingClientRect();
      const tooWide = [...document.querySelectorAll("[data-word]")].filter(
        (el) => el.getBoundingClientRect().right > vp.right + 1,
      ).length;
      return { tooWide, scroll: document.documentElement.scrollWidth - window.innerWidth };
    });
    expect(overflow).toEqual({ tooWide: 0, scroll: 0 });
  });
});
