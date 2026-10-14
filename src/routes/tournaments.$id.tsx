import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ChevronsDown, Play, SkipForward, Trophy, Undo2 } from "lucide-react";
import { api, useAuth } from "@/lib/api";
import { AppShell, Empty, StatusBadge } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/tournaments/$id")({
  head: () => ({
    meta: [
      { title: "Tournament — Smash Court" },
      {
        name: "description",
        content: "Badminton tournament schedule, standings, teams and results.",
      },
      { property: "og:title", content: "Tournament — Smash Court" },
      {
        property: "og:description",
        content: "Badminton tournament schedule, standings, teams and results.",
      },
    ],
  }),
  component: TournamentPage,
});

type Team = {
  id: string;
  name: string;
  player1_id: string;
  player2_id: string;
  p1name: string;
  p2name: string;
};

type Game = { A: number; B: number };

type Match = {
  id: string;
  status: string;
  team_a_id: string | null;
  team_b_id: string | null;
  winner_team_id: string | null;
  round: number;
  round_name: string;
  slot_index: number;
  games: Game[];
  live?: { score: Game } | null;
};

type Standing = {
  team: string;
  mp: number;
  w: number;
  l: number;
  points: number;
  scored: number;
  conceded: number;
  pd: number;
};

function TournamentPage() {
  const { id } = Route.useParams();
  const { isOrganizer } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["tournament", id],
    queryFn: () => api(`/tournaments/${id}`),
  });
  if (error)
    return (
      <AppShell title="Tournament">
        <p className="text-destructive">{(error as Error).message}</p>
      </AppShell>
    );
  if (isLoading || !data)
    return (
      <AppShell title="Tournament">
        <Skeleton className="h-64" />
      </AppShell>
    );

  const { tournament: t, teams, matches, standings } = data;
  const team = Object.fromEntries(teams.map((x: Team) => [x.id, x]));
  const tn = (tid: string | null) => (tid ? team[tid]?.name : "TBD");
  const sched = matches.filter((m: Match) => m.status !== "BYE");
  const live = sched.find((m: Match) => m.status === "LIVE");
  const upcoming = sched.filter((m: Match) => m.status === "UPCOMING" || m.status === "SKIPPED");
  const nextId = upcoming.find(
    (m: Match) => m.status === "UPCOMING" && m.team_a_id && m.team_b_id,
  )?.id;

  async function op(mid: string, o: string) {
    try {
      await api(`/matches/${mid}/schedule`, { body: { op: o } });
      qc.invalidateQueries({ queryKey: ["tournament", id] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  const label = (m: Match) =>
    m.status === "LIVE"
      ? "Live"
      : m.id === nextId
        ? "Up next"
        : m.status === "COMPLETED"
          ? "Completed"
          : m.status === "SKIPPED"
            ? "Skipped"
            : "Upcoming";

  return (
    <AppShell title={t.name}>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <StatusBadge status={t.status} />
        <span>{t.date}</span>
        {t.location && <span>· {t.location}</span>}
        <span>
          · {t.type === "LEAGUE" ? "League" : "Knockout"} · Best of {t.format}
        </span>
      </div>
      {t.status === "COMPLETED" && (
        <div className="mb-6 rounded-2xl bg-court p-6 text-court-line">
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-accent">
            <Trophy className="h-4 w-4" /> Champion
          </p>
          <p className="font-display text-4xl font-extrabold">{tn(t.champion_team_id)}</p>
          <p className="mt-1 opacity-80">Runner-up: {tn(t.runner_up_team_id)}</p>
        </div>
      )}
      {live && (
        <Link
          to="/matches/$id"
          params={{ id: live.id }}
          className="mb-6 flex items-center justify-between rounded-xl bg-destructive p-4 text-destructive-foreground"
        >
          <span className="font-semibold">
            LIVE: {tn(live.team_a_id)} vs {tn(live.team_b_id)}{" "}
            {live.live && `· ${live.live.score.A}–${live.live.score.B}`}
          </span>
          <span className="font-bold">Resume →</span>
        </Link>
      )}
      <Tabs defaultValue="schedule">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          {t.type === "LEAGUE" && <TabsTrigger value="standings">Standings</TabsTrigger>}
          {t.type === "KNOCKOUT" && <TabsTrigger value="bracket">Bracket</TabsTrigger>}
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule">
          <ol className="space-y-2">
            {sched.map((m: Match) => {
              const editable = isOrganizer && (m.status === "UPCOMING" || m.status === "SKIPPED");
              return (
                <li
                  key={m.id}
                  className={`rounded-xl border bg-card p-3 ${m.id === nextId ? "border-primary ring-2 ring-primary/30" : ""} ${m.status === "COMPLETED" ? "opacity-70" : ""}`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      {label(m)}
                    </span>
                    <span className="text-xs text-muted-foreground">{m.round_name}</span>
                    <Link
                      to="/matches/$id"
                      params={{ id: m.id }}
                      className="flex-1 font-medium hover:underline"
                    >
                      <span
                        className={
                          m.winner_team_id === m.team_a_id && m.winner_team_id
                            ? "font-bold text-primary"
                            : ""
                        }
                      >
                        {tn(m.team_a_id)}
                      </span>
                      {" vs "}
                      <span
                        className={
                          m.winner_team_id === m.team_b_id && m.winner_team_id
                            ? "font-bold text-primary"
                            : ""
                        }
                      >
                        {tn(m.team_b_id)}
                      </span>
                    </Link>
                    {m.status === "COMPLETED" && (
                      <span className="font-display tabular-nums">
                        {m.games.map((g: Game) => `${g.A}-${g.B}`).join(", ")}
                      </span>
                    )}
                    {editable && (
                      <div className="flex gap-1">
                        {m.team_a_id && m.team_b_id && (
                          <Button asChild size="sm">
                            <Link to="/matches/$id" params={{ id: m.id }}>
                              <Play className="h-4 w-4" /> Start
                            </Link>
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Move up"
                          onClick={() => op(m.id, "up")}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Move down"
                          onClick={() => op(m.id, "down")}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Move to end"
                          onClick={() => op(m.id, "end")}
                        >
                          <ChevronsDown className="h-4 w-4" />
                        </Button>
                        {m.status === "SKIPPED" ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Unskip"
                            onClick={() => op(m.id, "unskip")}
                          >
                            <Undo2 className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Skip for now"
                            onClick={() => op(m.id, "skip")}
                          >
                            <SkipForward className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </TabsContent>

        <TabsContent value="standings">
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                <tr>
                  {["#", "Team", "MP", "W", "L", "Pts", "PF", "PA", "PD"].map((h) => (
                    <th key={h} className="p-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {standings.map((r: Standing, i: number) => (
                  <tr key={r.team} className={`border-t ${i < 2 ? "bg-accent/20" : ""}`}>
                    <td className="p-3 font-display font-bold">{i + 1}</td>
                    <td className="p-3 font-medium">{tn(r.team)}</td>
                    <td className="p-3">{r.mp}</td>
                    <td className="p-3">{r.w}</td>
                    <td className="p-3">{r.l}</td>
                    <td className="p-3 font-bold">{r.points}</td>
                    <td className="p-3">{r.scored}</td>
                    <td className="p-3">{r.conceded}</td>
                    <td className="p-3">
                      {r.pd > 0 ? "+" : ""}
                      {r.pd}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Top 2 play the League Final (Best of 1). The final does not change this table.
          </p>
        </TabsContent>

        <TabsContent value="bracket">
          <div className="flex gap-4 overflow-x-auto pb-2">
            {[...new Set(matches.map((m: Match) => m.round))].sort().map((r) => (
              <div key={r as number} className="flex min-w-56 flex-col justify-around gap-3">
                <p className="text-center text-xs font-bold uppercase text-muted-foreground">
                  {matches.find((m: Match) => m.round === r)?.round_name}
                </p>
                {matches
                  .filter((m: Match) => m.round === r)
                  .sort((a: Match, b: Match) => a.slot_index - b.slot_index)
                  .map((m: Match) => (
                    <div key={m.id} className="rounded-lg border bg-card text-sm">
                      {[m.team_a_id, m.team_b_id].map((tid, k) => (
                        <div
                          key={k}
                          className={`flex justify-between px-3 py-2 ${k ? "border-t" : ""} ${tid && tid === m.winner_team_id ? "font-bold text-primary" : ""}`}
                        >
                          <span>{m.status === "BYE" && k === 1 ? "BYE" : tn(tid)}</span>
                          <span className="tabular-nums">
                            {m.games.map((g: Game) => (k ? g.B : g.A)).join(" ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="teams">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((x: Team) => (
              <div key={x.id} className="rounded-xl border bg-card p-4">
                <p className="font-display text-lg font-bold">{x.name}</p>
                <p className="text-sm text-muted-foreground">
                  <Link to="/players/$id" params={{ id: x.player1_id }} className="hover:underline">
                    {x.p1name}
                  </Link>{" "}
                  &{" "}
                  <Link to="/players/$id" params={{ id: x.player2_id }} className="hover:underline">
                    {x.p2name}
                  </Link>
                </p>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="results">
          {matches.filter((m: Match) => m.status === "COMPLETED").length === 0 ? (
            <Empty title="No results yet" />
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {matches
                .filter((m: Match) => m.status === "COMPLETED")
                .map((m: Match) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                    <span>
                      <span className="text-xs text-muted-foreground">{m.round_name} · </span>
                      <b>{tn(m.winner_team_id)}</b> beat{" "}
                      {tn(m.winner_team_id === m.team_a_id ? m.team_b_id : m.team_a_id)}
                    </span>
                    <span className="font-display tabular-nums">
                      {m.games.map((g: Game) => `${g.A}-${g.B}`).join(", ")}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
