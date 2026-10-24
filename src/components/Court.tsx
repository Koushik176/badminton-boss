import { Crosshair } from "lucide-react";
import { roleOf, type MatchState, type TeamKey } from "@/lib/engine/scoring";

type Names = Record<string, string>;
export type CourtOrientation = "horizontal" | "vertical";

function Box({
  state,
  team,
  half,
  names,
}: {
  state: MatchState;
  team: TeamKey;
  half: "left" | "right";
  names: Names;
}) {
  const pid = state.teams[team].find((id) => state.courts[id] === half);
  if (!pid) return <div className="border border-court-line/60" />;
  const role = roleOf(state, pid);
  const tone =
    role === "SERVER"
      ? "bg-accent text-accent-foreground"
      : role === "RECEIVER"
        ? "bg-accent-foreground text-accent"
        : "text-court-line/80";
  return (
    <div
      className={`flex flex-col items-center justify-center border border-court-line/60 p-2 text-center ${tone}`}
    >
      <span className="font-display text-lg font-bold leading-tight sm:text-2xl">
        {names[pid] ?? "?"}
      </span>
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest opacity-80">
        {role === "RECEIVER" && <Crosshair className="h-3 w-3" aria-hidden="true" />}
        {role}
      </span>
      <span className="text-[10px] uppercase opacity-60">{half} court</span>
    </div>
  );
}

/**
 * Each team's left/right is from its own perspective facing the net.
 * Horizontal (default): the top-side team is drawn on the left of the screen, the bottom-side team
 * on the right. Vertical is the same court turned 90 degrees. Orientation is presentation only;
 * it never reads or changes anything but `state`.
 */
export function Court({
  state,
  names,
  teamNames,
  orientation = "horizontal",
}: {
  state: MatchState;
  names: Names;
  teamNames: Record<TeamKey, string>;
  orientation?: CourtOrientation;
}) {
  const top: TeamKey = state.sides.A === "top" ? "A" : "B";
  const bottom: TeamKey = top === "A" ? "B" : "A";
  if (orientation === "vertical")
    return (
      <div className="mx-auto w-full max-w-md">
        <p className="mb-1 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {teamNames[top]}
        </p>
        <div className="overflow-hidden rounded-lg border-4 border-court-line bg-court">
          <div className="grid h-36 grid-cols-2 sm:h-44">
            <Box state={state} team={top} half="right" names={names} />
            <Box state={state} team={top} half="left" names={names} />
          </div>
          <div className="h-1.5 bg-court-line" />
          <div className="grid h-36 grid-cols-2 sm:h-44">
            <Box state={state} team={bottom} half="left" names={names} />
            <Box state={state} team={bottom} half="right" names={names} />
          </div>
        </div>
        <p className="mt-1 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {teamNames[bottom]}
        </p>
      </div>
    );
  // Left team faces east: its "left" court is the upper box. Right team faces west: its "left" court is the lower box.
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-1 grid grid-cols-2 gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <p className="truncate text-left">{teamNames[top]}</p>
        <p className="truncate text-right">{teamNames[bottom]}</p>
      </div>
      <div className="grid grid-cols-[1fr_6px_1fr] overflow-hidden rounded-lg border-4 border-court-line bg-court">
        <div className="grid h-64 grid-rows-2 sm:h-72">
          <Box state={state} team={top} half="left" names={names} />
          <Box state={state} team={top} half="right" names={names} />
        </div>
        <div className="bg-court-line" />
        <div className="grid h-64 grid-rows-2 sm:h-72">
          <Box state={state} team={bottom} half="right" names={names} />
          <Box state={state} team={bottom} half="left" names={names} />
        </div>
      </div>
    </div>
  );
}
