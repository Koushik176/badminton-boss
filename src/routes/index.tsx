import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Play, UserPlus } from "lucide-react";
import { api, useAuth } from "@/lib/api";
import { AppShell, Empty } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type LiveMatch = {
  id: string;
  tname: string;
  round_name: string;
  aname: string;
  bname: string;
  state?: { score?: { A?: number; B?: number } } | null;
};

type Tournament = {
  id: string;
  name: string;
  date: string;
  type: string;
  location?: string | null;
};

type UpcomingMatch = {
  id: string;
  aname?: string | null;
  bname?: string | null;
  round_name: string;
};

type TopPlayer = {
  id: string;
  name: string;
  wins: number;
  winPct: number;
  pd: number;
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Smash Court" },
      {
        name: "description",
        content: "Live matches, active tournaments and top badminton players at a glance.",
      },
      { property: "og:title", content: "Dashboard — Smash Court" },
      {
        property: "og:description",
        content: "Live matches, active tournaments and top badminton players at a glance.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { isOrganizer } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api("/dashboard"),
  });
  return (
    <AppShell
      title="Dashboard"
      actions={
        isOrganizer && (
          <Button asChild size="sm">
            <Link to="/tournaments/new">
              <Plus className="h-4 w-4" /> New tournament
            </Link>
          </Button>
        )
      }
    >
      {error && <p className="text-destructive">{(error as Error).message}</p>}
      {isLoading || !data ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["Players", data.counts.players],
              ["Tournaments", data.counts.tournaments],
              ["Matches played", data.counts.matches],
              ["Completed events", data.counts.completed],
            ].map(([l, v]) => (
              <div key={l} className="rounded-xl border bg-card p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {l}
                </p>
                <p className="font-display text-4xl font-extrabold">{v}</p>
              </div>
            ))}
          </div>

          {data.live.map((l: LiveMatch) => (
            <Link
              key={l.id}
              to="/matches/$id"
              params={{ id: l.id }}
              className="block rounded-2xl bg-court p-5 text-court-line shadow-lg transition hover:scale-[1.01]"
            >
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest">
                <span className="rounded bg-destructive px-2 py-0.5 text-destructive-foreground">
                  Live
                </span>
                <span>
                  {l.tname} · {l.round_name}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                <p className="font-display text-xl font-bold">{l.aname}</p>
                <p className="font-display text-5xl font-extrabold tabular-nums text-accent">
                  {l.state?.score?.A ?? 0}–{l.state?.score?.B ?? 0}
                </p>
                <p className="text-right font-display text-xl font-bold">{l.bname}</p>
              </div>
              <p className="mt-2 text-sm opacity-80">Tap to resume live scoring</p>
            </Link>
          ))}

          <div className="grid gap-6 lg:grid-cols-2">
            <section>
              <h2 className="mb-3 font-display text-xl font-bold uppercase">Active tournaments</h2>
              {data.active.length === 0 ? (
                <Empty title="No active tournament">Create one to get started.</Empty>
              ) : (
                <div className="space-y-2">
                  {data.active.map((t: any) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between rounded-xl border bg-card p-4"
                    >
                      <div>
                        <p className="font-semibold">{t.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {t.date} · {t.type === "LEAGUE" ? "League" : "Knockout"}{" "}
                          {t.location && `· ${t.location}`}
                        </p>
                      </div>
                      <Button asChild size="sm" variant="secondary">
                        <Link to="/tournaments/$id" params={{ id: t.id }}>
                          <Play className="h-4 w-4" /> Continue
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <h2 className="mb-3 mt-6 font-display text-xl font-bold uppercase">Up next</h2>
              {data.upcoming.length === 0 ? (
                <Empty title="No upcoming matches" />
              ) : (
                <ul className="divide-y rounded-xl border bg-card">
                  {data.upcoming.map((m: UpcomingMatch) => (
                    <li key={m.id}>
                      <Link
                        to="/matches/$id"
                        params={{ id: m.id }}
                        className="flex justify-between p-3 hover:bg-muted"
                      >
                        <span className="font-medium">
                          {m.aname ?? "TBD"} vs {m.bname ?? "TBD"}
                        </span>
                        <span className="text-sm text-muted-foreground">{m.round_name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <h2 className="mb-3 font-display text-xl font-bold uppercase">Top players</h2>
              {data.top.length === 0 ? (
                <Empty title="No results yet" />
              ) : (
                <ol className="divide-y rounded-xl border bg-card">
                  {data.top.map((p: TopPlayer, i: number) => (
                    <li key={p.id}>
                      <Link
                        to="/players/$id"
                        params={{ id: p.id }}
                        className="flex items-center gap-3 p-3 hover:bg-muted"
                      >
                        <span className="font-display text-2xl font-extrabold text-primary">
                          {i + 1}
                        </span>
                        <span className="flex-1 font-medium">{p.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {p.wins}W · {p.winPct}% · {p.pd > 0 ? "+" : ""}
                          {p.pd}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
              {isOrganizer && (
                <div className="mt-6 grid grid-cols-2 gap-2">
                  <Button asChild variant="outline">
                    <Link to="/players">
                      <UserPlus className="h-4 w-4" /> Add players
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/stats">View leaderboard</Link>
                  </Button>
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </AppShell>
  );
}
