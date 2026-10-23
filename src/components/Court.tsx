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
        ? "ring-4 ring-inset ring-accent text-court-line"
        : "text-court-line/80";
  return (
    <div
      className={`flex flex-col items-center justify-center border border-court-line/60 p-2 text-center ${tone}`}
    >
      <span className="font-display text-lg font-bold leading-tight sm:text-2xl">
        {names[pid] ?? "?"}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">{role}</span>
      <span className="text-[10px] uppercase opacity-60">{half} court</span>
    </div>
  );
}

/** Each team's left/right is from its own perspective facing the net. */
export function Court({
  state,
  names,
  teamNames,
  orientation,
}: {
  state: MatchState;
  names: Names;
  teamNames: Record<TeamKey, string>;
  orientation: CourtOrientation;
}) {
  const top: TeamKey = state.sides.A === "top" ? "A" : "B";
  const bottom: TeamKey = top === "A" ? "B" : "A";
  if (orientation === "vertical") {
    return (
      <div className="mx-auto w-full max-w-md">
        <div className="grid h-72 grid-cols-2 sm:h-88">
          <div className="flex min-w-0 flex-col">
            <p className="mb-1 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {teamNames[bottom]}
            </p>
            <div className="grid min-h-0 flex-1 grid-rows-2 overflow-hidden rounded-l-lg border-4 border-r-2 border-court-line bg-court">
              <Box state={state} team={bottom} half="left" names={names} />
              <Box state={state} team={bottom} half="right" names={names} />
            </div>
          </div>
          <div className="flex min-w-0 flex-col">
            <p className="mb-1 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {teamNames[top]}
            </p>
            <div className="grid min-h-0 flex-1 grid-rows-2 overflow-hidden rounded-r-lg border-4 border-l-2 border-court-line bg-court">
              <Box state={state} team={top} half="right" names={names} />
              <Box state={state} team={top} half="left" names={names} />
            </div>
          </div>
        </div>
      </div>
    );
  }

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
}
