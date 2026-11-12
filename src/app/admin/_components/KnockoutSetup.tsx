"use client";

import { useState } from "react";
import { semiCandidates, type GroupSemi, type Qualification } from "@/lib/standings";
import { semiLabel, type Match, type Team } from "@/lib/types";
import { createFinal, createSemi } from "../actions";
import { Button, Card, ErrorText, useAdminAction } from "./ui";

type Props = { qualification: Qualification; teams: Team[] };

export function KnockoutSetup({ qualification, teams }: Props) {
  const { semis, final } = qualification;
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? "TBD";
  return (
    <Card title="Semi-finals & Final">
      <div className="flex flex-col gap-3">
        {semis.map((s) => (
          <SemiSetup key={s.group.id} semi={s} teamName={teamName} />
        ))}
        <FinalSetup semis={semis} final={final} teamName={teamName} />
      </div>
    </Card>
  );
}

function created(match: Match, teamName: (id: string) => string) {
  const state = match.status === "completed" ? "Full time" : match.status === "live" ? "Live now" : "Under Coming up";
  return `${teamName(match.teamAId)} v ${teamName(match.teamBId)} · ${state}.`;
}

function SemiSetup({ semi, teamName }: { semi: GroupSemi; teamName: (id: string) => string }) {
  const { group, table, match } = semi;
  const { run, pending, error } = useAdminAction();
  const { fixed, pool, need } = semiCandidates(table);
  const [ticked, setPicks] = useState<string[]>([]);
  // Results can change after a tick (e.g. a reopened match), so keep only teams still in the coin-toss pool.
  const picks = ticked.filter((id) => pool.some((r) => r.team.id === id));
  const title = semiLabel(group.name);

  let body: React.ReactNode;
  if (match) {
    body = <p className="text-ink-soft">{created(match, teamName)} To remove it, use Delete on the match.</p>;
  } else if (!table.complete) {
    body = (
      <p className="text-ink-soft">
        1st v 2nd. Unlocks when all {group.name} matches are completed ({table.played}/{table.total}).
      </p>
    );
  } else {
    const chosen = [...fixed.map((r) => r.team.id), ...picks];
    body = (
      <>
        {fixed.map((r) => (
          <p key={r.team.id} className="font-semibold">
            {r.rank}. {r.team.name}
          </p>
        ))}
        {pool.length > 0 && (
          <div className="mt-1 rounded-md border border-rose-200 bg-rose-50 p-2">
            <p className="text-sm text-rose-700">
              Level on every rule. Toss a coin, then tick the {need === 1 ? "team" : `${need} teams`} that go through.
            </p>
            {pool.map((r) => (
              <label key={r.team.id} className="mt-1 flex items-center gap-2 font-semibold">
                <input
                  type="checkbox"
                  className="size-4 accent-toloba"
                  checked={picks.includes(r.team.id)}
                  onChange={(e) =>
                    setPicks((p) => (e.target.checked ? [...p, r.team.id] : p.filter((id) => id !== r.team.id)))
                  }
                />
                {r.team.name}
              </label>
            ))}
          </div>
        )}
        <Button
          variant="primary"
          className="mt-2 w-full py-2.5"
          disabled={pending || picks.length !== need}
          onClick={() => {
            const names = table.rows.filter((r) => chosen.includes(r.team.id)).map((r) => r.team.name);
            if (confirm(`Create the ${title}: ${names.join(" v ")}? This locks the ${group.name} results.`)) {
              run(() => createSemi(group.id, chosen));
            }
          }}
        >
          Create {title}
        </Button>
      </>
    );
  }

  return (
    <section className="rounded-lg border border-line p-3">
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      <div className="mt-1">{body}</div>
      <ErrorText error={error} />
    </section>
  );
}

function FinalSetup({
  semis,
  final,
  teamName,
}: {
  semis: GroupSemi[];
  final: Match | null;
  teamName: (id: string) => string;
}) {
  const { run, pending, error } = useAdminAction();
  const winners = semis.map((s) => (s.match?.status === "completed" ? s.match.winnerId : null));
  const ready = semis.length === 2 && winners.every(Boolean);

  return (
    <section className="rounded-lg border border-ball-deep/50 p-3">
      <h3 className="font-display text-xl font-semibold">Final</h3>
      {final ? (
        <p className="mt-1 text-ink-soft">{created(final, teamName)} To remove it, use Delete on the match.</p>
      ) : ready ? (
        <Button
          variant="primary"
          className="mt-2 w-full py-2.5"
          disabled={pending}
          onClick={() => {
            if (confirm("Create the Final? This locks the semi-final results.")) run(createFinal);
          }}
        >
          Create Final: {teamName(winners[0]!)} v {teamName(winners[1]!)}
        </Button>
      ) : (
        <p className="mt-1 text-ink-soft">The two semi-final winners. Unlocks when both semi-finals are completed.</p>
      )}
      <ErrorText error={error} />
    </section>
  );
}
