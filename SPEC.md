# TermType — Full Architecture & Build Specification

## 1. Product Overview & User Flows
A Monkeytype-inspired typing speed web application with a minimalist developer terminal aesthetic.

### Pages & Navigation
- Minimal CLI-style top header:
  - Left: Brand prompt (`termtype:~$`) clicking returns to `/` and resets test.
  - Right: Minimal links — `[test]`, `[leaderboard]`, and `[login]` (or `@username` + logout when signed in).
- **`/` (Typing Arena)**:
  - Compact terminal command bar for selecting modes (e.g., `guest@termtype:~$ run --mode time --val 30`).
  - Centered 3-line word display with smooth blinking block/beam caret.
  - Live subtle counter above the words (seconds remaining in Time mode, `completed/total` in Words mode).
  - Keyboard shortcut hints in subtle footer: `tab + enter - restart` | `esc - command palette`.
  - When test finishes, smoothly swap the typing area for the **Results View** (do not force a page reload).
- **`/leaderboard`**:
  - Category tabs: `Time 15s`, `Time 30s`, `Time 60s`, `Code 30s`.
  - Timeframe toggle: `Daily` (last 24h) and `All-Time`.
  - Columns: Rank, Username, Net WPM, Raw WPM, Accuracy %, Date.
  - Highlight the logged-in user's personal best row if present.
- **Auth Modal / `/login`**:
  - Accessible from the header or via a "Sign in to save this run" CTA on the Results screen.
  - Supports Email/Password + GitHub or Google OAuth via Supabase.
  - Never blocks guest access to `/`.

---

## 2. Typing Modes & Modifiers
### Primary Modes
1. **Time**: `15s`, `30s`, `60s`, `120s` (default: `30s`).
2. **Words**: `10`, `25`, `50`, `100` words.
3. **Quotes**: Curated short/medium/long programming & tech quotes.
4. **Terminal / Code**: Real CLI commands (`git`, `docker`, `linux bash`, `npm`) and short JS/Python syntax snippets.

### Modifiers (Toggleable for Time & Words)
- `--punct`: Adds punctuation and capitalization.
- `--nums`: Mixes in realistic numbers.
- **Difficulty Strictness**:
  - `normal`: Standard typing; mistakes highlighted in `#E06C75`.
  - `expert`: Submitting a word with an error fails the test.
  - `master`: Any single incorrect keystroke fails the test immediately.

---

## 3. Typing Engine Mechanics & Scoring Math
### Display & Input Behavior
- Render words inside a fixed-height container showing **exactly 3 lines** (`overflow-hidden`).
- When the caret advances onto line 3, shift the viewport down by 1 line so active typing stays on line 2 (smooth CSS transform).
- **Character states**:
  - `untyped`: `#62848D`
  - `correct`: `#E7F6F2`
  - `incorrect`: `#E06C75`
  - `extra` (typed past word length): `#E06C75` with subtle underline, capped at max 10 extra chars per word so layout never breaks.
- **Spacebar**:
  - Advances to the next word (ignore if current word has 0 typed chars).
  - Unfinished characters in the skipped word count as `missed`.
- **Backspace**:
  - Deletes last char in current word.
  - If at index 0 of a word, allow backspacing into the previous word ONLY if the previous word contained an error.
  - Support `Ctrl+Backspace` / `Alt+Backspace` to clear current word.
- **Caret**: Smoothly interpolated position (`transition-transform duration-75`), blinks when idle, solid while typing.

### Exact Scoring Formulas
Record per-second snapshots during the test (`second`, `netWpm`, `rawWpm`, `errors`) for the results chart.
- `Net WPM = Math.max(0, Math.round((correctChars / 5) / (elapsedSeconds / 60)))`
  - Note: `correctChars` includes spaces after correctly typed words.
- `Raw WPM = Math.round((totalTypedChars / 5) / (elapsedSeconds / 60))`
- `Accuracy = totalKeystrokes > 0 ? Number(((correctKeystrokes / totalKeystrokes) * 100).toFixed(1)) : 0`
- `Consistency = Math.max(0, Math.round(100 - coefficientOfVariation(perSecondRawWpms)))`
  - Where `CV = (stdDev / mean) * 100`. Handle `mean === 0` safely as `0`.

### Post-Test Results View
- Large terminal readout: **WPM**, **ACC %**, **RAW**, **CONSISTENCY %**, **CHAR BREAKDOWN** (`correct/incorrect/extra/missed`).
- Recharts line graph: X-axis = seconds, Y-axis = WPM, with `#A5C9CA` line for Net WPM, `#62848D` dashed line for Raw WPM, and `#E06C75` dots where errors occurred.
- Action bar: `[Next Test (Tab+Enter)]`, `[Repeat Same Text]`, and (if guest) `[Log in to save score]`.

