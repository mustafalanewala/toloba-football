// Pure football helpers (score, match clock, period changes), shared by server actions and client UI.
import type { Goal, Match, Score, Side } from "./types";

export const other = (side: Side): Side => (side === "a" ? "b" : "a");

export function score(match: Pick<Match, "goals">): Score {
  return match.goals.reduce((s, g) => ({ ...s, [g.side]: s[g.side] + 1 }), { a: 0, b: 0 });
}

/** The winning side: goals first, then the shoot-out. Null for a draw. */
export function winningSide(match: Pick<Match, "goals" | "pens">): Side | null {
  const s = score(match);
  if (s.a !== s.b) return s.a > s.b ? "a" : "b";
  if (match.pens && match.pens.a !== match.pens.b) return match.pens.a > match.pens.b ? "a" : "b";
  return null;
}

export const sortGoals = (goals: Goal[]) =>
  [...goals].sort((x, y) => x.minute - y.minute || x.extra - y.extra || (x.createdAt < y.createdAt ? -1 : 1));

// ---- Match clock ----

export type Minute = { minute: number; extra: number };

/** The minute being played, e.g. {45, 2} for 45+2'. Null when the clock isn't running. */
export function clockMinute(
  match: Pick<Match, "status" | "period" | "halfMinutes" | "firstHalfAt" | "secondHalfAt">,
  now: number,
): Minute | null {
  if (match.status !== "live") return null;
  const half = match.halfMinutes;
  const [start, offset] =
    match.period === "first" ? [match.firstHalfAt, 0] : match.period === "second" ? [match.secondHalfAt, half] : [null, 0];
  if (!start) return null;
  const played = Math.max(0, Math.floor((now - Date.parse(start)) / 60_000)) + 1;
  const end = offset + half;
  const minute = offset + played;
  return minute > end ? { minute: end, extra: minute - end } : { minute, extra: 0 };
}

export const formatMinute = ({ minute, extra }: Minute) => (extra ? `${minute}+${extra}'` : `${minute}'`);

/** Reads "37" or "45+2" (an optional trailing ' is ignored). */
export function parseMinute(text: string): Minute | null {
  const m = /^\s*(\d{1,3})\s*(?:\+\s*(\d{1,2}))?\s*'?\s*$/.exec(text);
  if (!m) return null;
  const minute = Number(m[1]);
  const extra = Number(m[2] ?? 0);
  if (minute > 200 || extra > 30) return null;
  return { minute, extra };
}

/** Short status line: "37'", "Half time", "Penalties", "Full time". */
export function statusText(match: Match, now: number | null) {
  if (match.status === "upcoming") return "Not started";
  if (match.status === "completed") return match.pens ? "Full time · after penalties" : "Full time";
  if (match.period === "half_time") return "Half time";
  if (match.period === "penalties") return "Penalties";
  const clock = now === null ? null : clockMinute(match, now);
  const half = match.period === "first" ? "1st half" : "2nd half";
  return clock ? `${half} · ${formatMinute(clock)}` : half;
}

// ---- Period changes (return a new match; throw on invalid moves) ----

type Playable = Pick<
  Match,
  "status" | "period" | "firstHalfAt" | "secondHalfAt" | "pens" | "winnerId" | "teamAId" | "teamBId" | "stage" | "goals"
>;

export function applyKickOff<M extends Playable>(match: M, now: string): M {
  if (match.status !== "upcoming") throw new Error("This match has already kicked off.");
  return { ...match, status: "live", period: "first", firstHalfAt: now, secondHalfAt: null, pens: null, winnerId: null };
}

export function applyHalfTime<M extends Playable>(match: M): M {
  if (match.status !== "live" || match.period !== "first") throw new Error("The first half isn't being played.");
  return { ...match, period: "half_time" };
}

export function applySecondHalf<M extends Playable>(match: M, now: string): M {
  if (match.status !== "live" || match.period !== "half_time") throw new Error("It isn't half time.");
  return { ...match, period: "second", secondHalfAt: now };
}

/** Ends the match. A knockout match that's level goes to penalties instead. */
export function applyFullTime<M extends Playable>(match: M): M {
  if (match.status !== "live" || match.period !== "second") throw new Error("The second half isn't being played.");
  const side = winningSide({ goals: match.goals, pens: null });
  if (!side && match.stage === "knockout") return { ...match, period: "penalties", pens: { a: 0, b: 0 } };
  return { ...match, status: "completed", period: null, pens: null, winnerId: winnerId(match, side) };
}

export function applyPenalty<M extends Playable>(match: M, side: Side, delta: 1 | -1): M {
  if (match.status !== "live" || match.period !== "penalties" || !match.pens) throw new Error("There's no shoot-out.");
  return { ...match, pens: { ...match.pens, [side]: Math.max(0, match.pens[side] + delta) } };
}

export function applyEndShootout<M extends Playable>(match: M): M {
  if (match.status !== "live" || match.period !== "penalties" || !match.pens) throw new Error("There's no shoot-out.");
  if (match.pens.a === match.pens.b) throw new Error("The shoot-out is level. Keep going until one team leads.");
  return { ...match, status: "completed", period: null, winnerId: winnerId(match, winningSide(match)) };
}

/** Step back one period, e.g. after tapping Half time by mistake. On a completed match this reopens it. */
export function applyUndoPeriod<M extends Playable>(match: M): M {
  if (match.status === "completed") {
    return { ...match, status: "live", period: match.pens ? "penalties" : "second", winnerId: null };
  }
  if (match.status !== "live") throw new Error("This match hasn't kicked off.");
  switch (match.period) {
    case "penalties":
      return { ...match, period: "second", pens: null };
    case "second":
      return { ...match, period: "half_time", secondHalfAt: null };
    case "half_time":
      return { ...match, period: "first" };
    default:
      if (match.goals.length) throw new Error("This match already has goals. Remove them first, or use Reset.");
      return { ...match, status: "upcoming", period: null, firstHalfAt: null };
  }
}

/** Label for the Undo button in each period. */
export function undoLabel(match: Pick<Match, "status" | "period">) {
  if (match.status === "completed") return "Reopen";
  return {
    first: "Undo kick-off",
    half_time: "Back to 1st half",
    second: "Back to half time",
    penalties: "Back to 2nd half",
  }[match.period ?? "first"];
}

function winnerId(match: Pick<Match, "teamAId" | "teamBId">, side: Side | null) {
  return side === "a" ? match.teamAId : side === "b" ? match.teamBId : null;
}
