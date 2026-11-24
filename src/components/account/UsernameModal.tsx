"use client";

import { useState, type FormEvent } from "react";
import { Dialog } from "@/components/Dialog";
import { suggestUsername, usernameError } from "@/lib/account/username";
import { createClient } from "@/lib/supabase/client";

interface UsernameModalProps {
  userId: string;
  email: string | null;
  onCreated: () => void;
  onSignOut: () => void;
}

/** First-login onboarding: a username is required before runs can be saved. */
export function UsernameModal({ userId, email, onCreated, onSignOut }: UsernameModalProps) {
  const [value, setValue] = useState(() => suggestUsername(email));
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const problem = usernameError(value);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (problem) return;
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true);
    setServerError(null);
    const { error } = await supabase.from("profiles").insert({ id: userId, username: value });
    setBusy(false);
    if (!error) return onCreated();
    if (error.code === "23505") setServerError(`@${value} is taken - try another`);
    else if (error.code === "23514") setServerError("letters, numbers and _ only (3-20)");
    else setServerError("could not save - try again");
  };

  return (
    <Dialog label="Choose a username" testId="username-modal">
      <form noValidate onSubmit={submit} className="space-y-3 px-5 py-5">
        <p className="text-text-primary">pick a username</p>
        <p className="text-text-primary/70">it shows on your profile and, later, on leaderboards.</p>
        <label className="block">
          <span className="text-text-primary/70">
            <span className="text-accent">~$</span> username
          </span>
          <div className="mt-1 flex items-center rounded border border-text-muted/40 bg-bg-primary px-3 focus-within:border-accent">
            <span className="text-text-primary/70">@</span>
            <input
              autoFocus
              value={value}
              maxLength={20}
              onChange={(e) => {
                setValue(e.target.value);
                setServerError(null);
              }}
              spellCheck={false}
              autoComplete="username"
              data-testid="username-input"
              aria-invalid={problem !== null}
              className="w-full bg-transparent py-2 text-text-primary caret-accent outline-none"
            />
          </div>
        </label>
        <p data-testid="username-error" className={problem || serverError ? "text-error" : "text-text-primary/70"}>
          {serverError ?? problem ?? "looks good"}
        </p>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onSignOut}
            className="rounded px-1 text-text-primary/70 outline-none hover:text-text-primary focus-visible:bg-bg-primary/60"
          >
            [logout]
          </button>
          <button
            type="submit"
            disabled={busy || problem !== null}
            data-testid="username-submit"
            className="rounded bg-bg-primary px-3 py-2 text-accent outline-none hover:text-text-primary focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-50"
          >
            {busy ? "saving..." : "save username"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
