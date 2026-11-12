import type { GroupTable, Qualification, QualificationStatus, ScorerRow, StandingRow } from "@/lib/standings";

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

const STATUS: Record<QualificationStatus, { final: string; provisional: string; className: string }> = {
  qualified: { final: "Into semi-final", provisional: "Top two so far", className: "bg-toloba-soft text-toloba" },
  out: { final: "Out", provisional: "Outside top two", className: "bg-background text-ink-soft" },
};

function StatusBadge({ entry }: { entry?: { status: QualificationStatus; final: boolean } }) {
  if (!entry) return null;
  const s = STATUS[entry.status];
  return (
    <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold sm:whitespace-nowrap ${s.className}`}>
      {entry.final ? s.final : s.provisional}
    </span>
  );
}

function TieFlag({ row }: { row: StandingRow }) {
  if (row.tie) {
    return (
      <span className="ml-1.5 inline-block rounded-md bg-rose-50 px-1.5 py-0.5 text-xs font-semibold text-rose-700 sm:whitespace-nowrap">
        Coin toss needed
      </span>
    );
  }
  if (row.toss) {
    return (
      <span className="ml-1.5 inline-block rounded-md bg-background px-1.5 py-0.5 text-xs font-semibold text-ink-soft sm:whitespace-nowrap">
        Decided by coin toss
      </span>
    );
  }
  return null;
}

const th = "px-1.5 py-2 font-medium text-ink-soft sm:px-3";
const td = "px-1.5 py-2.5 text-center tabular-nums sm:px-3";

/** Points tables, one per group. */
export function GroupTables({ tables, qualification }: { tables: GroupTable[]; qualification: Qualification }) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {tables.map((t) => (
        <section key={t.group.id} className="overflow-hidden rounded-xl border border-line bg-white">
          <header className="flex items-baseline justify-between gap-2 border-b border-line px-4 py-3">
            <h3 className="font-display text-2xl font-semibold">{t.group.name}</h3>
            <span className="text-sm text-ink-soft">
              {t.total === 0 ? "No teams yet" : `${t.played}/${t.total} played`}
            </span>
          </header>
          {t.rows.length === 0 ? (
            <p className="px-4 py-6 text-center text-ink-soft">Teams will appear here once assigned.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm sm:text-base">
                <thead className="bg-background text-xs sm:text-sm">
                  <tr>
                    <th className={`${th} w-8 text-center`}>#</th>
                    <th className={`${th} text-left`}>Team</th>
                    <th className={`${th} text-center`} title="Played">P</th>
                    <th className={`${th} text-center`} title="Won">W</th>
                    <th className={`${th} text-center`} title="Drawn">D</th>
                    <th className={`${th} text-center`} title="Lost">L</th>
                    <th className={`${th} hidden text-center sm:table-cell`} title="Goals scored – conceded">Goals</th>
                    <th className={`${th} text-center`} title="Goal difference">GD</th>
                    <th className={`${th} text-center text-ink`} title="Points">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {t.rows.map((r) => (
                    <tr key={r.team.id} className="border-t border-line">
                      <td className={`${td} font-display text-lg font-semibold`}>{r.rank}</td>
                      <td className="px-1.5 py-2.5 break-words sm:px-3">
                        <div className="font-semibold leading-tight">
                          {r.team.name}
                          <TieFlag row={r} />
                        </div>
                        <div className="mt-1">
                          <StatusBadge entry={qualification.status.get(r.team.id)} />
                        </div>
                      </td>
                      <td className={td}>{r.played}</td>
                      <td className={td}>{r.won}</td>
                      <td className={td}>{r.drawn}</td>
                      <td className={td}>{r.lost}</td>
                      <td className={`${td} hidden whitespace-nowrap sm:table-cell`}>
                        {r.goalsFor}–{r.goalsAgainst}
                      </td>
                      <td className={td}>{signed(r.goalDiff)}</td>
                      <td className={`${td} font-display text-lg font-bold`}>{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

export function CoinTossNotice({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
      <p className="font-semibold">Tie on every rule: decided by coin toss</p>
      <ul className="mt-1 list-disc pl-5">
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </div>
  );
}

export function QualificationRules() {
  return (
    <details className="group rounded-xl border border-line bg-white px-4 py-3">
      <summary className="cursor-pointer font-semibold marker:text-toloba">How qualification works</summary>
      <div className="mt-3 grid grid-cols-1 gap-4 text-sm text-ink sm:grid-cols-2">
        <div>
          <p className="font-semibold">Road to the Final</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-ink-soft">
            <li>Two groups of four. Every team plays the other three in its group.</li>
            <li>3 points for a win, 1 for a draw, 0 for a loss.</li>
            <li>In each group, 1st plays 2nd in that group&apos;s semi-final.</li>
            <li>The two semi-final winners play the Final.</li>
            <li>A semi-final or Final that ends level goes straight to penalties.</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold">Ranking rules, in order</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-ink-soft">
            <li>Points</li>
            <li>Goal difference</li>
            <li>Goals scored</li>
            <li>Head-to-head between the tied teams</li>
            <li>Coin toss</li>
          </ol>
        </div>
      </div>
    </details>
  );
}

/** Group progress: coin-toss notes and the points tables. */
export function Leaderboard({
  tables,
  qualification,
  showRules = true,
}: {
  tables: GroupTable[];
  qualification: Qualification;
  showRules?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <CoinTossNotice notes={qualification.coinTosses} />
      <GroupTables tables={tables} qualification={qualification} />
      {showRules && <QualificationRules />}
    </div>
  );
}

export function TopScorers({ rows, limit = 10 }: { rows: ScorerRow[]; limit?: number }) {
  if (rows.length === 0) return null;
  // Players level on goals share a rank.
  const ranked = rows.slice(0, limit).map((r) => ({ ...r, rank: rows.findIndex((x) => x.goals === r.goals) + 1 }));
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <table className="w-full text-sm sm:text-base">
        <thead className="bg-background text-xs sm:text-sm">
          <tr>
            <th className={`${th} w-8 text-center`}>#</th>
            <th className={`${th} text-left`}>Player</th>
            <th className={`${th} text-left`}>Team</th>
            <th className={`${th} text-center text-ink`}>Goals</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((r) => (
            <tr key={r.player.id} className="border-t border-line">
              <td className={`${td} font-display text-lg font-semibold`}>{r.rank}</td>
              <td className="px-1.5 py-2.5 font-semibold sm:px-3">
                {r.player.number !== null && <span className="mr-1.5 text-ink-soft tabular-nums">{r.player.number}</span>}
                {r.player.name}
              </td>
              <td className="px-1.5 py-2.5 text-ink-soft sm:px-3">{r.team?.name}</td>
              <td className={`${td} font-display text-lg font-bold`}>{r.goals}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
