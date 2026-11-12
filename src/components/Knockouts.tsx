import { score } from "@/lib/scoring";
import type { GroupSemi, Qualification } from "@/lib/standings";
import { FINAL_LABEL, semiLabel, type Match } from "@/lib/types";
import { LiveDot, TrophyIcon } from "./icons";

type Props = { qualification: Qualification; teamName: (id: string) => string };

/** Each group's semi-final on the left, the Final on the right. Line-ups show "so far" until created. */
export function Knockouts({ qualification, teamName }: Props) {
  const { semis, final } = qualification;
  const champion = final?.status === "completed" && final.winnerId ? teamName(final.winnerId) : null;
  const semiWinner = (s: GroupSemi) =>
    s.match?.status === "completed" && s.match.winnerId ? teamName(s.match.winnerId) : `Winner of ${semiLabel(s.group.name)}`;

  return (
    <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-2">
      <div className="flex flex-col gap-4">
        {semis.map((s) =>
          s.match ? (
            <MatchBox key={s.group.id} title={semiLabel(s.group.name)} match={s.match} teamName={teamName} />
          ) : (
            <Placeholder key={s.group.id} title={semiLabel(s.group.name)} lines={semiLineup(s)} />
          ),
        )}
      </div>
      <div className="flex flex-col gap-4">
        {final ? (
          <MatchBox title={FINAL_LABEL} match={final} teamName={teamName} highlight />
        ) : (
          <Placeholder title={FINAL_LABEL} lines={semis.map(semiWinner)} highlight />
        )}
        {champion && (
          <div className="flex items-center justify-center gap-3 rounded-xl bg-ball px-4 py-4 text-ink">
            <TrophyIcon className="size-7" />
            <div>
              <p className="text-sm font-semibold tracking-wide uppercase">Champion</p>
              <p className="font-display text-3xl leading-tight font-semibold">{champion}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function semiLineup({ group, table }: GroupSemi) {
  return ["1st", "2nd"].map((place, i) => {
    const row = table.played > 0 ? table.rows[i] : undefined;
    if (!row) return `${group.name} ${place}`;
    return `${row.team.name}${table.complete && !row.tie ? "" : " (so far)"}`;
  });
}

function Placeholder({ title, lines, highlight }: { title: string; lines: string[]; highlight?: boolean }) {
  return (
    <article className={`rounded-xl border border-dashed ${highlight ? "border-ball-deep" : "border-line"} bg-white/60 p-4`}>
      <h3 className="font-display text-xl font-semibold text-ink-soft">{title}</h3>
      <p className="mt-1 text-ink-soft">
        {lines[0]} <span className="px-1 text-sm">vs</span> {lines[1]}
      </p>
    </article>
  );
}

function MatchBox({
  title,
  match,
  teamName,
  highlight,
}: {
  title: string;
  match: Match;
  teamName: (id: string) => string;
  highlight?: boolean;
}) {
  const s = score(match);
  const done = match.status === "completed";
  const sides = [
    { side: "a" as const, id: match.teamAId },
    { side: "b" as const, id: match.teamBId },
  ];

  return (
    <article className={`rounded-xl border-2 ${highlight ? "border-ball-deep" : "border-line"} bg-white p-4`}>
      <header className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-display text-xl font-semibold">{title}</h3>
        <span className="flex items-center gap-2 text-sm text-ink-soft">
          {match.status === "live" && <LiveDot />}
          {match.status === "live" ? "Live" : done ? "Full time" : "Not started"}
        </span>
      </header>
      <ul className="divide-y divide-line">
        {sides.map(({ side, id }) => {
          const isWinner = done && match.winnerId === id;
          const isLoser = done && match.winnerId && match.winnerId !== id;
          return (
            <li key={side} className="flex items-center gap-3 py-2">
              <span className={`flex min-w-0 flex-1 items-center gap-1.5 font-semibold ${isLoser ? "text-ink-soft" : ""}`}>
                <span className="truncate">{teamName(id)}</span>
                {isWinner && <TrophyIcon className="size-4 shrink-0 text-ball-deep" />}
              </span>
              {match.status !== "upcoming" && (
                <span className="flex items-baseline gap-1.5 tabular-nums">
                  {match.pens && <span className="text-sm text-ink-soft">({match.pens[side]})</span>}
                  <span className={`w-6 text-center font-display text-2xl font-semibold ${isLoser ? "text-ink-soft" : ""}`}>
                    {s[side]}
                  </span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {match.pens && <p className="mt-1 text-right text-xs text-ink-soft">Penalties in brackets</p>}
    </article>
  );
}
