import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Shuffle, Lock, Unlock, Check, X } from "lucide-react";
import { api, useAuth } from "@/lib/api";
import { buildTeams, pairingKey, knockoutBracket, roundRobin, scheduleLeague } from "@/lib/engine/tournament";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/tournaments/new")({
  head: () => ({
    meta: [
      { title: "New tournament — Smash Court" },
      { name: "description", content: "Create a badminton doubles tournament: players, teams and fixtures." },
      { property: "og:title", content: "New tournament — Smash Court" },
      { property: "og:description", content: "Create a badminton doubles tournament: players, teams and fixtures." },
    ],
  }),
  component: Wizard,
});

type Team = { name: string; players: [string, string]; locked: boolean };
const STEPS = ["Details", "Players", "Teams", "Fixtures", "Ready"];

function Wizard() {
  const { isOrganizer, ready } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => api<any[]>("/players") });
  const names = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p.name])), [players]);

  const [step, setStep] = useState(0);
  const [info, setInfo] = useState({ name: "", date: new Date().toISOString().slice(0, 10), location: "", type: "KNOCKOUT" as "KNOCKOUT" | "LEAGUE", format: 1 as 1 | 3 });
  const [selected, setSelected] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [mode, setMode] = useState<"random" | "manual">("random");
  const [teams, setTeams] = useState<Team[]>([]);
  const [pick, setPick] = useState<string | null>(null);
  const [fixtures, setFixtures] = useState<[number, number | null][]>([]);
  const [busy, setBusy] = useState(false);

  if (ready && !isOrganizer)
    return <AppShell title="New tournament"><p>Please <Link to="/login" className="font-semibold text-primary underline">sign in as an organizer</Link> to create a tournament.</p></AppShell>;

  const teamName = (p: [string, string]) => `${names[p[0]]} & ${names[p[1]]}`;
  const pairKey = (p: [string, string]) => [...p].sort().join("+");
  /** Keep every locked team (and its edited name) as is; pair only the remaining players at random. */
  function rebuild(locked: Team[], previous?: Team[]) {
    const prevKey = previous?.length ? pairingKey(previous.map((t) => t.players)) : undefined;
    const built = buildTeams(selected, locked.map((t) => t.players), { previousKey: prevKey });
    const byKey = new Map(locked.map((t) => [pairKey(t.players), t]));
    setTeams(built.map((b) => byKey.get(pairKey(b.players)) ?? { name: teamName(b.players), players: b.players, locked: false }));
  }
  function shuffleTeams() {
    rebuild(teams.filter((t) => t.locked), teams);
  }
  function makeFixtures(t = teams) {
    const idx = t.map((_, i) => String(i));
    if (info.type === "KNOCKOUT") {
      const b = knockoutBracket(idx);
      setFixtures(b.slots.filter((s) => s.round === 1).map((s) => [Number(s.a), s.b === null ? null : Number(s.b)]));
    } else setFixtures(scheduleLeague(roundRobin(idx)).map(([a, b]) => [Number(a), Number(b)]));
  }
  async function quickAdd() {
    if (!newName.trim()) return;
    try {
      const p = await api("/players", { body: { name: newName.trim() } });
      await qc.invalidateQueries({ queryKey: ["players"] });
      setSelected((s) => [...s, p.id]);
      setNewName("");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  const unpaired = selected.filter((id) => !teams.some((t) => t.players.includes(id)));
  /** Random mode: players not in a locked team can be paired by hand; the rest are re-randomized. */
  const unlockedPlayers = selected.filter((id) => !teams.some((t) => t.locked && t.players.includes(id)));
  const allLocked = teams.length > 0 && teams.every((t) => t.locked);
  function manualTap(id: string) {
    if (!pick) return setPick(id);
    if (pick === id) return setPick(null);
    const p: [string, string] = [pick, id];
    if (mode === "random") rebuild([...teams.filter((t) => t.locked), { name: teamName(p), players: p, locked: true }]);
    else setTeams((t) => [...t, { name: teamName(p), players: p, locked: true }]);
    setPick(null);
  }

  const canNext = [
    info.name.trim().length > 0 && !!info.date,
    selected.length >= 4 && selected.length % 2 === 0,
    teams.length * 2 === selected.length && teams.every((t) => t.name.trim()),
    fixtures.length > 0,
  ][step];

  function next() {
    if (step === 1) {
      setTeams([]);
      if (mode === "random") setTeams(buildTeams(selected).map((b) => ({ name: teamName(b.players), players: b.players, locked: false })));
    }
    if (step === 2) makeFixtures();
    setStep(step + 1);
  }

  async function create() {
    setBusy(true);
    try {
      const r = await api("/tournaments", {
        body: { ...info, location: info.location || undefined, format: info.format, teams: teams.map((t) => ({ name: t.name.trim(), players: t.players })), fixtures },
      });
      toast.success("Tournament is live!");
      qc.invalidateQueries();
      navigate({ to: "/tournaments/$id", params: { id: r.id } });
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <AppShell title="New tournament">
      <ol className="mb-6 flex gap-1">
        {STEPS.map((s, i) => (
          <li key={s} className={`flex-1 border-t-4 pt-2 text-xs font-semibold uppercase ${i <= step ? "border-primary text-foreground" : "border-muted text-muted-foreground"}`}>{s}</li>
        ))}
      </ol>

      <div className="rounded-2xl border bg-card p-5 md:p-8">
        {step === 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2"><Label>Tournament name</Label><Input value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} placeholder="Saturday Smash" /></div>
            <div className="space-y-2"><Label>Date</Label><Input type="date" value={info.date} onChange={(e) => setInfo({ ...info, date: e.target.value })} /></div>
            <div className="space-y-2"><Label>Location</Label><Input value={info.location} onChange={(e) => setInfo({ ...info, location: e.target.value })} placeholder="Court name" /></div>
            <div className="space-y-2">
              <Label>Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["KNOCKOUT", "LEAGUE"] as const).map((t) => (
                  <Button key={t} type="button" variant={info.type === t ? "default" : "outline"} onClick={() => setInfo({ ...info, type: t })}>{t === "KNOCKOUT" ? "Knockout" : "League"}</Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Match format</Label>
              <div className="grid grid-cols-2 gap-2">
                {([1, 3] as const).map((f) => (
                  <Button key={f} type="button" variant={info.format === f ? "default" : "outline"} onClick={() => setInfo({ ...info, format: f })}>Best of {f}</Button>
                ))}
              </div>
              {info.type === "LEAGUE" && <p className="text-xs text-muted-foreground">The League Final is always Best of 1.</p>}
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="mb-4 flex gap-2">
              <Input placeholder="Add a new player" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), quickAdd())} />
              <Button type="button" onClick={quickAdd}>Add</Button>
            </div>
            <p className={`mb-3 text-sm font-medium ${selected.length % 2 ? "text-destructive" : "text-muted-foreground"}`}>
              {selected.length} selected{selected.length % 2 ? " — doubles teams need an even number of players" : ""}{selected.length < 4 ? " — pick at least 4" : ""}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {players.map((p) => {
                const on = selected.includes(p.id);
                return (
                  <button key={p.id} type="button" onClick={() => setSelected((s) => (on ? s.filter((x) => x !== p.id) : [...s, p.id]))}
                    className={`flex items-center justify-between rounded-lg border px-3 py-3 text-left font-medium transition ${on ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary"}`}>
                    {p.name} {on && <Check className="h-4 w-4" />}
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex gap-2">
              <span className="self-center text-sm font-medium">Teams:</span>
              <Button type="button" size="sm" variant={mode === "random" ? "default" : "outline"} onClick={() => setMode("random")}>Random</Button>
              <Button type="button" size="sm" variant={mode === "manual" ? "default" : "outline"} onClick={() => setMode("manual")}>Manual</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            {mode === "random" ? (
              <div className="mb-4 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" variant="secondary" onClick={shuffleTeams} disabled={allLocked}><Shuffle className="h-4 w-4" /> {teams.some((t) => t.locked) ? "Randomize remaining" : "Shuffle teams"}</Button>
                  <span className="text-xs text-muted-foreground">{allLocked ? "All teams are locked." : "Locked teams stay as they are; only unlocked players are re-paired."}</span>
                </div>
                {unlockedPlayers.length > 2 && (
                  <div>
                    <p className="mb-2 text-sm text-muted-foreground">Or pick a pair yourself (tap two players); it is locked and the others are re-randomized.</p>
                    <div className="flex flex-wrap gap-2">
                      {unlockedPlayers.map((id) => (
                        <Button key={id} type="button" size="sm" variant={pick === id ? "default" : "outline"} onClick={() => manualTap(id)}>{names[id]}</Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              unpaired.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-sm text-muted-foreground">Tap two players to pair them.</p>
                  <div className="flex flex-wrap gap-2">
                    {unpaired.map((id) => (
                      <Button key={id} type="button" size="sm" variant={pick === id ? "default" : "outline"} onClick={() => manualTap(id)}>{names[id]}</Button>
                    ))}
                  </div>
                </div>
              )
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {teams.map((t, i) => (
                <div key={t.players.join()} className="rounded-xl border p-3">
                  <div className="flex gap-2">
                    <Input value={t.name} onChange={(e) => setTeams((ts) => ts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    {mode === "random" ? (
                      <Button type="button" size="icon" variant={t.locked ? "default" : "outline"} aria-label="Lock team" onClick={() => setTeams((ts) => ts.map((x, j) => (j === i ? { ...x, locked: !x.locked } : x)))}>
                        {t.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                      </Button>
                    ) : (
                      <Button type="button" size="icon" variant="outline" aria-label="Remove team" onClick={() => setTeams((ts) => ts.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{names[t.players[0]]} + {names[t.players[1]]}</p>
                  <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${t.locked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {t.locked ? "Locked · manual" : "Random"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <Button type="button" variant="secondary" className="mb-4" onClick={() => makeFixtures()}><Shuffle className="h-4 w-4" /> {info.type === "KNOCKOUT" ? "Reshuffle bracket" : "Reshuffle order"}</Button>
            <ol className="space-y-2">
              {fixtures.map(([a, b], i) => (
                <li key={i} className="flex items-center gap-3 rounded-lg border p-3">
                  <span className="font-display text-lg font-bold text-muted-foreground">{i + 1}</span>
                  <span className="font-medium">{teams[a]!.name}</span>
                  <span className="text-muted-foreground">vs</span>
                  <span className="font-medium">{b === null ? <em className="text-muted-foreground">BYE — advances</em> : teams[b]!.name}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-2 text-center">
            <p className="font-display text-4xl font-extrabold uppercase text-primary">Tournament ready</p>
            <p className="text-lg">{info.name}</p>
            <p className="text-muted-foreground">
              {info.type === "LEAGUE" ? "League" : "Knockout"} · {teams.length} teams · Best of {info.format} · {info.date}
            </p>
          </div>
        )}

        <div className="mt-8 flex justify-between">
          <Button type="button" variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
          {step < 4 ? (
            <Button type="button" disabled={!canNext} onClick={next}>Next</Button>
          ) : (
            <Button type="button" size="lg" disabled={busy} onClick={create}>Start tournament</Button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