---

## 4. Data Schema & Security (Supabase — Phases 3 & 4)

### Tables
1. `profiles`
   - `id` (`uuid`, PK, references `auth.users.id`)
   - `username` (`text`, unique, 3–20 chars, alphanumeric + underscore)
   - `created_at` (`timestamptz`, default `now()`)
2. `test_results`
   - `id` (`uuid`, PK, default `gen_random_uuid()`)
   - `user_id` (`uuid`, FK -> `profiles.id`, not null)
   - `mode` (`text`, check in `('time', 'words', 'quote', 'code')`)
   - `sub_mode` (`text`, e.g. `'15'`, `'30'`, `'60'`, `'code_30'`)
   - `modifiers` (`jsonb`, e.g. `{"punct": false, "nums": false, "strictness": "normal"}`)
   - `wpm` (`integer`, not null)
   - `raw_wpm` (`integer`, not null)
   - `accuracy` (`numeric(5,2)`, not null)
   - `consistency` (`integer`, not null)
   - `duration_sec` (`integer`, not null)
   - `created_at` (`timestamptz`, default `now()`)

### Indexing & Leaderboard View
- Index on `test_results (mode, sub_mode, wpm DESC, created_at DESC)`.
- Leaderboard rules:
  - Ranked categories only (`time:15`, `time:30`, `time:60`, `code:30`).
  - Eligibility: `accuracy >= 90.0` and `strictness = 'normal'` (or higher).
  - Show only **one personal-best entry per user** per category (using `DISTINCT ON (user_id)` ordered by `wpm DESC, accuracy DESC, created_at ASC`).

### Anti-Cheat & Validation (Next.js API Route `/api/results`)
- Client sends test summary + lightweight keystroke timing summary (`startTime`, `endTime`, `totalKeystrokes`, `perSecondWpm[]`).
- Server verifies:
  1. Authenticated Supabase session.
  2. `wpm <= 260` and `raw_wpm <= 300` (hard sanity ceiling).
  3. `elapsedTime` matches `duration_sec` within ±1.5s tolerance.
  4. `Math.abs(computedWpmFromSnapshots - wpm)` is within reasonable variance.
- Row-Level Security (RLS):
  - `profiles`: public `SELECT`, user can only `INSERT/UPDATE` own row.
  - `test_results`: public `SELECT` (for leaderboards/profiles), `INSERT` only via authenticated server route or strict RLS (`auth.uid() = user_id`).

### Guest-to-Account Sync
- While logged out, store up to the last 10 completed runs in `localStorage` under `termtype_guest_runs`.
- Upon successful login/signup, check `termtype_guest_runs`: offer a subtle terminal toast (`Found X unsaved guest runs — [Sync to Profile] [Dismiss]`) or auto-sync the immediately preceding run if login was triggered from the Results screen, then clear synced items from `localStorage`.

---

## 5. Phased Build Plan
Build strictly one phase at a time. Do not scaffold later phases prematurely.

- **Phase 1 — Foundation & Core Typing Engine**:
  - Scaffold Next.js + Tailwind + JetBrains Mono + theme tokens.
  - Build pure TS typing engine + unit tests for WPM/Raw/Accuracy/Consistency math.
  - Build `/` typing arena: 3-line rolling viewport, smooth caret, focus dimming, live timer, `Tab + Enter` restart, and default `Time 30s` mode with a clean built-in 200-word list.
- **Phase 2 — All Modes, Modifiers & Results Dashboard**:
  - Add Time (15/30/60/120), Words (10/25/50/100), Quotes, and Terminal/Code modes.
  - Add `--punct`, `--nums`, and `normal/expert/master` strictness toggles.
  - Build the CLI-style command palette (`Esc`) and the full post-test Results screen with the Recharts WPM/error graph.
  - Add `localStorage` guest run history.
- **Phase 3 — Optional Auth, Profiles & Guest Sync**:
  - Connect Supabase Auth (Email + GitHub/Google), username onboarding modal on first login, `/profile` page showing user stats and recent runs, and guest-to-account sync.
- **Phase 4 — Categorized Leaderboards & Anti-Cheat**:
  - Build `/api/results` server validation endpoint, SQL migrations + RLS policies, and `/leaderboard` page with category tabs (`Time 15s`, `Time 30s`, `Time 60s`, `Code 30s`) and `Daily` / `All-Time` filters.