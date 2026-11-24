import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import { AccountProvider } from "@/components/account/AccountProvider";
import { ArenaFrame } from "@/components/ArenaFrame";
import { TypingArena } from "@/components/TypingArena";
import { getAccount } from "@/lib/account/server";
import { randomSeed } from "@/lib/random";
import { CONFIG_COOKIE, parseConfigCookie } from "@/lib/settings";

/**
 * Reads the saved settings and the (optional) account, and picks the word
 * seed per request, so the server-rendered text matches the client exactly
 * (no hydration mismatch) and differs on every visit. Account lookup never
 * fails the page: any problem means "guest".
 */
async function SeededArena() {
  await connection();
  const store = await cookies();
  const config = parseConfigCookie(store.get(CONFIG_COOKIE)?.value);
  const account = await getAccount();
  return (
    <AccountProvider account={account}>
      <TypingArena initialSeed={randomSeed()} initialConfig={config} />
    </AccountProvider>
  );
}

function ArenaShell() {
  return (
    <ArenaFrame dimmed={false}>
      <div aria-hidden>
        <div className="h-8" />
        <div className="h-36" />
      </div>
    </ArenaFrame>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<ArenaShell />}>
      <SeededArena />
    </Suspense>
  );
}
