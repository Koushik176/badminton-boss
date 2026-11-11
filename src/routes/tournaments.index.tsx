import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trophy } from "lucide-react";
import { api, useAuth } from "@/lib/api";
import { AppShell, Empty, StatusBadge } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

type Tournament = {
  id: string;
  name: string;
  date: string;
  location: string;
  status: string;
  type: string;
  team_count: number;
  format: number;
  done: number;
  total: number;
  champion_name?: string | null;
};

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

/** How many previous (completed) tournaments each scroll reveals. */
const PAST_CHUNK = 6;

function TournamentCard({ t }: { t: Tournament }) {
  return (
    <Link
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
          {t.type === "LEAGUE" ? "League" : "Knockout"} · {t.team_count} teams · Best of {t.format}
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
  );
}

function Tournaments() {
  const { isOrganizer } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["tournaments"],
    queryFn: () => api<Tournament[]>("/tournaments"),
  });
  // Ongoing tournaments are always shown. Completed ones load as the user scrolls down; when there
  // is nothing ongoing, the first chunk is shown straight away so the page is not empty.
  const current = (data ?? []).filter((t) => t.status !== "COMPLETED");
  const past = (data ?? []).filter((t) => t.status === "COMPLETED");
  const { visible, hasMore, sentinelRef, loadMore } = useScrollReveal({
    total: past.length,
    base: current.length === 0 ? PAST_CHUNK : 0,
    chunk: PAST_CHUNK,
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
        <div className="space-y-8">
          {current.length > 0 && (
            <section aria-label="Ongoing tournaments">
              <h2 className="mb-3 font-display text-lg font-bold uppercase">Ongoing</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {current.map((t) => (
                  <TournamentCard key={t.id} t={t} />
                ))}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section aria-label="Previous tournaments">
              <h2 className="mb-3 font-display text-lg font-bold uppercase">
                Previous tournaments
              </h2>
              {visible > 0 && (
                <div className="grid gap-3 md:grid-cols-2">
                  {past.slice(0, visible).map((t) => (
                    <TournamentCard key={t.id} t={t} />
                  ))}
                </div>
              )}
              {hasMore && (
                <div ref={sentinelRef} className="flex flex-col items-center gap-2 py-6">
                  <p className="text-xs text-muted-foreground">
                    {visible === 0
                      ? `${past.length} previous tournaments. Scroll down to see them.`
                      : `Showing ${visible} of ${past.length}. Keep scrolling for more.`}
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={loadMore}>
                    {visible === 0 ? "Show previous tournaments" : "Load more"}
                  </Button>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </AppShell>
  );
}
