import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Fragment, useState } from "react";
import { teamMatches } from "@/lib/engine/tournament";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  ChevronsDown,
  Plus,
  Play,
  Scale,
  SkipForward,
  Trophy,
  Undo2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { api, useAuth } from "@/lib/api";
import { AppShell, Empty, StatusBadge } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Team = {
  id: string;
  name: string;
  player1_id: string;
  player2_id: string;
  p1name: string;
  p2name: string;
};

type Game = {
  A: number;
  B: number;
};

type Match = {
  id: string;
  kind: "LEAGUE" | "LEAGUE_FINAL" | "KNOCKOUT";
  status: "BYE" | "LIVE" | "UPCOMING" | "SKIPPED" | "COMPLETED";
  round_name: string;
  round: number;
  slot_index: number;
  team_a_id: string | null;
  team_b_id: string | null;
  winner_team_id: string | null;
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

type TournamentData = {
  tournament: {
    name: string;
    status: string;
    date: string;
    location?: string | null;
    type: "LEAGUE" | "KNOCKOUT";
    format: number;
    champion_team_id?: string | null;
    runner_up_team_id?: string | null;
  };
  teams: Team[];
  matches: Match[];
  standings: Standing[];
};

type PlayerOption = { id: string; name: string };

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

function AddTeam({
  tournamentId,
  usedPlayers,
  onDone,
}: {
  tournamentId: string;
  usedPlayers: Set<string>;
  onDone: () => void;
}) {
  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => api<PlayerOption[]>("/players"),
  });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [busy, setBusy] = useState(false);
  const free = players.filter((p) => !usedPlayers.has(p.id));
  const sel = "h-9 rounded-md border bg-background px-2 text-sm";
  async function submit() {
    if (busy) return;
    setBusy(true);
    try {
      await api(`/tournaments/${tournamentId}/teams`, {
        body: { name: name.trim(), players: [p1, p2] },
      });
      toast.success("Team added and fixtures created");
      setName("");
      setP1("");
      setP2("");
      setOpen(false);
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!open)
    return (
      <Button size="sm" className="mb-4" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Add team
      </Button>
    );
  return (
    <div className="mb-4 space-y-3 rounded-xl border bg-card p-4">
      <Input
        placeholder="Team name"
        value={name}
        maxLength={100}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        {[
          [p1, setP1, p2],
          [p2, setP2, p1],
        ].map(([v, set, other], i) => (
          <select
            key={i}
            className={sel}
            value={v as string}
            onChange={(e) => (set as (x: string) => void)(e.target.value)}
            aria-label={`Player ${i + 1}`}
          >
            <option value="">Player {i + 1}</option>
            {free
              .filter((p) => p.id !== other)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        New fixtures against every existing team are added and the upcoming matches are rebalanced.
        Completed and live matches are not changed.
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={busy || !name.trim() || !p1 || !p2 || p1 === p2}
          onClick={submit}
        >
          Add team
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

const STATUS_LABEL = {
  LIVE: "Live",
  UPCOMING: "Upcoming",
  SKIPPED: "Skipped",
  COMPLETED: "Completed",
} as const;

function StatusChip({ status }: { status: keyof typeof STATUS_LABEL }) {
  const tone =
    status === "LIVE"
      ? "bg-destructive text-destructive-foreground"
      : status === "COMPLETED"
        ? "bg-muted text-muted-foreground"
        : "border text-muted-foreground";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tone}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Matches of the clicked team (default) or of the whole tournament, with results. */
function TeamMatches({
  teamId,
  matches,
  teamName,
  scope,
  onScope,
}: {
  teamId: string;
  matches: Match[];
  teamName: (id: string | null | undefined) => string | undefined;
  scope: "team" | "all";
  onScope: (s: "team" | "all") => void;
}) {
  const rows = teamMatches(teamId, matches);
  const all = matches.filter((m) => m.status !== "BYE");
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={scope === "team" ? "default" : "outline"}
          onClick={() => onScope("team")}
        >
          {teamName(teamId)} ({rows.length})
        </Button>
        <Button
          size="sm"
          variant={scope === "all" ? "default" : "outline"}
          onClick={() => onScope("all")}
        >
          All matches ({all.length})
        </Button>
      </div>
      {scope === "team" ? (
        rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matches for this team yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  to="/matches/$id"
                  params={{ id: r.id }}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-card p-2.5 text-sm hover:border-primary"
                >
                  <StatusChip status={r.status} />
                  <span className="text-xs text-muted-foreground">{r.roundName}</span>
                  <span className="flex-1 font-medium">vs {teamName(r.opponentId)}</span>
                  {r.outcome && (
                    <span
                      className={`rounded px-1.5 text-xs font-bold ${r.outcome === "W" ? "bg-primary text-primary-foreground" : "bg-destructive/15 text-destructive"}`}
                    >
                      {r.outcome === "W" ? "Won" : "Lost"}
                    </span>
                  )}
                  {r.liveScore && (
                    <span className="font-display tabular-nums">
                      {r.liveScore.for}–{r.liveScore.against}
                    </span>
                  )}
                  {r.status === "COMPLETED" && (
                    <span className="font-display tabular-nums">
                      {r.games.map((g) => `${g.for}-${g.against}`).join(", ")}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : (
        <ul className="space-y-1.5">
          {all.map((m) => (
            <li key={m.id}>
              <Link
                to="/matches/$id"
                params={{ id: m.id }}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-card p-2.5 text-sm hover:border-primary"
              >
                <StatusChip status={m.status as keyof typeof STATUS_LABEL} />
                <span className="text-xs text-muted-foreground">{m.round_name}</span>
                <span className="flex-1 font-medium">
                  <span
                    className={
                      m.winner_team_id && m.winner_team_id === m.team_a_id
                        ? "font-bold text-primary"
                        : ""
                    }
                  >
                    {teamName(m.team_a_id)}
                  </span>
                  {" vs "}
                  <span
                    className={
                      m.winner_team_id && m.winner_team_id === m.team_b_id
                        ? "font-bold text-primary"
                        : ""
                    }
                  >
                    {teamName(m.team_b_id)}
                  </span>
                </span>
                {m.live && (
                  <span className="font-display tabular-nums">
                    {m.live.score.A}–{m.live.score.B}
                  </span>
                )}
                {m.status === "COMPLETED" && (
                  <span className="font-display tabular-nums">
                    {m.games.map((g) => `${g.A}-${g.B}`).join(", ")}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TournamentPage() {
  const { id } = Route.useParams();
  const { isOrganizer } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["tournament", id],
    queryFn: () => api<TournamentData>(`/tournaments/${id}`),
  });
  const [openTeam, setOpenTeam] = useState<string | null>(null);
  const [scope, setScope] = useState<"team" | "all">("team");
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
  const tn = (tid: string | null | undefined) => (tid ? team[tid]?.name : "TBD");
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
  const canAddTeam =
    t.type === "LEAGUE" &&
    t.status === "LIVE" &&
    !matches.some((m: Match) => m.kind === "LEAGUE_FINAL");
  async function rebalance() {
    try {
      await api(`/tournaments/${id}/rebalance`, { body: {} });
      qc.invalidateQueries({ queryKey: ["tournament", id] });
      toast.success("Upcoming matches rebalanced");
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
          {isOrganizer && t.type === "LEAGUE" && t.status === "LIVE" && (
            <div className="mb-3 flex items-center gap-3">
              <Button size="sm" variant="secondary" onClick={rebalance}>
                <Scale className="h-4 w-4" /> Rebalance upcoming matches
              </Button>
              <span className="text-xs text-muted-foreground">
                Reorders only upcoming matches; completed, live and skipped matches stay put.
              </span>
            </div>
          )}
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
                {standings.map((r: Standing, i: number) => {
                  const open = openTeam === r.team;
                  const toggle = () => setOpenTeam(open ? null : r.team);
                  return (
                    <Fragment key={r.team}>
                      <tr
                        className={`cursor-pointer border-t hover:bg-muted/50 ${i < 2 ? "bg-accent/20" : ""}`}
                        tabIndex={0}
                        aria-expanded={open}
                        onClick={toggle}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggle();
                          }
                        }}
                      >
                        <td className="p-3 font-display font-bold">{i + 1}</td>
                        <td className="p-3 font-medium">
                          <span className="inline-flex items-center gap-1">
                            <ChevronRight
                              className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`}
                              aria-hidden="true"
                            />
                            {tn(r.team)}
                          </span>
                        </td>
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
                      {open && (
                        <tr className="border-t bg-muted/30">
                          <td colSpan={9} className="p-3">
                            <TeamMatches
                              teamId={r.team}
                              matches={matches}
                              teamName={tn}
                              scope={scope}
                              onScope={setScope}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Tap a team to see its live, upcoming and completed matches. Top 2 play the League Final
            (Best of 1). The final does not change this table. PD counts each game's margin, except
            a deuce game (loser on 20+), which counts as ±1.
          </p>
        </TabsContent>

        <TabsContent value="bracket">
          <div className="flex gap-4 overflow-x-auto pb-2">
            {[...new Set(matches.map((m: Match) => m.round as number))].sort().map((r) => (
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
          {isOrganizer && t.type === "KNOCKOUT" && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
              <Button size="sm" disabled>
                <Plus className="h-4 w-4" /> Add team
              </Button>
              Teams can't be added to a knockout tournament after it starts.
            </div>
          )}
          {isOrganizer &&
            t.type === "LEAGUE" &&
            (canAddTeam ? (
              <AddTeam
                tournamentId={id}
                usedPlayers={new Set(teams.flatMap((x: Team) => [x.player1_id, x.player2_id]))}
                onDone={() => qc.invalidateQueries({ queryKey: ["tournament", id] })}
              />
            ) : (
              <p className="mb-4 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                {t.status === "COMPLETED"
                  ? "This league is finished."
                  : "The League Final is scheduled, so teams can no longer be added."}
              </p>
            ))}
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
