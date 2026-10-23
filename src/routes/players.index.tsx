import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { api, useAuth } from "@/lib/api";
import { AppShell, Empty } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/players/")({
  head: () => ({
    meta: [
      { title: "Players — Smash Court" },
      {
        name: "description",
        content: "All badminton players with wins, win rate and point difference.",
      },
      { property: "og:title", content: "Players — Smash Court" },
      {
        property: "og:description",
        content: "All badminton players with wins, win rate and point difference.",
      },
    ],
  }),
  component: Players,
});

function Players() {
  const { isOrganizer } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["players"],
    queryFn: () => api<any[]>("/players"),
  });
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/players", { body: { name } });
      setName("");
      toast.success("Player added");
      qc.invalidateQueries({ queryKey: ["players"] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }
  const list = (data ?? []).filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <AppShell title="Players">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search players"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {isOrganizer && (
          <form onSubmit={add} className="flex gap-2">
            <Input
              placeholder="New player name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Button type="submit">Add</Button>
          </form>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : list.length === 0 ? (
        <Empty title="No players yet">Add players to start building teams.</Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <Link
              key={p.id}
              to="/players/$id"
              params={{ id: p.id }}
              className="rounded-xl border bg-card p-4 transition hover:border-primary"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary font-display text-xl font-bold text-primary-foreground">
                  {p.name[0]}
                </div>
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.played} played · {p.titles} titles
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 text-center text-sm">
                <div>
                  <p className="font-display text-xl font-bold">{p.wins}</p>
                  <p className="text-xs text-muted-foreground">Wins</p>
                </div>
                <div>
                  <p className="font-display text-xl font-bold">{p.winPct}%</p>
                  <p className="text-xs text-muted-foreground">Win rate</p>
                </div>
                <div>
                  <p className="font-display text-xl font-bold">
                    {p.pd > 0 ? "+" : ""}
                    {p.pd}
                  </p>
                  <p className="text-xs text-muted-foreground">Pt diff</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
