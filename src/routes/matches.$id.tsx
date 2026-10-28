import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowLeftRight,
  Pause,
  Pencil,
  Play,
  RotateCw,
  Undo2,
  Trophy,
} from "lucide-react";
import { api, useAuth } from "@/lib/api";
import {
  applyAction,
  canEditStart,
  START_EDIT_POINT_LIMIT,
  type MatchAction,
  type MatchState,
  type TeamKey,
} from "@/lib/engine/scoring";
import { resultHeading } from "@/lib/engine/tournament";
import { Court, type CourtOrientation } from "@/components/Court";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/matches/$id")({
  head: () => ({
    meta: [
      { title: "Live match — Smash Court" },
      {
        name: "description",
        content: "Live badminton doubles scoring with server and court positions.",
      },
      { property: "og:title", content: "Live match — Smash Court" },
      {
        property: "og:description",
        content: "Live badminton doubles scoring with server and court positions.",
      },
    ],
  }),
  component: MatchPage,
});

type Player = { id: string; name: string };
type TeamInfo = {
  id: string;
  name: string;
  players: Player[];
  /** Completed matches this team has played in the tournament. */
  matchesPlayed: number;
};
type Game = { A: number; B: number };
type Toss = {
  tossWinner: TeamKey;
  tossChoice: "SERVE" | "COURT";
  teamASide: "top" | "bottom";
  servingTeam: TeamKey;
  serverId: string;
  receiverId: string;
};
type MatchInfo = {
  id: string;
  kind: string;
  round_name: string | null;
  status: string;
  format: number;
  winner_team_id: string | null;
  toss: Toss | null;
  games: Game[];
};
type TournamentInfo = {
  id: string;
  name: string;
  type: string;
  status: string;
  champion_team_id: string | null;
};
type MatchResponse = {
  match: MatchInfo;
  teamA: TeamInfo | null;
  teamB: TeamInfo | null;
  state: MatchState | null;
  seq: number;
  tournament: TournamentInfo;
  /** Place of this match in the tournament schedule (byes excluded). */
  schedule: { position: number | null; total: number };
};

function MatchPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { isOrganizer } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["match", id],
    queryFn: () => api<MatchResponse>(`/matches/${id}`),
  });
  const [busy, setBusy] = useState(false);
  // View preference only: deliberately local and not persisted, so it resets on reload.
  const [orientation, setOrientation] = useState<CourtOrientation>("horizontal");
  const [editingStart, setEditingStart] = useState(false);

  if (error)
    return (
      <Wrap>
        <p className="text-destructive">{(error as Error).message}</p>
      </Wrap>
    );
  if (isLoading || !data)
    return (
      <Wrap>
        <Skeleton className="h-96" />
      </Wrap>
    );
  const { match, teamA, teamB, state, seq, tournament, schedule } = data;
  const back = (
    <Link
      to="/tournaments/$id"
      params={{ id: tournament.id }}
      className="inline-flex items-center gap-1 text-sm opacity-80 hover:opacity-100"
    >
      <ArrowLeft className="h-4 w-4" /> {tournament.name}
    </Link>
  );
  if (!teamA || !teamB)
    return (
      <Wrap>
        {back}
        <p className="mt-6">Teams for this match are not decided yet.</p>
      </Wrap>
    );
  const names = Object.fromEntries([...teamA.players, ...teamB.players].map((p) => [p.id, p.name]));
  const teamNames = { A: teamA.name, B: teamB.name };

  async function send(action: MatchAction | { type: "UNDO" }) {
    if (busy) return;
    setBusy(true);
    if (action.type !== "UNDO" && state) {
      try {
        qc.setQueryData(["match", id], {
          ...data,
          state: applyAction(state, action),
          seq: seq + 1,
        });
      } catch (e) {
        toast.error((e as Error).message);
        setBusy(false);
        return;
      }
    }
    try {
      const r = await api(`/matches/${id}/action`, { body: { action, seq } });
      qc.setQueryData(["match", id], r);
    } catch (e) {
      toast.error((e as Error).message);
      refetch();
    } finally {
      setBusy(false);
    }
  }

  if (match.status === "COMPLETED" || match.status === "BYE")
    return (
      <Wrap>
        {back}
        <div className="mt-6 rounded-2xl bg-court p-8 text-center text-court-line">
          <Trophy className="mx-auto h-10 w-10 text-accent" />
          <p className="mt-2 text-sm uppercase tracking-widest opacity-80">
            {resultHeading(match, tournament)}
          </p>
          <p className="font-display text-4xl font-extrabold">
            {match.winner_team_id === teamA.id ? teamA.name : teamB.name}
          </p>
          <p className="mt-4 font-display text-2xl tabular-nums">
            {match.games.map((g: Game) => `${g.A}–${g.B}`).join("  ·  ")}
          </p>
          <p className="mt-1 text-sm opacity-70">
            {teamA.name} vs {teamB.name}
          </p>
        </div>
      </Wrap>
    );

  if (!state)
    return (
      <Wrap>
        {back}
        {isOrganizer ? (
          <Setup
            id={id}
            match={match}
            teamA={teamA}
            teamB={teamB}
            onDone={(r) => qc.setQueryData(["match", id], r)}
          />
        ) : (
          <p className="mt-6">
            This match has not started yet. Organizers can start it after signing in.
          </p>
        )}
      </Wrap>
    );

  const over = state.status === "GAME_OVER" || state.status === "MATCH_OVER";
  const topTeam: TeamKey = state.sides.A === "top" ? "A" : "B";
  const bottomTeam: TeamKey = topTeam === "A" ? "B" : "A";
  // +1 buttons follow the court (top team left) unless the organizer toggled "Switch ends";
  // the court itself always follows state.sides.
  const buttonOrder: TeamKey[] = state.buttonsSwapped
    ? [bottomTeam, topTeam]
    : [topTeam, bottomTeam];
  return (
    <div className="min-h-screen bg-sidebar text-sidebar-foreground">
      <div className="mx-auto max-w-6xl p-3 md:p-6">
        <div className="mb-3 flex items-center justify-between">
          {back}
          <span className="text-xs font-bold uppercase tracking-widest">
            {match.round_name} ·{" "}
            {state.format === 3 || !schedule.position
              ? `Game ${state.gameNumber} of ${state.format === 3 ? "3" : "1"}`
              : `Match ${schedule.position} of ${schedule.total}`}
          </span>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {/* Left button = team on the top side, right = bottom side; "Switch ends" swaps only these buttons. */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 md:gap-3">
              {buttonOrder.flatMap((k, i) => {
                const btn = (
                  <button
                    key={k}
                    disabled={!isOrganizer || state.status !== "LIVE" || busy}
                    onClick={() => send({ type: "RALLY_WON", team: k })}
                    className={`min-w-0 rounded-2xl p-3 text-center transition active:scale-95 disabled:opacity-90 md:p-4 ${state.servingTeam === k ? "bg-accent text-accent-foreground" : "bg-sidebar-accent"}`}
                  >
                    <p className="truncate font-display text-lg font-bold uppercase">
                      {teamNames[k]}
                    </p>
                    <p className="font-display text-7xl font-extrabold leading-none tabular-nums md:text-9xl">
                      {state.score[k]}
                    </p>
                    <p className="text-xs uppercase tracking-wide opacity-70">
                      Matches played {(k === "A" ? teamA : teamB).matchesPlayed}
                      {state.format === 3 ? ` · Games ${state.gamesWon[k]}` : ""}
                      {state.servingTeam === k ? " · Serving" : ""}
                    </p>
                    {isOrganizer && state.status === "LIVE" && (
                      <p className="mt-2 rounded-lg bg-background/20 py-2 font-display text-2xl font-bold">
                        {teamNames[k]} +1
                      </p>
                    )}
                  </button>
                );
                return i === 0
                  ? [
                      btn,
                      <Button
                        key="switch"
                        variant="secondary"
                        className="h-auto flex-col gap-1 px-2 md:px-4"
                        aria-label="Switch ends"
                        disabled={
                          !isOrganizer ||
                          busy ||
                          (state.status !== "LIVE" && state.status !== "PAUSED")
                        }
                        onClick={() => send({ type: "SWITCH_ENDS" })}
                      >
                        <ArrowLeftRight className="h-5 w-5" />
                        <span className="text-[10px] uppercase leading-tight">
                          Switch
                          <br />
                          ends
                        </span>
                      </Button>,
                    ]
                  : [btn];
              })}
            </div>
            <div className="rounded-2xl bg-background p-4 text-foreground">
              <div className="mb-2 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Rotate court 90 degrees"
                  onClick={() =>
                    setOrientation((o) => (o === "horizontal" ? "vertical" : "horizontal"))
                  }
                >
                  <RotateCw className="h-4 w-4" /> Rotate court
                </Button>
              </div>
              <Court state={state} names={names} teamNames={teamNames} orientation={orientation} />
            </div>
          </div>
          <aside className="space-y-3">
            <div className="rounded-2xl bg-sidebar-accent p-4 text-sm">
              <p>
                <b>Server:</b> {names[state.serverId!]} ({state.serviceCourt} court)
              </p>
              <p>
                <b>Receiver:</b> {names[state.receiverId!]}
              </p>
              <p className="mt-2 opacity-80">Rallies: {state.rallyCount}</p>
              {state.games.length > 0 && (
                <p className="mt-2">
                  <b>Games:</b> {state.games.map((g) => `${g.A}–${g.B}`).join(", ")}
                </p>
              )}
              {state.score.A >= 20 && state.score.B >= 20 && state.status === "LIVE" && (
                <p className="mt-2 font-bold text-sidebar-primary">Deuce — win by 2 (30 caps)</p>
              )}
            </div>
            {isOrganizer && match.toss && canEditStart(state) && (
              <div>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={busy}
                  onClick={() => setEditingStart(true)}
                >
                  <Pencil className="h-4 w-4" /> Edit toss, server &amp; receiver
                </Button>
                <p className="mt-1 text-center text-xs opacity-70">
                  Available until {START_EDIT_POINT_LIMIT} points are recorded (
                  {START_EDIT_POINT_LIMIT - state.rallyCount} left).
                </p>
              </div>
            )}
            {isOrganizer && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  disabled={busy || state.rallyCount === 0}
                  onClick={() => send({ type: "UNDO" })}
                >
                  <Undo2 className="h-4 w-4" /> Undo
                </Button>
                {state.status === "PAUSED" ? (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => send({ type: "MATCH_RESUMED" })}
                  >
                    <Play className="h-4 w-4" /> Resume
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    disabled={busy || state.status !== "LIVE"}
                    onClick={() => send({ type: "MATCH_PAUSED" })}
                  >
                    <Pause className="h-4 w-4" /> Pause
                  </Button>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>
      {over && isOrganizer && (
        <GameOver
          state={state}
          teams={{ A: teamA, B: teamB }}
          busy={busy}
          onNext={(serverId, receiverId) => send({ type: "GAME_STARTED", serverId, receiverId })}
          onUndo={() => send({ type: "UNDO" })}
          onConfirm={async () => {
            setBusy(true);
            try {
              qc.setQueryData(["match", id], await api(`/matches/${id}/confirm`, { body: {} }));
              qc.invalidateQueries({ queryKey: ["tournament", tournament.id] });
              toast.success("Result saved");
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
      {editingStart && isOrganizer && match.toss && canEditStart(state) && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-foreground/70 p-4">
          <div className="mx-auto max-w-3xl">
            <Setup
              id={id}
              match={match}
              teamA={teamA}
              teamB={teamB}
              edit={{ seq, toss: match.toss, onCancel: () => setEditingStart(false) }}
              onDone={(r) => {
                qc.setQueryData(["match", id], r);
                setEditingStart(false);
                toast.success("Toss, server and receiver updated");
              }}
            />
          </div>
        </div>
      )}
      {state.status === "PAUSED" && (
        <div className="fixed inset-x-0 top-0 bg-destructive py-2 text-center text-sm font-bold uppercase text-destructive-foreground">
          Match paused
        </div>
      )}
    </div>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl p-4 md:p-8">{children}</div>
    </div>
  );
}

function PickPlayer({
  label,
  players,
  value,
  onChange,
}: {
  label: string;
  players: Player[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        {players.map((p) => (
          <Button
            key={p.id}
            type="button"
            size="lg"
            variant={value === p.id ? "default" : "outline"}
            onClick={() => onChange(p.id)}
          >
            {p.name}
          </Button>
        ))}
      </div>
    </div>
  );
}

function GameOver({
  state,
  teams,
  busy,
  onNext,
  onUndo,
  onConfirm,
}: {
  state: MatchState;
  teams: Record<TeamKey, TeamInfo>;
  busy: boolean;
  onNext: (s: string, r: string) => void;
  onUndo: () => void;
  onConfirm: () => void;
}) {
  const last = state.games[state.games.length - 1]!;
  const w = last.winner!;
  const l: TeamKey = w === "A" ? "B" : "A";
  const [server, setServer] = useState("");
  const [receiver, setReceiver] = useState("");
  const matchOver = state.status === "MATCH_OVER";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/70 p-4">
      <div className="w-full max-w-md space-y-5 rounded-2xl bg-card p-6 text-card-foreground">
        <div className="text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-primary">
            {matchOver ? "Match complete" : `Game ${state.gameNumber} won`}
          </p>
          <p className="font-display text-3xl font-extrabold">{teams[w].name}</p>
          <p className="font-display text-xl tabular-nums">
            {state.games.map((g) => `${g.A}–${g.B}`).join("  ·  ")}
          </p>
        </div>
        {!matchOver && (
          <>
            <p className="text-sm text-muted-foreground">
              Teams change ends. {teams[w].name} serves first.
            </p>
            <PickPlayer
              label="Server"
              players={teams[w].players}
              value={server}
              onChange={setServer}
            />
            <PickPlayer
              label="Receiver"
              players={teams[l].players}
              value={receiver}
              onChange={setReceiver}
            />
          </>
        )}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" disabled={busy} onClick={onUndo}>
            <Undo2 className="h-4 w-4" /> Undo last point
          </Button>
          {matchOver ? (
            <Button className="flex-1" disabled={busy} onClick={onConfirm}>
              Confirm result
            </Button>
          ) : (
            <Button
              className="flex-1"
              disabled={busy || !server || !receiver}
              onClick={() => onNext(server, receiver)}
            >
              Start next game
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Setup({
  id,
  match,
  teamA,
  teamB,
  onDone,
  edit,
}: {
  id: string;
  match: MatchInfo;
  teamA: TeamInfo;
  teamB: TeamInfo;
  onDone: (r: MatchResponse) => void;
  /** Present when correcting a live match: starts from the recorded setup instead of blank. */
  edit?: { seq: number; toss: Toss; onCancel: () => void };
}) {
  const teams = { A: teamA, B: teamB };
  const [flipping, setFlipping] = useState(false);
  const [winner, setWinner] = useState<TeamKey | null>(edit?.toss.tossWinner ?? null);
  const [choice, setChoice] = useState<"SERVE" | "COURT" | null>(edit?.toss.tossChoice ?? null);
  const [aSide, setASide] = useState<"top" | "bottom" | null>(edit?.toss.teamASide ?? null);
  const [server, setServer] = useState(edit?.toss.serverId ?? "");
  const [receiver, setReceiver] = useState(edit?.toss.receiverId ?? "");
  const [busy, setBusy] = useState(false);
  const serving: TeamKey | null =
    winner && choice ? (choice === "SERVE" ? winner : winner === "A" ? "B" : "A") : null;
  const sidePicker: TeamKey | null =
    winner && choice ? (choice === "COURT" ? winner : winner === "A" ? "B" : "A") : null;
  // A changed toss can change the serving team, which makes an earlier pick invalid.
  const receiving: TeamKey | null = serving ? (serving === "A" ? "B" : "A") : null;
  const serverOk = !!serving && teams[serving].players.some((p) => p.id === server);
  const receiverOk = !!receiving && teams[receiving].players.some((p) => p.id === receiver);

  function flip() {
    setFlipping(true);
    setTimeout(() => {
      setWinner(Math.random() < 0.5 ? "A" : "B");
      setFlipping(false);
    }, 1200);
  }
  async function start() {
    setBusy(true);
    try {
      onDone(
        await api(`/matches/${id}/${edit ? "edit-start" : "start"}`, {
          body: {
            ...(edit ? { seq: edit.seq } : {}),
            tossWinner: winner,
            tossChoice: choice,
            teamASide: aSide,
            servingTeam: serving,
            serverId: server,
            receiverId: receiver,
          },
        }),
      );
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className={`${edit ? "" : "mt-6 "}space-y-6 rounded-2xl border bg-card p-6`}>
      <div className="text-center">
        {edit && (
          <p className="mb-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground">
            Editing the match start. Points already recorded are kept; the current server and
            receiver are recalculated for the current score.
          </p>
        )}
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {match.round_name} · Best of {match.kind === "LEAGUE_FINAL" ? 1 : match.format}
        </p>
        <p className="font-display text-3xl font-extrabold">
          {teamA.name} <span className="text-muted-foreground">vs</span> {teamB.name}
        </p>
      </div>
      <section className="text-center">
        <h2 className="mb-3 font-display text-xl font-bold uppercase">1 · Coin toss</h2>
        <div
          className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full border-4 border-primary bg-accent font-display text-2xl font-extrabold text-accent-foreground ${flipping ? "animate-spin" : ""}`}
        >
          {winner ? teams[winner].name.slice(0, 1) : "?"}
        </div>
        {winner ? (
          <>
            <p className="mt-3 font-semibold">{teams[winner].name} won the toss</p>
            {edit && (
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {(["A", "B"] as const).map((k) => (
                  <Button
                    key={k}
                    size="sm"
                    variant={winner === k ? "default" : "outline"}
                    onClick={() => setWinner(k)}
                  >
                    {teams[k].name} won
                  </Button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Button onClick={flip} disabled={flipping}>
              Flip coin
            </Button>
            <Button variant="outline" onClick={() => setWinner("A")}>
              {teamA.name} won
            </Button>
            <Button variant="outline" onClick={() => setWinner("B")}>
              {teamB.name} won
            </Button>
          </div>
        )}
      </section>
      {winner && (
        <section>
          <h2 className="mb-3 font-display text-xl font-bold uppercase">
            2 · {teams[winner].name} chooses
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="lg"
              variant={choice === "SERVE" ? "default" : "outline"}
              onClick={() => setChoice("SERVE")}
            >
              Serve first
            </Button>
            <Button
              size="lg"
              variant={choice === "COURT" ? "default" : "outline"}
              onClick={() => setChoice("COURT")}
            >
              Choose court side
            </Button>
          </div>
        </section>
      )}
      {sidePicker && (
        <section>
          <h2 className="mb-3 font-display text-xl font-bold uppercase">
            3 · {teams[sidePicker].name} picks a side
          </h2>
          <div className="mx-auto grid max-w-xs overflow-hidden rounded-lg border-4 border-court-line bg-court text-court-line">
            {(["top", "bottom"] as const).map((side) => {
              const mine = sidePicker === "A" ? side : side === "top" ? "bottom" : "top";
              const sel = aSide !== null && (sidePicker === "A" ? aSide === side : aSide === mine);
              return (
                <button
                  key={side}
                  onClick={() => setASide(sidePicker === "A" ? side : mine)}
                  className={`h-20 font-display text-lg font-bold uppercase ${side === "top" ? "border-b-4 border-court-line" : ""} ${sel ? "bg-accent text-accent-foreground" : ""}`}
                >
                  {sel ? teams[sidePicker].name : `${side} side`}
                </button>
              );
            })}
          </div>
        </section>
      )}
      {serving && aSide && (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-bold uppercase">4 · Server & receiver</h2>
          <PickPlayer
            label={`Server (${teams[serving].name})`}
            players={teams[serving].players}
            value={serverOk ? server : ""}
            onChange={setServer}
          />
          <PickPlayer
            label={`Receiver (${teams[serving === "A" ? "B" : "A"].name})`}
            players={teams[serving === "A" ? "B" : "A"].players}
            value={receiverOk ? receiver : ""}
            onChange={setReceiver}
          />
          <div className="flex gap-2">
            {edit && (
              <Button size="lg" variant="outline" className="flex-1" onClick={edit.onCancel}>
                Cancel
              </Button>
            )}
            <Button
              size="lg"
              className="flex-1"
              disabled={!serverOk || !receiverOk || busy}
              onClick={start}
            >
              {edit ? "Save changes" : "Start match"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
