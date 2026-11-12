import { score } from "@/lib/scoring";
import type { Match, Side } from "@/lib/types";
import { GoalColumns, MatchStatus, ScoreBoard, type PlayerName } from "./ScoreBoard";
import { TrophyIcon } from "./icons";

type Props = { match: Match; teamA: string; teamB: string; playerName: PlayerName };

export const halvesText = (match: Pick<Match, "halfMinutes">) => `2 × ${match.halfMinutes} min`;

/** The match in progress: the full scoreboard with the clock and scorers. */
export function LiveMatchCard({ match, teamA, teamB, playerName }: Props) {
  return (
    <article>
      <ScoreBoard
        match={match}
        teamA={teamA}
        teamB={teamB}
        playerName={playerName}
        label={match.label || "Match"}
        meta={halvesText(match)}
      />
    </article>
  );
}

/** A finished match: the score between the two names, scorers underneath. */
export function ResultRow({ match, teamA, teamB, playerName }: Props) {
  const s = score(match);
  const winner: Side | null = match.winnerId === match.teamAId ? "a" : match.winnerId === match.teamBId ? "b" : null;
  const name = (side: Side) => (
    <span
      className={`flex min-w-0 items-center gap-1.5 ${side === "a" ? "justify-end text-right" : ""} ${
        winner && winner !== side ? "text-ink-soft" : "text-ink"
      }`}
    >
      {side === "b" && winner === "b" && <TrophyIcon className="size-4 shrink-0 text-ball-deep" />}
      <span className="truncate font-semibold">{side === "a" ? teamA : teamB}</span>
      {side === "a" && winner === "a" && <TrophyIcon className="size-4 shrink-0 text-ball-deep" />}
    </span>
  );

  return (
    <li className="px-4 py-3.5 sm:px-5">
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm text-ink-soft">
        <span className="truncate">{match.label || "Match"}</span>
        <MatchStatus match={match} className="shrink-0" />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        {name("a")}
        <span className="font-display text-2xl leading-tight font-semibold tabular-nums whitespace-nowrap">
          {s.a} - {s.b}
        </span>
        {name("b")}
      </div>
      {match.pens && (
        <p className="text-center text-xs font-semibold text-ink-soft tabular-nums">
          {match.pens.a}–{match.pens.b} on penalties
        </p>
      )}
      <GoalColumns goals={match.goals} playerName={playerName} className="mt-1 text-sm text-ink-soft" />
    </li>
  );
}

export function UpcomingRow({ match, teamA, teamB }: Omit<Props, "playerName">) {
  return (
    <li className="px-4 py-3.5 sm:px-5">
      <div className="flex items-baseline justify-between gap-3 text-sm text-ink-soft">
        <span className="truncate">{match.label || "Match"}</span>
        <span className="shrink-0">{halvesText(match)}</span>
      </div>
      <p className="mt-1 font-semibold text-ink">
        {teamA} <span className="px-1 font-normal text-ink-soft">vs</span> {teamB}
      </p>
    </li>
  );
}
