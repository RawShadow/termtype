"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { validateCredentials, type AuthMode } from "@/lib/account/credentials";
import { createClient } from "@/lib/supabase/client";
import { enabledOAuthProviders, isSupabaseConfigured, type OAuthProvider } from "@/lib/supabase/config";

type Mode = AuthMode;
type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string }
  | { kind: "check-email"; email: string };

interface AuthFormProps {
  /** Where to go after auth completes via a redirect (email confirm, OAuth). */
  next: string;
  /** Called after an in-page sign-in. Defaults to navigating to `next`. */
  onSuccess?: () => void;
  initialError?: string | null;
}

/** Email/password sign-in and sign-up, plus any OAuth providers enabled in env. */
export function AuthForm({ next, onSuccess, initialError = null }: AuthFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>(
    initialError ? { kind: "error", message: initialError } : { kind: "idle" },
  );
  const providers = enabledOAuthProviders();

  if (!isSupabaseConfigured()) {
    return (
      <p data-testid="auth-unavailable" className="px-5 py-4 text-text-primary/70">
        accounts aren&apos;t configured on this server - you can keep typing as a guest.
      </p>
    );
  }

  const done = () => {
    if (onSuccess) onSuccess();
    else {
      router.replace(next);
      router.refresh();
    }
  };

  const redirectUrl = (path: string) => `${window.location.origin}${path}?next=${encodeURIComponent(next)}`;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = validateCredentials(mode, email, password);
    if (problem) {
      setStatus({ kind: "error", message: problem });
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    setStatus({ kind: "submitting" });
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) return setStatus({ kind: "error", message: error.message.toLowerCase() });
        done();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: redirectUrl("/auth/confirm") },
        });
        if (error) return setStatus({ kind: "error", message: error.message.toLowerCase() });
        if (data.session) done();
        else setStatus({ kind: "check-email", email: email.trim() });
      }
    } catch {
      setStatus({ kind: "error", message: "could not reach the auth server - try again" });
    }
  };

  const oauth = async (provider: OAuthProvider) => {
    const supabase = createClient();
    if (!supabase) return;
    setStatus({ kind: "submitting" });
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: redirectUrl("/auth/callback") },
    });
    if (error) setStatus({ kind: "error", message: error.message.toLowerCase() });
  };

  if (status.kind === "check-email") {
    return (
      <div data-testid="auth-check-email" className="space-y-2 px-5 py-5">
        <p className="text-text-primary">check your inbox</p>
        <p className="text-text-primary/70">
          we sent a confirmation link to <span className="text-accent">{status.email}</span>. open it to finish
          signing up - your guest runs will be waiting.
        </p>
      </div>
    );
  }

  const busy = status.kind === "submitting";
  const tab = (value: Mode, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === value}
      data-testid={`auth-tab-${value}`}
      onClick={() => {
        setMode(value);
        setStatus({ kind: "idle" });
      }}
      className={`rounded px-1 outline-none focus-visible:bg-bg-primary/60 ${
        mode === value ? "text-accent" : "text-text-primary/70 hover:text-text-primary"
      }`}
    >
      [{label}]
    </button>
  );

  return (
    <div data-testid="auth-form">
      <div role="tablist" className="flex gap-3 border-b border-bg-primary/60 px-5 py-3">
        {tab("signin", "sign in")}
        {tab("signup", "sign up")}
      </div>
      <form noValidate onSubmit={submit} className="space-y-3 px-5 py-4">
        <label className="block">
          <span className="text-text-primary/70">
            <span className="text-accent">~$</span> email
          </span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="auth-email"
            className="mt-1 w-full rounded border border-text-muted/40 bg-bg-primary px-3 py-2 text-text-primary caret-accent outline-none focus:border-accent"
          />
        </label>
        <label className="block">
          <span className="text-text-primary/70">
            <span className="text-accent">~$</span> password
          </span>
          <input
            type="password"
            name="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            data-testid="auth-password"
            className="mt-1 w-full rounded border border-text-muted/40 bg-bg-primary px-3 py-2 text-text-primary caret-accent outline-none focus:border-accent"
          />
        </label>
        {status.kind === "error" && (
          <p role="alert" data-testid="auth-error" className="text-error">
            {status.message}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          data-testid="auth-submit"
          className="w-full rounded bg-bg-primary px-3 py-2 text-accent outline-none hover:text-text-primary focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-50"
        >
          {busy ? "working..." : mode === "signin" ? "sign in" : "create account"}
        </button>
      </form>
      {providers.length > 0 && (
        <div className="flex flex-wrap gap-3 border-t border-bg-primary/60 px-5 py-3">
          <span className="text-text-primary/70">or</span>
          {providers.map((provider) => (
            <button
              key={provider}
              type="button"
              disabled={busy}
              data-testid={`auth-oauth-${provider}`}
              onClick={() => oauth(provider)}
              className="rounded px-1 text-text-primary outline-none hover:text-accent focus-visible:bg-bg-primary/60 disabled:opacity-50"
            >
              [continue with {provider}]
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
