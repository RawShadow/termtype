import { useSyncExternalStore } from "react";
import {
  addGuestRun,
  GUEST_RUNS_KEY,
  loadGuestRuns,
  MAX_GUEST_RUNS,
  type GuestRun,
  type StorageLike,
} from "./guestRuns";

const EMPTY: GuestRun[] = [];
const listeners = new Set<() => void>();
let cache: GuestRun[] | null = null;

function storage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keep tabs in sync.
  const onStorage = (e: StorageEvent) => {
    if (e.key === GUEST_RUNS_KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): GuestRun[] {
  if (cache === null) {
    const s = storage();
    cache = s ? loadGuestRuns(s) : EMPTY;
  }
  return cache;
}

function getServerSnapshot(): GuestRun[] {
  return EMPTY;
}

/** Saves a finished run to localStorage and notifies subscribers. */
export function recordGuestRun(run: GuestRun): void {
  const s = storage();
  cache = s
    ? addGuestRun(s, run)
    : [run, ...getSnapshot().filter((r) => r.id !== run.id)].slice(0, MAX_GUEST_RUNS);
  emit();
}

/** Recent guest runs, newest first. Empty during server render and hydration. */
export function useGuestRuns(): GuestRun[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
