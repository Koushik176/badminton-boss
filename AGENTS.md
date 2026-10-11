<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Database is TiDB Cloud (MySQL) via `@tidbcloud/serverless` using `DATABASE_URL`, always targeting the `badminton` database (`src/lib/server/db.ts`) — HTTP driver works on the Worker runtime where raw TCP MySQL does not.
- Backend is REST endpoints under `src/routes/api/`, no createServerFn — user requirement.
- Schema lives in `scripts/schema.sql`; `bun run ./scripts/seed.ts` applies it and seeds once — no migration tool on TiDB.
- Business logic (fixtures, progression, match actions, stats) lives in `src/lib/server/domain.ts`; API route files stay thin — keeps rules in one place.
- Match state is event-sourced: `initial_json` + `actions_json` replayed through the engine; `seq` column guards concurrent writes — undo and refresh-resume stay exact.
- Auth is custom JWT (HS256, `JWT_SECRET`) + PBKDF2 passwords via Web Crypto; first sign-in creates the organizer, later sign-ups are refused. Reads are public, writes require Bearer token.
