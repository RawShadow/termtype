# Project: TermType (Terminal Typing Speed App)

## Tech Stack
- Framework: Next.js (App Router) + TypeScript (strict mode)
- Styling: Tailwind CSS + JetBrains Mono (`next/font/google`)
- Charts: Recharts
- Backend/Auth: Supabase (Auth + Postgres + RLS) — introduced in Phase 3

## Design System (Terminal Theme)
Never invent random colors or default browser UI chrome. Use these exact CSS variables / Tailwind tokens:
- `--bg-primary`: `#2C3333` (terminal canvas background)
- `--bg-surface`: `#395B64` (panels, config bar, modals, table headers, subtle borders)
- `--text-muted`: `#62848D` (untyped characters, inactive controls, secondary labels)
- `--accent`: `#A5C9CA` (caret, active mode pills, CLI prompt `~$`, highlights, chart line)
- `--text-primary`: `#E7F6F2` (correctly typed characters, primary WPM metrics, active text)
- `--error`: `#E06C75` (mistyped characters, extra character underlines, failed-run indicators)

## Core Product Rules
1. **Zero-friction start**: Opening `/` drops the user directly into an active typing test. No landing page, no login wall, no "Start" button. First keystroke starts the timer.
2. **Keyboard-first**: No visible `<input>` or `<textarea>` box for typing. Capture keystrokes on a focusable typing container. `Tab` + `Enter` restarts instantly.
3. **Focus mode**: Once typing starts, dim header/footer/config bar (`opacity-25` or hidden) until the test ends or the mouse moves.
4. **Guest-first persistence**: Guests can use all typing modes freely. Store recent guest runs in `localStorage` and sync pending scores automatically after login.
5. **No client-trusted leaderboard writes**: Never insert directly into a public leaderboard without server-side validation of WPM, duration, and accuracy.

## Code Conventions
- Keep typing engine state and WPM/accuracy/consistency math in pure TypeScript modules (`src/lib/engine/`) so they are unit-testable and decoupled from React UI.
- Avoid `useEffect` chains for keystroke handling; process keystrokes deterministically via a reducer or single state handler to prevent input lag.
- Never commit `.env.local` or Supabase service role keys.

## Verification Checklist (Required Before Marking Any Task Done)
1. Run `npm run typecheck` (or `npx tsc --noEmit`) — must pass with 0 errors.
2. Run `npm run build` — must succeed cleanly.
3. Run unit tests (`npm test`) for engine/math changes.
4. If UI or keystroke behavior changed, verify in Playwright (check 3-line viewport, caret movement, error highlighting, `Tab + Enter` restart, and zero console errors).