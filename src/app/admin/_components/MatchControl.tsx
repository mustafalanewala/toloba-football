"use client";

import { useState } from "react";
import { halvesText } from "@/components/MatchCard";
import { GoalColumns, ScoreBoard } from "@/components/ScoreBoard";
import { LiveDot, TrophyIcon } from "@/components/icons";
import { clockMinute, formatMinute, other, parseMinute, score, undoLabel, type Minute } from "@/lib/scoring";
import type { Match, Player, Side } from "@/lib/types";
import { useNow } from "@/lib/useNow";
import {
  addGoal,
  changePenalty,
  deleteGoal,
  deleteMatch,
  endShootout,
  fullTime,
  halfTime,
  kickOff,
  resetMatch,
  startSecondHalf,
  undoPeriod,
} from "../actions";
import { Button, ErrorText, inputClass, useAdminAction } from "./ui";

type Props = {
  match: Match;
  teamA: string;
  teamB: string;
  /** Both teams' players. */
  players: Player[];
  /** Why this result can't change any more (a later stage was built from it), or null. */
  locked?: string | null;
};

export function MatchControl(props: Props) {
  if (props.match.status === "live") return <LiveControl {...props} />;
  return <IdleControl {...props} />;
}

const minuteInput = (m: Minute) => (m.extra ? `${m.minute}+${m.extra}` : String(m.minute));

