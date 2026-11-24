export type AuthMode = "signin" | "signup";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD = 8;

/** Client-side checks before anything is sent to Supabase; returns a message or null. */
export function validateCredentials(mode: AuthMode, email: string, password: string): string | null {
  if (!EMAIL_PATTERN.test(email.trim())) return "enter a valid email address";
  if (mode === "signup" && password.length < MIN_PASSWORD) {
    return `password needs at least ${MIN_PASSWORD} characters`;
  }
  if (mode === "signin" && password.length === 0) return "enter your password";
  return null;
}

/** Maps `?error=` codes on /login to messages (never echoes arbitrary query text). */
export function loginErrorMessage(code: string | null | undefined): string | null {
  switch (code) {
    case "link":
      return "that sign-in link is invalid or has expired - try again";
    case "oauth":
      return "sign-in with that provider didn't complete - try again";
    default:
      return null;
  }
}
