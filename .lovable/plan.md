# Badminton Doubles Tournament Manager — Build Plan

## Stack adaptation
The spec suggests Express + MongoDB/MySQL. This project runs on a fixed stack that does the same job:
- React + TypeScript + Tailwind + shadcn/ui + Lucide + Zod + Recharts (as requested)
- Lovable Cloud for the database (Postgres, normalized), organizer login and secure server logic
- Server functions instead of REST endpoints. Every point is checked on the server against the scoring engine, so the server never trusts the browser's score.

## Visual direction
Court-side sports look, not a generic admin panel: deep court-green and off-white, a bright shuttle-yellow accent, condensed bold numbers for scores, high contrast for use outdoors and under hall lights. The live scoring screen is full-screen with large tap zones and no navigation.

## Phase 1 — Rules engine (built and tested first)
A standalone module with no UI code: `applyAction(state, action) -> newState`.
- Rally-point scoring to 21, win by 2 from 20-20, 30 cap (30-29 ends the game; 31 is never allowed)
- Best of 1 / Best of 3; League Final is always Best of 1
- Doubles serving: server keeps serving and swaps court with partner after winning a rally; service passes to the other side after losing one; right court on even score, left on odd; receiver is diagonally opposite
- Full player positions (side, left/right court, server, receiver, partners) stored in state
- Game end, next game (sides and serve per rules), match end, winner
- Events: TOSS_COMPLETED, SERVER_SELECTED, RALLY_WON, GAME_COMPLETED, GAME_STARTED, MATCH_COMPLETED, PAUSED, RESUMED, UNDO
- Undo by replaying the stored event history, so it still works after a page refresh
- Unit tests for every case in section 65 of the spec, plus position and rotation checks

Also pure, tested helpers: Fisher-Yates team shuffle that avoids repeating the last arrangement, round-robin fixtures, knockout bracket with random byes, league ranking (points, point difference, points scored, head-to-head, then manual).

## Phase 2 — Data and login
Tables: players, tournaments, teams, team_players, matches (type, round, bracket links), match_schedule (play order, kept separate from the bracket), coin_tosses, match_events (rally log with snapshots), match_games, audit_log, user_roles (organizer/admin). Tournament and match states use explicit status values. Only organizers can make changes; read access is ready for a future spectator mode. Seed data: 12 players, 6 teams, one knockout and one league tournament, several finished matches and one live match.

## Phase 3 — Players and tournament creation
- Players list, add/edit, profile page with stats, partners and history
- Wizard: info (name, date, location, type, courts, match format) -> players (pick existing or type names; even-count check) -> teams (random with shuffle, rename, edit, lock; or manual with all validations) -> fixtures preview (reshuffle bracket or order) -> "Tournament Ready" confirmation -> LIVE

## Phase 4 — Schedule and progression
- Schedule timeline: Completed / Live / Up Next / Upcoming / Skipped
- Start, Skip (for now / to end / to a chosen position), Move up/down
- Knockout winners advance automatically; admin override with audit record
- League: live standings (MP, W, L, Pts, PD, cumulative); when all league matches finish, the League Final (1st vs 2nd, Best of 1) is added automatically. The final decides champion and runner-up and never changes the table.

## Phase 5 — Match flow and live scoring
- Preparation -> animated coin toss -> winner picks Court or Serve -> court side picker on a court diagram -> pick server and receiver (only valid choices)
- Live screen: big scores, one-tap "+1" per team, server/receiver, court diagram with SERVER / PARTNER / RECEIVER / RECEIVER PARTNER and left/right labels, game scores, undo, pause, end
- Info sidebar on desktop, below the court on mobile
- Game Won and Match Complete screens; the result is saved only after the organizer confirms
- State saved after every rally; "Resume Live Match" after refresh

## Phase 6 — Results, stats, dashboard
- Tournament details tabs: Overview, Teams, Schedule, Standings, Results, Statistics
- Results: champion, runner-up, standings, match history, match stats (points, longest game, biggest lead)
- Global player stats and leaderboards (wins, win %, point difference, tournament points; filter by all time, year, month, tournament)
- Dashboard with totals, active tournament with "Continue Tournament", live match, upcoming matches, top players, quick actions
- Settings, sidebar on desktop / bottom bar on mobile, empty states, loading skeletons, confirmation dialogs, toasts, friendly error messages

## Technical details
- Engine lives in `src/lib/engine/` (pure TypeScript) with Vitest tests; the same code runs in the browser for instant feedback and on the server for validation
- Server functions in `src/lib/*.functions.ts` with Zod input checks and organizer-role checks
- Each rally stores the event plus the resulting state snapshot; undo removes the last event and restores the previous snapshot
- Bracket is stored as match links (`feeds_into_match_id`, slot); play order is a separate position number
- Pages are separate routes; live scoring sits under the signed-in area

## Out of scope for v1 (architecture leaves room)
Multiple simultaneous courts, spectator links, TV scoreboard, Elo ratings, payments, notifications, PDF reports.