function LiveControl({ match, teamA, teamB, players }: Props) {
  const { run, pending, error } = useAdminAction();
  const [goal, setGoal] = useState<{ side: Side; minute: string } | null>(null);
  const now = useNow();

  const name = (s: Side) => (s === "a" ? teamA : teamB);
  const teamId = (s: Side) => (s === "a" ? match.teamAId : match.teamBId);
  const playerName = (id: string | null) => players.find((p) => p.id === id)?.name ?? null;
  const s = score(match);
  const clock = now === null ? null : clockMinute(match, now);
  const halfOver = Boolean(clock?.extra);
  const inPlay = match.period !== "penalties";

  const openGoal = (side: Side) => {
    const m = now === null ? null : clockMinute(match, now);
    setGoal({ side, minute: m ? minuteInput(m) : match.period === "half_time" ? String(match.halfMinutes) : "" });
  };

  const next = {
    first: { label: "Half time", action: () => run(() => halfTime(match.id)) },
    half_time: { label: "Start 2nd half", action: () => run(() => startSecondHalf(match.id)) },
    second: {
      label: match.stage === "knockout" && s.a === s.b ? "Full time → penalties" : "Full time",
      action: () => {
        const result =
          s.a === s.b
            ? match.stage === "knockout"
              ? `It's ${s.a}–${s.b}, so the match goes to penalties.`
              : `The match ends in a ${s.a}–${s.b} draw.`
            : `${s.a > s.b ? teamA : teamB} win ${Math.max(s.a, s.b)}–${Math.min(s.a, s.b)}.`;
        if (confirm(`Blow the final whistle? ${result}`)) run(() => fullTime(match.id));
      },
    },
    penalties: {
      label: "End shoot-out",
      action: () => {
        const pens = match.pens ?? { a: 0, b: 0 };
        if (confirm(`End the shoot-out at ${pens.a}–${pens.b}?`)) run(() => endShootout(match.id));
      },
    },
  }[match.period ?? "first"];

  return (
    <article className="rounded-xl border border-line bg-white p-3 sm:p-5">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-1">
        <h3 className="font-display text-2xl font-semibold">{match.label || `${teamA} vs ${teamB}`}</h3>
        <p className="flex items-center gap-2 text-sm text-ink-soft">
          <LiveDot /> {halvesText(match)}
        </p>
      </header>

      <ScoreBoard size="md" match={match} teamA={teamA} teamB={teamB} playerName={playerName} />

      {inPlay ? (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {(["a", "b"] as const).map((side) => (
            <Button
              key={side}
              variant={goal?.side === side ? "success" : "primary"}
              aria-label={`Goal for ${name(side)}`}
              className="min-h-16 min-w-0 flex-col gap-0.5! py-2 leading-none"
              onClick={() => (goal?.side === side ? setGoal(null) : openGoal(side))}
            >
              <span className="font-display text-2xl font-semibold">+ Goal</span>
              <span className="w-full truncate px-1 text-xs leading-tight font-medium">{name(side)}</span>
            </Button>
          ))}
        </div>
      ) : (
        <Shootout match={match} name={name} pending={pending} onChange={(side, delta) => run(() => changePenalty(match.id, side, delta))} />
      )}

      {goal && inPlay && (
        <GoalForm
          key={`${goal.side}-${goal.minute}`}
          matchId={match.id}
          side={goal.side}
          initialMinute={goal.minute}
          teamName={name(goal.side)}
          ownPlayers={players.filter((p) => p.teamId === teamId(goal.side))}
          otherPlayers={players.filter((p) => p.teamId === teamId(other(goal.side)))}
          otherName={name(other(goal.side))}
          onClose={() => setGoal(null)}
        />
      )}

      <GoalList match={match} name={name} playerName={playerName} />

      {halfOver && (
        <p className="mt-3 text-center text-sm font-semibold text-ink">
          {formatMinute({ minute: match.halfMinutes * (match.period === "second" ? 2 : 1), extra: 0 })} played, now in
          stoppage time.
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button variant="primary" className={halfOver ? "animate-pulse" : ""} disabled={pending} onClick={next.action}>
          {next.label}
        </Button>
        <Button
          disabled={pending}
          onClick={() => {
            if (confirm(`${undoLabel(match)}?`)) run(() => undoPeriod(match.id));
          }}
        >
          {undoLabel(match)}
        </Button>
        <Button
          variant="danger"
          disabled={pending}
          onClick={() => {
            if (confirm("Reset this match? The clock and all goals will be cleared.")) run(() => resetMatch(match.id));
          }}
        >
          Reset
        </Button>
      </div>
      <ErrorText error={error} />
    </article>
  );
}

function Shootout({
  match,
  name,
  pending,
  onChange,
}: {
  match: Match;
  name: (s: Side) => string;
  pending: boolean;
  onChange: (side: Side, delta: 1 | -1) => void;
}) {
  const pens = match.pens ?? { a: 0, b: 0 };
  return (
    <div className="mt-3 rounded-lg bg-ball-soft p-3">
      <p className="mb-2 text-center text-sm font-semibold">Penalty shoot-out: tap + for each penalty scored</p>
      <div className="grid grid-cols-2 gap-3">
        {(["a", "b"] as const).map((side) => (
          <div key={side} className="flex gap-2">
            <Button
              aria-label={`Remove penalty from ${name(side)}`}
              className="min-h-14 w-12 shrink-0 text-2xl"
              disabled={pending || pens[side] === 0}
              onClick={() => onChange(side, -1)}
            >
              −
            </Button>
            <Button
              aria-label={`Penalty scored by ${name(side)}`}
              variant="primary"
              className="min-h-14 min-w-0 flex-1 flex-col gap-0.5! py-2 leading-none"
              disabled={pending}
              onClick={() => onChange(side, 1)}
            >
              <span className="font-display text-2xl font-semibold tabular-nums">{pens[side]}</span>
              <span className="w-full truncate px-1 text-xs leading-tight font-medium">{name(side)}</span>
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function GoalForm({
  matchId,
  side,
  initialMinute,
  teamName,
  ownPlayers,
  otherPlayers,
  otherName,
  onClose,
}: {
  matchId: string;
  side: Side;
  initialMinute: string;
  teamName: string;
  ownPlayers: Player[];
  otherPlayers: Player[];
  otherName: string;
  onClose: () => void;
}) {
  const { run, pending, error } = useAdminAction();
  const [ownGoal, setOwnGoal] = useState(false);
  // undefined = not picked yet, null = scorer unknown
  const [playerId, setPlayerId] = useState<string | null | undefined>(undefined);
  const [minute, setMinute] = useState(initialMinute);
  const list = ownGoal ? otherPlayers : ownPlayers;
  const valid = playerId !== undefined && parseMinute(minute) !== null;

  const pick = (id: string | null, label: string) => (
    <button
      key={id ?? "unknown"}
      type="button"
      onClick={() => setPlayerId(id)}
      className={`min-w-0 truncate rounded-lg border px-2.5 py-2 text-left text-sm font-semibold transition ${
        playerId === id ? "border-toloba bg-toloba text-white" : "border-line bg-white hover:border-ink-soft/50"
      }`}
    >
      {label}
    </button>
  );

  return (
    <form
      className="mt-3 rounded-lg border border-toloba/30 bg-toloba-soft/50 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) run(() => addGoal(matchId, { side, playerId: playerId ?? null, ownGoal, minute }), onClose);
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">Goal for {teamName}</p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={ownGoal}
            onChange={(e) => {
              setOwnGoal(e.target.checked);
              setPlayerId(undefined);
            }}
            className="size-4 accent-toloba"
          />
          Own goal by {otherName}
        </label>
      </div>

      <p className="mt-2 text-sm text-ink-soft">Scorer</p>
      <div className="mt-1 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {list.map((p) => pick(p.id, `${p.number !== null ? `${p.number} · ` : ""}${p.name}`))}
        {pick(null, "Unknown player")}
      </div>
      {list.length === 0 && (
        <p className="mt-1 text-sm text-ink-soft">
          No players for {ownGoal ? otherName : teamName} yet. Add them under Teams.
        </p>
      )}

      <div className="mt-3 flex items-end gap-2">
        <label className="flex flex-col gap-1 text-sm text-ink-soft">
          Minute
          <input
            className={`${inputClass} w-28 py-2`}
            value={minute}
            onChange={(e) => setMinute(e.target.value)}
            inputMode="numeric"
            placeholder="e.g. 45+2"
            aria-invalid={minute !== "" && !parseMinute(minute)}
          />
        </label>
        <Button type="submit" variant="primary" className="flex-1 py-2.5" disabled={!valid || pending}>
          Save goal
        </Button>
        <Button variant="ghost" className="py-2.5" onClick={onClose}>
          Cancel
        </Button>
      </div>
      <ErrorText error={error} />
    </form>
  );
}

function GoalList({
  match,
  name,
  playerName,
}: {
  match: Match;
  name: (s: Side) => string;
  playerName: (id: string | null) => string | null;
}) {
  const { run, pending, error } = useAdminAction();
  if (match.goals.length === 0) return null;
  return (
    <div className="mt-3">
      <ul className="divide-y divide-line rounded-lg border border-line">
        {match.goals.map((g) => {
          const who = playerName(g.playerId) ?? "Unknown player";
          return (
            <li key={g.id} className="flex items-center gap-3 px-3 py-1.5 text-sm">
              <span className="w-12 shrink-0 font-semibold tabular-nums">{formatMinute(g)}</span>
              <span className="min-w-0 flex-1 truncate">
                <span className="font-semibold">{who}</span>
                {g.ownGoal && " (own goal)"} <span className="text-ink-soft">· {name(g.side)}</span>
              </span>
              <button
                type="button"
                disabled={pending}
                className="shrink-0 font-semibold text-ink-soft hover:text-red-600 disabled:opacity-40"
                onClick={() => {
                  if (confirm(`Remove the ${formatMinute(g)} goal by ${who}?`)) run(() => deleteGoal(g.id));
                }}
              >
                Remove
              </button>
            </li>
          );
        })}
      </ul>
      <ErrorText error={error} />
    </div>
  );
}

function IdleControl({ match, teamA, teamB, players, locked }: Props) {
  const { run, pending, error } = useAdminAction();
  const done = match.status === "completed";
  const s = score(match);
  const playerName = (id: string | null) => players.find((p) => p.id === id)?.name ?? null;
  const winnerSide: Side | null =
    match.winnerId === match.teamAId ? "a" : match.winnerId === match.teamBId ? "b" : null;

  return (
    <article className="rounded-xl border border-line bg-white p-4">
      <header className="mb-2 flex items-baseline justify-between gap-2 text-sm text-ink-soft">
        <span className="truncate">{match.label || "Match"}</span>
        <span className="shrink-0">{done ? (match.pens ? "Full time · penalties" : "Full time") : halvesText(match)}</span>
      </header>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 font-semibold">
        <span className={`flex min-w-0 items-center justify-end gap-1 text-right ${winnerSide === "b" ? "text-ink-soft" : ""}`}>
          {winnerSide === "a" && <TrophyIcon className="size-4 shrink-0 text-ball-deep" />}
          <span className="truncate">{teamA}</span>
        </span>
        <span className="px-1.5 font-display text-xl font-semibold whitespace-nowrap tabular-nums text-ink-soft">
          {done ? `${s.a} - ${s.b}` : "vs"}
        </span>
        <span className={`flex min-w-0 items-center gap-1 ${winnerSide === "a" ? "text-ink-soft" : ""}`}>
          <span className="truncate">{teamB}</span>
          {winnerSide === "b" && <TrophyIcon className="size-4 shrink-0 text-ball-deep" />}
        </span>
      </div>
      {done && match.pens && (
        <p className="text-center text-xs font-semibold text-ink-soft tabular-nums">
          {match.pens.a}–{match.pens.b} on penalties
        </p>
      )}
      {done && <GoalColumns goals={match.goals} playerName={playerName} className="mt-1 text-sm text-ink-soft" />}

      {locked ? (
        <p className="mt-3 rounded-lg bg-background px-3 py-2 text-sm text-ink-soft">
          <span className="font-semibold text-ink">Result locked.</span> {locked}
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          {done ? (
            <>
              <Button
                disabled={pending}
                onClick={() => {
                  if (confirm("Reopen this match to correct the score?")) run(() => undoPeriod(match.id));
                }}
              >
                Reopen
              </Button>
              <Button
                disabled={pending}
                onClick={() => {
                  if (confirm("Reset this match back to upcoming? The clock and all goals will be cleared.")) {
                    run(() => resetMatch(match.id));
                  }
                }}
              >
                Reset
              </Button>
            </>
          ) : (
            <Button variant="primary" disabled={pending} onClick={() => run(() => kickOff(match.id))}>
              Kick-off
            </Button>
          )}
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => {
              if (confirm(`Delete ${teamA} vs ${teamB}?`)) run(() => deleteMatch(match.id));
            }}
          >
            Delete
          </Button>
        </div>
      )}
      <ErrorText error={error} />
    </article>
  );
}
