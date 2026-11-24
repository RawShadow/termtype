"use client";

import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Snapshot } from "@/lib/engine";
import { THEME } from "@/lib/theme";

interface Point {
  second: number;
  wpm: number;
  raw: number;
  errors: number;
  /** Net WPM at seconds with errors, so error dots sit on the WPM line (one y-axis). */
  errorDot: number | null;
}

function toPoints(snapshots: readonly Snapshot[]): Point[] {
  return snapshots.map((s) => ({
    second: s.second,
    wpm: s.netWpm,
    raw: s.rawWpm,
    errors: s.errors,
    errorDot: s.errors > 0 ? s.netWpm : null,
  }));
}

function ErrorDot(props: { cx?: number; cy?: number }) {
  if (props.cx === undefined || props.cy === undefined) return <g />;
  // 8px dot with a 2px surface ring so it stays legible on top of the lines.
  return <circle cx={props.cx} cy={props.cy} r={4} fill={THEME.error} stroke={THEME.bgPrimary} strokeWidth={2} />;
}

interface TooltipProps {
  active?: boolean;
  payload?: readonly { payload?: Point }[];
}

function ChartTooltip({ active, payload }: TooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded border border-bg-surface bg-bg-primary px-3 py-2 text-xs text-text-muted">
      <div className="mb-1 text-text-primary">{point.second}s</div>
      <LegendRow kind="wpm" label="wpm" value={point.wpm} />
      <LegendRow kind="raw" label="raw" value={point.raw} />
      <LegendRow kind="errors" label="errors" value={point.errors} />
    </div>
  );
}

/** Line-key / dot swatch + label in text colors (identity never relies on colored text). */
function Swatch({ kind }: { kind: "wpm" | "raw" | "errors" }) {
  if (kind === "errors") {
    return <span aria-hidden className="inline-block size-2 rounded-full bg-error" />;
  }
  return (
    <span
      aria-hidden
      className={`inline-block w-4 border-t-2 ${kind === "wpm" ? "border-accent" : "border-dashed border-text-muted"}`}
    />
  );
}

function LegendRow({ kind, label, value }: { kind: "wpm" | "raw" | "errors"; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <Swatch kind={kind} />
      <span className="w-12">{label}</span>
      <span className="text-text-primary tabular-nums">{value}</span>
    </div>
  );
}

/** WPM over time: net (solid accent), raw (dashed muted), and red dots at seconds with errors. */
export function WpmChart({ snapshots }: { snapshots: readonly Snapshot[] }) {
  const points = toPoints(snapshots);
  const errorPoints = points.filter((p) => p.errorDot !== null);

  if (points.length < 2) {
    return (
      <div data-testid="wpm-chart" className="flex h-44 items-center justify-center text-sm text-text-muted">
        not enough data to chart
      </div>
    );
  }

  return (
    <div data-testid="wpm-chart" className="w-full min-w-0">
      <div className="mb-2 flex gap-4 text-xs text-text-muted" aria-hidden>
        {(["wpm", "raw", "errors"] as const).map((kind) => (
          <span key={kind} className="flex items-center gap-1.5">
            <Swatch kind={kind} />
            {kind}
          </span>
        ))}
      </div>
      <div
        className="h-44 w-full"
        role="img"
        aria-label={`Words per minute over ${points[points.length - 1].second} seconds`}
      >
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 176 }}>
          <ComposedChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid stroke={THEME.bgSurface} strokeWidth={1} vertical={false} />
            <XAxis
              dataKey="second"
              type="number"
              domain={["dataMin", "dataMax"]}
              allowDecimals={false}
              tick={{ fill: THEME.textMuted, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: THEME.bgSurface }}
              tickFormatter={(s: number) => `${s}s`}
            />
            <YAxis
              domain={[0, "auto"]}
              allowDecimals={false}
              tick={{ fill: THEME.textMuted, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ stroke: THEME.textMuted, strokeWidth: 1 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="wpm"
              name="wpm"
              stroke={THEME.accent}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: THEME.accent, stroke: THEME.bgPrimary, strokeWidth: 2 }}
              isAnimationActive={false}
            />
            {/* Raw is drawn on top, dashed, so it stays visible where it overlaps net WPM. */}
            <Line
              type="monotone"
              dataKey="raw"
              name="raw"
              stroke={THEME.textMuted}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
            {/* Recharts falls back to the chart's data for an empty `data` array, so skip it entirely. */}
            {errorPoints.length > 0 && (
              <Scatter
                data={errorPoints}
                dataKey="errorDot"
                name="errors"
                shape={<ErrorDot />}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-2 text-xs text-text-muted">
        <summary className="cursor-pointer select-none hover:text-text-primary">[per-second data]</summary>
        <div className="mt-2 max-h-40 overflow-y-auto">
          <table className="w-full text-left tabular-nums">
            <thead className="sticky top-0 bg-bg-surface text-text-primary">
              <tr>
                <th className="px-2 py-1 font-normal">sec</th>
                <th className="px-2 py-1 font-normal">wpm</th>
                <th className="px-2 py-1 font-normal">raw</th>
                <th className="px-2 py-1 font-normal">errors</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.second}>
                  <td className="px-2">{p.second}</td>
                  <td className="px-2 text-text-primary">{p.wpm}</td>
                  <td className="px-2">{p.raw}</td>
                  <td className={`px-2 ${p.errors > 0 ? "text-error" : ""}`}>{p.errors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
