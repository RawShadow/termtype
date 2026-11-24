"use client";

import type { GuestRun } from "@/lib/history/guestRuns";

function runLabel(run: GuestRun): string {
  const value = run.mode === "code" ? run.subMode.replace("code_", "") : run.subMode;
  const parts = [`${run.mode} ${value}`];
  if (run.modifiers.punct && (run.mode === "time" || run.mode === "words")) parts.push("punct");
  if (run.modifiers.nums && (run.mode === "time" || run.mode === "words")) parts.push("nums");
  if (run.modifiers.strictness !== "normal") parts.push(run.modifiers.strictness);
  return parts.join(" · ");
}

function timeOf(createdAt: number): string {
  const d = new Date(createdAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The guest's last runs (stored in localStorage), newest first, with the current one highlighted. */
export function RecentRuns({
  runs,
  currentId,
  currentIsPb,
}: {
  runs: readonly GuestRun[];
  currentId: string;
  currentIsPb: boolean;
}) {
  if (runs.length === 0) return null;
  return (
    <div data-testid="recent-runs" className="w-full text-sm">
      <div className="mb-2 text-xs text-text-muted">recent runs (saved in this browser)</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-left tabular-nums">
          <thead className="bg-bg-surface text-xs text-text-primary">
            <tr>
              <th className="px-3 py-1.5 font-normal">when</th>
              <th className="px-3 py-1.5 font-normal">test</th>
              <th className="px-3 py-1.5 text-right font-normal">wpm</th>
              <th className="px-3 py-1.5 text-right font-normal">acc</th>
              <th className="px-3 py-1.5 text-right font-normal">raw</th>
              <th className="px-3 py-1.5 font-normal">
                <span className="sr-only">notes</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => {
              const current = run.id === currentId;
              return (
                <tr
                  key={run.id}
                  data-testid="recent-run"
                  data-current={current || undefined}
                  className={`border-b border-bg-surface/60 ${current ? "text-text-primary" : "text-text-muted"}`}
                >
                  <td className="px-3 py-1.5">{timeOf(run.createdAt)}</td>
                  <td className="px-3 py-1.5">{runLabel(run)}</td>
                  <td className="px-3 py-1.5 text-right">{run.wpm}</td>
                  <td className="px-3 py-1.5 text-right">{run.accuracy}%</td>
                  <td className="px-3 py-1.5 text-right">{run.rawWpm}</td>
                  <td className="px-3 py-1.5 text-xs">
                    {run.failReason ? (
                      <span className="text-error">failed</span>
                    ) : current && currentIsPb ? (
                      <span className="text-accent">pb</span>
                    ) : current ? (
                      <span>&lt; now</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
