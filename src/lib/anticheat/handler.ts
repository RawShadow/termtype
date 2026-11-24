import type { RecordTestResultArgs } from "@/lib/supabase/database.types";
import { toRecordArgs } from "./submission";
import { validateSubmission } from "./validate";

export const MAX_BODY_BYTES = 16 * 1024;

/** The parts of a Request the handler needs (a real `Request` satisfies it). */
export interface SubmitRequest {
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

export type SaveOutcome = { id: string } | { error: { code?: string; message?: string } };

export interface SubmitDeps {
  /** The signed-in user's id from the session cookie, or null. */
  getUserId: () => Promise<string | null>;
  /** Writes the run with the server-only key; null when that key isn't configured. */
  save: ((args: RecordTestResultArgs) => Promise<SaveOutcome>) | null;
}

export interface SubmitResponse {
  status: number;
  body: { id?: string; error?: string; reasons?: string[] };
}

const fail = (status: number, error: string, reasons?: string[]): SubmitResponse => ({
  status,
  body: reasons ? { error, reasons } : { error },
});

/**
 * Blocks cross-site form/fetch posts: the Origin (when sent) must match the
 * host the request was made to, and the browser must not label it cross-site.
 */
function isSameOrigin(req: SubmitRequest): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return host !== null && new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Postgres error classes meaning "this run's data is invalid". */
const DATA_ERRORS = new Set(["22023", "23514", "22P02"]);

/**
 * `POST /api/results`: authenticate, validate, save. Pure apart from the
 * injected dependencies, so every branch is unit-testable.
 */
export async function handleSubmit(req: SubmitRequest, deps: SubmitDeps): Promise<SubmitResponse> {
  if (!isSameOrigin(req)) return fail(403, "cross-site requests are not allowed");
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return fail(415, "send JSON");
  }
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return fail(413, "body too large");

  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return fail(413, "body too large");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return fail(400, "invalid JSON");
  }

  const userId = await deps.getUserId();
  if (!userId) return fail(401, "sign in to save runs");

  const result = validateSubmission(body);
  if (!result.ok) return fail(422, "rejected", result.reasons);

  if (!deps.save) return fail(503, "saving is unavailable right now");
  const saved = await deps.save(toRecordArgs(userId, result.value));
  if ("id" in saved) return { status: 201, body: { id: saved.id } };

  const { code, message } = saved.error;
  if (code === "P0001") return fail(409, "choose a username first");
  if (code && DATA_ERRORS.has(code)) return fail(422, "rejected", [message ?? "invalid run"]);
  return fail(500, "could not save the run");
}
