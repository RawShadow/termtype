import { DEFAULT_CONFIG, sanitizeConfig, type TestConfig } from "@/lib/engine/config";

/** Cookie holding the guest's test settings, read on the server so `/` renders the right mode. */
export const CONFIG_COOKIE = "termtype_config";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function parseConfigCookie(value: string | undefined): TestConfig {
  if (!value) return DEFAULT_CONFIG;
  try {
    return sanitizeConfig(JSON.parse(decodeURIComponent(value)));
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function serializeConfigCookie(config: TestConfig): string {
  const value = encodeURIComponent(JSON.stringify(config));
  return `${CONFIG_COOKIE}=${value}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}

/** Browser only. */
export function saveConfig(config: TestConfig): void {
  document.cookie = serializeConfigCookie(config);
}
