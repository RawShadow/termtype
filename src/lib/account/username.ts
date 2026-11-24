/** Same rule as the `profiles_username_format` constraint in the database. */
export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;

/** A user-facing problem with the username, or null if it's valid. */
export function usernameError(value: string): string | null {
  if (value.length < 3) return "at least 3 characters";
  if (value.length > 20) return "at most 20 characters";
  if (!USERNAME_PATTERN.test(value)) return "letters, numbers and _ only";
  return null;
}

/** A valid starting suggestion derived from the email's local part. */
export function suggestUsername(email: string | null | undefined): string {
  const local = (email ?? "").split("@")[0] ?? "";
  let name = local.replace(/[^A-Za-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  if (name.length > 20) name = name.slice(0, 20);
  if (name.length < 3) name = `${name}${name ? "_" : ""}typist`.slice(0, 20);
  return name;
}
