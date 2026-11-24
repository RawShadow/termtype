import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/** Fails the test on any console error or uncaught page error. */
export function failOnConsoleErrors() {
  let errors: string[] = [];
  test.beforeEach(({ page }) => {
    errors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));
  });
  test.afterEach(() => {
    expect(errors, "console errors").toEqual([]);
  });
}

export const area = (page: Page) => page.getByTestId("typing-area");
export const word = (page: Page, i: number) => page.locator(`[data-word="${i}"]`);

/** Opens `/` and waits until the arena has hydrated and grabbed focus. */
export async function openArena(page: Page) {
  await page.goto("/");
  await expect(area(page)).toBeFocused();
}

/** Target words currently on screen (valid before any extra chars are typed). */
export async function targets(page: Page): Promise<string[]> {
  return page.locator("[data-word]").evaluateAll((els) => els.map((el) => el.textContent ?? ""));
}

/** Stores test settings the way the app does, so `/` renders with them. */
export async function setConfig(context: BrowserContext, baseURL: string | undefined, config: object) {
  const full = {
    mode: "time",
    time: 30,
    words: 25,
    quoteLength: "all",
    codeTime: 30,
    punct: false,
    nums: false,
    strictness: "normal",
    ...config,
  };
  await context.addCookies([
    { name: "termtype_config", value: encodeURIComponent(JSON.stringify(full)), url: baseURL! },
  ]);
}

/** A character that is not `c`. */
export function wrongFor(c: string): string {
  return c === "q" ? "z" : "q";
}
