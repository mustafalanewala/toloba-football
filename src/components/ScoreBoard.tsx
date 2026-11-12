"use client";

import { formatMinute, score, statusText } from "@/lib/scoring";
import type { Goal, Match, Side } from "@/lib/types";
import { useNow } from "@/lib/useNow";
import { FootballIcon, LiveDot } from "./icons";
import { PitchLines } from "./Pitch";

export type PlayerName = (id: string | null) => string | null;

type Props = {
  match: Match;
  teamA: string;
  teamB: string;
  playerName: PlayerName;
  size?: "lg" | "md";
  /** Shown as chips in the top corners, e.g. "Group B" and "2 × 15 min". */
  label?: string;
  meta?: string;
};

const chip = "rounded-full bg-ink/60 px-2.5 py-0.5 text-[13px] font-semibold text-white";

/** The match on a pitch: a team on each half, a broadcast score box on the centre circle, scorers below. */
export function ScoreBoard({ match, teamA, teamB, playerName, size = "lg", label, meta }: Props) {
  const s = score(match);
  const lg = size === "lg";
  const live = match.status === "live";
  return (
    <div
      className={`pitch relative overflow-hidden rounded-xl text-white shadow-[inset_0_0_80px_rgb(0_0_0/0.25)] ${
        lg ? "px-5 py-6 sm:px-12 sm:py-10" : "px-4 py-5 sm:px-8"
      }`}
    >
      <PitchLines className="border-white/45" />

      {(label || meta) && (
        <div className="relative mb-4 flex items-center justify-between gap-2 sm:mb-2">
          {label && <span className={`${chip} truncate`}>{label}</span>}
          {meta && <span className={`${chip} ml-auto shrink-0`}>{meta}</span>}
        </div>
      )}

      <div className="relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-6">
        <TeamSide name={teamA} lg={lg} />
        <div className="flex flex-col items-center text-center">
          <div className="flex items-stretch overflow-hidden rounded-xl bg-ink shadow-xl ring-1 ring-white/15">
            {(["a", "b"] as const).map((side, i) => (
              <span
                key={side}
                className={`${lg ? "score-xl px-3 py-1.5 sm:px-6 sm:py-2" : "score-lg px-3 py-1"} min-w-[1.4em] text-center ${
                  i === 1 ? "border-l border-white/15" : ""
                }`}
              >
                <span key={s[side]} className="score-pop">
                  {s[side]}
                </span>
              </span>
            ))}
          </div>
          {match.pens && (
            <p className="mt-2 rounded-md bg-ball px-2 py-0.5 text-xs font-bold text-ink tabular-nums sm:text-sm">
              {match.pens.a}–{match.pens.b} on penalties
            </p>
          )}
          <div
            className={`mt-3 flex items-center gap-2 rounded-full bg-white px-3 py-1 font-semibold text-ink shadow ${
              lg ? "text-sm sm:text-lg" : "text-sm"
            }`}
          >
            {live && <LiveDot />}
            <MatchStatus match={match} className="whitespace-nowrap" />
          </div>
        </div>
        <TeamSide name={teamB} lg={lg} />
      </div>

      {match.goals.length > 0 && (
        <div className={`relative rounded-lg bg-ink/45 px-3 py-2 backdrop-blur-[2px] ${lg ? "mt-6 sm:mt-8" : "mt-4"}`}>
          <GoalColumns goals={match.goals} playerName={playerName} className={`text-white/90 ${lg ? "text-sm sm:text-base" : "text-xs sm:text-sm"}`} />
        </div>
      )}
    </div>
  );
}

function TeamSide({ name, lg }: { name: string; lg: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center sm:gap-3">
      <Crest name={name} className={`shadow-lg ${lg ? "size-14 text-xl sm:size-20 sm:text-3xl" : "size-12 text-lg"}`} />
      <h3
        className={`line-clamp-2 text-balance break-words font-display font-semibold leading-tight drop-shadow-[0_1px_2px_rgb(0_0_0/0.45)] ${
          lg ? "text-lg sm:text-3xl" : "text-base sm:text-xl"
        }`}
      >
        {name}
      </h3>
    </div>
  );
}

const CREST_COLORS = [
  "bg-rose-600",
  "bg-sky-600",
  "bg-amber-500",
  "bg-emerald-600",
  "bg-violet-600",
  "bg-orange-500",
  "bg-teal-600",
  "bg-fuchsia-600",
];

/** A round badge with the team's initials, coloured consistently from its name. */
export function Crest({ name, className = "size-8 text-xs" }: { name: string; className?: string }) {
  const hash = [...name].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold text-white ring-2 ring-white/80 ${
        CREST_COLORS[hash % CREST_COLORS.length]
      } ${className}`}
    >
      {initials}
    </span>
  );
}

export function MatchStatus({ match, className = "" }: { match: Match; className?: string }) {
  const now = useNow();
  return <p className={className}>{statusText(match, now)}</p>;
}

/** "Kolo Muani 37', 60'": one line per scorer, in the order they first scored. */
export function scorerLines(goals: Goal[], side: Side, playerName: PlayerName) {
  const lines = new Map<string, { name: string; minutes: string[] }>();
  for (const g of goals) {
    if (g.side !== side) continue;
    const key = `${g.playerId ?? "-"}:${g.ownGoal}`;
    const name = playerName(g.playerId) ?? (g.ownGoal ? "Own goal" : "Goal");
    const line = lines.get(key) ?? { name, minutes: [] };
    line.minutes.push(formatMinute(g) + (g.ownGoal && g.playerId ? " (OG)" : ""));
    lines.set(key, line);
  }
  return [...lines.values()].map((l) => `${l.name} ${l.minutes.join(", ")}`);
}

export function GoalColumns({
  goals,
  playerName,
  className = "",
}: {
  goals: Goal[];
  playerName: PlayerName;
  className?: string;
}) {
  if (goals.length === 0) return null;
  return (
    <div className={`grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-x-3 sm:gap-x-5 ${className}`}>
      <ul className="text-right">
        {scorerLines(goals, "a", playerName).map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <FootballIcon className="mt-0.5 size-[1.15em] opacity-80" />
      <ul className="text-left">
        {scorerLines(goals, "b", playerName).map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  );
}
