import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/stats")({
  head: () => ({
    meta: [
      { title: "Leaderboard — Smash Court" },
      { name: "description", content: "Badminton leaderboards: wins, win rate, point difference and titles." },
      { property: "og:title", content: "Leaderboard — Smash Court" },
      { property: "og:description", content: "Badminton leaderboards: wins, win rate, point difference and titles." },
    ],
  }),
  component: Stats,
});

const since = (p: string) => {
  const d = new Date();
  if (p === "year") return `${d.getFullYear()}-01-01`;
  if (p === "month") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  return "";
};

function Stats() {
  const [period, setPeriod] = useState("all");
  const [sort, setSort] = useState<"wins" | "winPct" | "pd" | "titles">("wins");
  const { data = [] } = useQuery({
    queryKey: ["stats", period],
    queryFn: () => api<any[]>(`/stats${since(period) ? `?since=${since(period)}` : ""}`),
  });
  const rows = data.filter((r) => r.played > 0).sort((a, b) => b[sort] - a[sort] || b.pd - a.pd);
  return (
    <AppShell title="Leaderboard">
      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All time</SelectItem>
            <SelectItem value="year">This year</SelectItem>
            <SelectItem value="month">This month</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="wins">Most wins</SelectItem>
            <SelectItem value="winPct">Best win %</SelectItem>
            <SelectItem value="pd">Point difference</SelectItem>
            <SelectItem value="titles">Titles</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="mb-6 h-56 rounded-xl border bg-card p-3">
        <ResponsiveContainer>
          <BarChart data={rows.slice(0, 10)}>
            <XAxis dataKey="name" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip />
            <Bar dataKey={sort} fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>{["#", "Player", "MP", "W", "L", "Win %", "PD", "Titles"].map((h) => <th key={h} className="p-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-t">
                <td className="p-3 font-display font-bold">{i + 1}</td>
                <td className="p-3"><Link to="/players/$id" params={{ id: r.id }} className="font-medium hover:underline">{r.name}</Link></td>
                <td className="p-3">{r.played}</td><td className="p-3">{r.wins}</td><td className="p-3">{r.losses}</td>
                <td className="p-3">{r.winPct}%</td><td className="p-3">{r.pd > 0 ? "+" : ""}{r.pd}</td><td className="p-3">{r.titles}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
