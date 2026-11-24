import { describe, expect, it } from "vitest";
import { parseOAuthProviders, safeNextPath } from "./config";

describe("parseOAuthProviders", () => {
  it("accepts only known providers, in a fixed order", () => {
    expect(parseOAuthProviders(undefined)).toEqual([]);
    expect(parseOAuthProviders("")).toEqual([]);
    expect(parseOAuthProviders("google, GitHub")).toEqual(["github", "google"]);
    expect(parseOAuthProviders("twitter,github")).toEqual(["github"]);
  });
});

describe("safeNextPath", () => {
  it("keeps same-origin paths", () => {
    expect(safeNextPath("/profile")).toBe("/profile");
    expect(safeNextPath("/login?next=/x")).toBe("/login?next=/x");
  });

  it("rejects anything that could leave the site", () => {
    for (const bad of [null, undefined, "", "https://evil.example", "//evil.example", "/\\evil.example", "profile"]) {
      expect(safeNextPath(bad), String(bad)).toBe("/");
    }
  });
});
