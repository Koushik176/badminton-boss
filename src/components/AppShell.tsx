import { Link, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Users, Trophy, BarChart3, LogIn, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { setSession, useAuth } from "@/lib/api";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tournaments", label: "Tournaments", icon: Trophy },
  { to: "/players", label: "Players", icon: Users },
  { to: "/stats", label: "Stats", icon: BarChart3 },
] as const;

export function Shuttle({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="25" r="5" fill="currentColor" />
      <path d="M11 22 6 4h20l-5 18Z" fill="currentColor" opacity=".45" />
      <path d="M11 22 16 4l5 18" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

export function AppShell({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  const { isOrganizer, email } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background md:flex">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-sidebar p-4 text-sidebar-foreground md:flex">
        <Link to="/" className="mb-8 flex items-center gap-2 px-2">
          <Shuttle className="h-8 w-8 text-sidebar-primary" />
          <span className="font-display text-2xl font-extrabold uppercase tracking-wide">Smash Court</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium text-sidebar-foreground/80 transition hover:bg-sidebar-accent hover:text-sidebar-foreground data-[status=active]:bg-sidebar-primary data-[status=active]:text-sidebar-primary-foreground"
            >
              <n.icon className="h-5 w-5" /> {n.label}
            </Link>
          ))}
        </nav>
        {isOrganizer ? (
          <div className="space-y-2 border-t border-sidebar-border pt-4 text-sm">
            <p className="truncate px-2 text-sidebar-foreground/70">{email}</p>
            <button
              onClick={() => {
                setSession(null);
                navigate({ to: "/" });
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-sidebar-accent"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        ) : (
          <Link to="/login" className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-sidebar-accent">
            <LogIn className="h-4 w-4" /> Organizer sign in
          </Link>
        )}
      </aside>
      <div className="min-w-0 flex-1 pb-24 md:pb-0">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur md:px-8">
          <div className="flex items-center gap-2">
            <Shuttle className="h-7 w-7 text-primary md:hidden" />
            <h1 className="font-display text-2xl font-bold uppercase tracking-wide md:text-3xl">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            {actions}
            {!isOrganizer && (
              <Button asChild variant="outline" size="sm" className="md:hidden">
                <Link to="/login">Sign in</Link>
              </Button>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-6xl p-4 md:p-8">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-sidebar text-sidebar-foreground md:hidden">
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            activeOptions={{ exact: n.to === "/" }}
            className="flex flex-col items-center gap-1 py-2.5 text-xs text-sidebar-foreground/70 data-[status=active]:text-sidebar-primary"
          >
            <n.icon className="h-5 w-5" />
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed p-10 text-center">
      <Shuttle className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
      <p className="font-semibold">{title}</p>
      <div className="mt-2 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    LIVE: "bg-destructive text-destructive-foreground animate-pulse",
    COMPLETED: "bg-primary text-primary-foreground",
    UPCOMING: "bg-secondary text-secondary-foreground",
    SKIPPED: "bg-muted text-muted-foreground line-through",
    BYE: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${map[status] ?? "bg-muted"}`}>
      {status}
    </span>
  );
}
