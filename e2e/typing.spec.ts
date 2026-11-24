import { expect, test, type Page } from "@playwright/test";
import { area, failOnConsoleErrors, openArena, targets, word } from "./helpers";

failOnConsoleErrors();

async function caretBox(page: Page) {
  const box = await page.getByTestId("caret").boundingBox();
  if (!box) throw new Error("caret not visible");
  return box;
}

async function opacity(page: Page, testId: string): Promise<number> {
  return page.getByTestId(testId).evaluate((el) => Number(getComputedStyle(el).opacity));
}

test("drops straight into a focused 3-line typing test", async ({ page }) => {
  await openArena(page);
  await expect(area(page)).toBeFocused();
  await expect(area(page)).toHaveAttribute("data-status", "idle");
  await expect(page.locator("input:visible, textarea:visible")).toHaveCount(0);

  const viewport = await page.getByTestId("words-viewport").boundingBox();
  const line = await word(page, 0).boundingBox();
  expect(viewport && line).toBeTruthy();
  expect(Math.abs(viewport!.height - 3 * line!.height)).toBeLessThan(1);

  // Only three lines of words are visible.
  const visibleLines = await page.locator("[data-word]").evaluateAll((els) => {
    const vp = document.querySelector('[data-testid="words-viewport"]')!.getBoundingClientRect();
    const tops = new Set(
      els
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.top >= vp.top - 1 && r.bottom <= vp.bottom + 1)
        .map((r) => Math.round(r.top)),
    );
    return tops.size;
  });
  expect(visibleLines).toBe(3);
});

test("colors characters and moves the caret", async ({ page }) => {
  await openArena(page);
  const [first, second] = await targets(page);
  const startX = (await caretBox(page)).x;

  await page.keyboard.type(first);
  await expect(area(page)).toHaveAttribute("data-status", "running");
  await expect(word(page, 0).locator('[data-state="correct"]')).toHaveCount(first.length);
  await expect.poll(async () => (await caretBox(page)).x).toBeGreaterThan(startX);

  await page.keyboard.press("Space");
  const wrong = second[0] === "q" ? "z" : "q";
  await page.keyboard.type(wrong);
  await expect(word(page, 1).locator("[data-char]").first()).toHaveAttribute("data-state", "incorrect");

  await page.keyboard.press("Backspace");
  await page.keyboard.type(second + "xx");
  const states = await word(page, 1)
    .locator("[data-char]")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-state")));
  expect(states).toEqual([...Array(second.length).fill("correct"), "extra", "extra"]);
});

test("rolls the viewport so the caret stays on line 2", async ({ page }) => {
  await openArena(page);
  const inner = page.getByTestId("words-inner");

  for (let i = 0; i < 60; i++) {
    const shift = Number((await inner.getAttribute("data-shift")) ?? 0);
    if (shift >= 1) break;
    const [target] = await word(page, i).evaluateAll((els) => els.map((el) => el.textContent ?? ""));
    await page.keyboard.type(target + " ");
  }
  await expect(inner).not.toHaveAttribute("data-shift", "0");

  const viewport = (await page.getByTestId("words-viewport").boundingBox())!;
  const lineHeight = viewport.height / 3;
  await expect
    .poll(async () => {
      const caret = await caretBox(page);
      return Math.floor((caret.y + caret.height / 2 - viewport.y) / lineHeight);
    })
    .toBe(1);
});

test("dims the chrome while typing and restores it on mouse move", async ({ page }) => {
  await openArena(page);
  await page.mouse.move(5, 5);
  const [first] = await targets(page);
  expect(await opacity(page, "header")).toBe(1);

  await page.keyboard.type(first.slice(0, 2));
  for (const id of ["header", "footer", "command-bar"]) {
    await expect.poll(() => opacity(page, id)).toBeCloseTo(0.25, 2);
  }

  await page.mouse.move(200, 200);
  await expect.poll(() => opacity(page, "header")).toBe(1);
});

test("tab + enter restarts with fresh words", async ({ page }) => {
  await openArena(page);
  const before = await targets(page);
  await page.keyboard.type(before[0] + " " + before[1].slice(0, 1));
  await expect(area(page)).toHaveAttribute("data-status", "running");

  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");

  await expect(area(page)).toHaveAttribute("data-status", "idle");
  await expect(area(page)).toBeFocused();
  await expect(page.locator('[data-state]:not([data-state="untyped"])')).toHaveCount(0);
  expect(await targets(page)).not.toEqual(before);
});

test("enter without tab does not restart", async ({ page }) => {
  await openArena(page);
  const [first] = await targets(page);
  await page.keyboard.type(first.slice(0, 1));
  await page.keyboard.press("Enter");
  await expect(area(page)).toHaveAttribute("data-status", "running");
});

test("refocuses the typing area after it loses focus", async ({ page }) => {
  await openArena(page);
  await page.getByTestId("footer").click();
  await expect(page.getByTestId("focus-hint")).toBeVisible();

  const [first] = await targets(page);
  await page.keyboard.type(first[0]);
  await expect(area(page)).toBeFocused();
  await expect(page.getByTestId("focus-hint")).toHaveCount(0);
  await expect(word(page, 0).locator("[data-char]").first()).toHaveAttribute("data-state", "correct");
});

test("ends after 30 seconds with WPM and accuracy, then locks input", async ({ page }) => {
  await page.clock.install();
  await openArena(page);
  const [first] = await targets(page);

  await page.keyboard.type(first + " ");
  await expect(page.getByTestId("live-counter")).toHaveText("30");
  await page.clock.runFor(10_000);
  await expect(page.getByTestId("live-counter")).toHaveText("20");

  await page.clock.runFor(21_000);
  await expect(area(page)).toHaveAttribute("data-status", "finished");
  const expectedWpm = Math.round((first.length + 1) / 5 / 0.5);
  await expect(page.getByTestId("result-wpm")).toHaveText(String(expectedWpm));
  await expect(page.getByTestId("result-acc")).toHaveText("100%");

  await page.keyboard.type("abc ");
  await expect(area(page)).toHaveAttribute("data-status", "finished");
  await expect(page.getByTestId("result-wpm")).toHaveText(String(expectedWpm));

  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(area(page)).toHaveAttribute("data-status", "idle");
  await expect(page.getByTestId("words-viewport")).toBeVisible();
});
