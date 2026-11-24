import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { AccountProvider } from "@/components/account/AccountProvider";
import { AuthForm } from "@/components/account/AuthForm";
import { SiteFrame } from "@/components/SiteFrame";
import { loginErrorMessage } from "@/lib/account/credentials";
import { getAccount } from "@/lib/account/server";
import { safeNextPath } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "login · termtype" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function LoginPanel({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="mb-4 text-sm text-text-muted">
        <span className="text-accent">~$</span> termtype login
      </h1>
      <div className="rounded-md border border-text-muted/30 bg-bg-surface text-sm">{children}</div>
      <p className="mt-4 text-xs text-text-muted">
        accounts are optional - guests can use every mode. signing in saves runs to your profile.
      </p>
    </div>
  );
}

/** Request-time part: reads the session (which checks the clock), so it renders inside <Suspense>. */
async function LoginContent({ searchParams }: { searchParams: SearchParams }) {
  // Stop prerendering here: everything below depends on the incoming request.
  await connection();
  const params = await searchParams;
  const next = safeNextPath(first(params.next));
  const account = await getAccount();
  if (account) redirect(next);

  return (
    <AccountProvider account={null}>
      <SiteFrame>
        <LoginPanel>
          <AuthForm next={next} initialError={loginErrorMessage(first(params.error))} />
        </LoginPanel>
      </SiteFrame>
    </AccountProvider>
  );
}

export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense
      fallback={
        <SiteFrame>
          <LoginPanel>
            <div className="h-64" />
          </LoginPanel>
        </SiteFrame>
      }
    >
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}
