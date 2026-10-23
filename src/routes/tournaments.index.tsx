import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trophy } from "lucide-react";
import { api, useAuth } from "@/lib/api";
import { AppShell, Empty, StatusBadge } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/tournaments/")({
  head: () => ({
    meta: [
      { title: "Tournaments — Smash Court" },
      { name: "description", content: "All badminton doubles tournaments, live and completed." },
      { property: "og:title", content: "Tournaments — Smash Court" },
      {
        property: "og:description",
        content: "All badminton doubles tournaments, live and completed.",
      },
    ],
  }),
  component: Tournaments,
});

function Tournaments() {
  const { isOrganizer } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["tournaments"],
    queryFn: () => api<any[]>("/tournaments"),
  });
  return (
    <AppShell
      title="Tournaments"
      actions={
        isOrganizer && (
          <Button asChild size="sm">
            <Link to="/tournaments/new">
              <Plus className="h-4 w-4" /> New
            </Link>
          </Button>
        )
      }
    >
      {isLoading ? (
        <Skeleton className="h-48" />
      ) : !data?.length ? (
        <Empty title="No tournaments yet">Create your first tournament.</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((t) => (
            <Link
              key={t.id}
              to="/tournaments/$id"
              params={{ id: t.id }}
              className="rounded-xl border bg-card p-5 transition hover:border-primary"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-xl font-bold">{t.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {t.date} · {t.location}
                  </p>
                </div>
                <StatusBadge status={t.status} />
              </div>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span>
                  {t.type === "LEAGUE" ? "League" : "Knockout"} · {t.team_count} teams · Best of{" "}
                  {t.format}
                </span>
                <span className="text-muted-foreground">
                  {t.done}/{t.total} played
                </span>
              </div>
              {t.champion_name && (
                <p className="mt-3 flex items-center gap-2 font-semibold text-primary">
                  <Trophy className="h-4 w-4" /> {t.champion_name}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
