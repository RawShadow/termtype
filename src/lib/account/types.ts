/** The signed-in user as the app sees it. `username` is null until onboarding is done. */
export interface Account {
  userId: string;
  email: string | null;
  username: string | null;
  /** ISO timestamp the profile was created. */
  joinedAt: string | null;
}
