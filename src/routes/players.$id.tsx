import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppShell, Empty } from "@/components/AppShell";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/players/$id")({
  head: () => ({
    meta: [
      { title: "Player profile — Smash Court" },
      { name: "description", content: "Badminton player stats, partners and match history." },
      { property: "og:title", content: "Player profile — Smash Court" },
      { property: "og:description", content: "Badminton player stats, partners and match history." },
    ],
  }),
  component: Player,
});

function Player() {
  const { id } = Route.useParams();
  const { data, isLoading, error } = useQuery({ queryKey: ["player", id], queryFn: () => api(`/players/${id}`) });
  if (error) return <AppShell title="Player"><p className="text-destructive">{(error as Error).message}</p></AppShell>;
  if (isLoading || !data) return <AppShell title="Player"><Skeleton className="h-64" /></AppShell>;
  const s = data.stats;
  return (
    <AppShell title={data.player.name}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {[
          ["Played", s.played], ["Wins", s.wins], ["Losses", s.losses], ["Win %", `${s.winPct}%`],
          ["Pt diff", (s.pd > 0 ? "+" : "") + s.pd], ["Titles", s.titles],
        ].map(([l, v]) => (
          <div key={l} className="rounded-xl border bg-card p-3 text-center">
            <p className="font-display text-3xl font-extrabold">{v}</p>
            <p className="text-xs uppercase text-muted-foreground">{l}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_2fr]">
        <section>
          <h2 className="mb-3 font-display text-xl font-bold uppercase">Partners</h2>
          {data.partners.length === 0 ? <Empty title="No partners yet" /> : (
            <ul className="divide-y rounded-xl border bg-card">
              {data.partners.map((p: any) => (
                <li key={p.id} className="flex justify-between p-3">
                  <span>{p.name}</span>
                  <span className="text-sm text-muted-foreground">{p.wins}/{p.played} won</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2 className="mb-3 font-display text-xl font-bold uppercase">Match history</h2>
          {data.history.length === 0 ? <Empty title="No matches played" /> : (
            <ul className="divide-y rounded-xl border bg-card">
              {data.history.map((m: any) => (
                <li key={m.id}>
                  <Link to="/matches/$id" params={{ id: m.id }} className="flex items-center gap-3 p-3 hover:bg-muted">
                    <span className={`w-6 font-display text-lg font-bold ${m.won ? "text-success" : "text-destructive"}`}>{m.won ? "W" : "L"}</span>
                    <div className="flex-1">
                      <p className="font-medium">vs {m.opponent}</p>
                      <p className="text-xs text-muted-foreground">{m.tournament} · {m.round} · {m.date}</p>
                    </div>
                    <span className="font-display tabular-nums">
                      {m.games.map((g: any) => (m.side === "A" ? `${g.A}-${g.B}` : `${g.B}-${g.A}`)).join(", ")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
