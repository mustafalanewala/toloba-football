"use client";

import { useMemo, useRef, useState } from "react";
import { fetchTournament } from "@/lib/queries";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { Match, Tournament } from "@/lib/types";
import { useLiveUpdates, type Connection } from "@/lib/useLiveUpdates";
import { groupStandings, qualification, topScorers } from "@/lib/standings";
import { Knockouts } from "./Knockouts";
import { LiveMatchCard, ResultRow, UpcomingRow } from "./MatchCard";
import { SiteHeader } from "./SiteHeader";
import { Leaderboard, TopScorers } from "./Standings";
import { LiveDot } from "./icons";
import { PitchLines } from "./Pitch";

type Props = {
  initial: Tournament;
  supabaseUrl: string;
  supabaseKey: string;
};

export function LiveBoard({ initial, supabaseUrl, supabaseKey }: Props) {
  const [tournament, setTournament] = useState(initial);
  const latestRequest = useRef(0);

  const connection = useLiveUpdates(supabaseUrl, supabaseKey, async () => {
    // Responses can arrive out of order (poll vs. realtime); only the newest request may win.
    const request = ++latestRequest.current;
    try {
      const next = await fetchTournament(getBrowserSupabase(supabaseUrl, supabaseKey));
      if (request === latestRequest.current) setTournament(next);
    } catch {
      // Keep showing the last known scores; the next event or poll will retry.
    }
  });

  const { teamName, playerName, live, upcoming, completed, tables, qual, scorers, showKnockouts } = useMemo(() => {
    const names = new Map(tournament.teams.map((t) => [t.id, t.name]));
    const players = new Map(tournament.players.map((p) => [p.id, p.name]));
    const tables = groupStandings(tournament.groups, tournament.teams, tournament.matches);
    const by = (key: "createdAt" | "updatedAt", dir: 1 | -1) => (x: Match, y: Match) =>
      x[key] < y[key] ? -dir : x[key] > y[key] ? dir : 0;
    const of = (status: Match["status"]) => tournament.matches.filter((m) => m.status === status);
    return {
      teamName: (id: string) => names.get(id) ?? "TBD",
      playerName: (id: string | null) => (id && players.get(id)) || null,
      live: of("live").sort(by("createdAt", 1)),
      upcoming: of("upcoming").sort(by("createdAt", 1)),
      completed: of("completed").sort(by("updatedAt", -1)),
      tables,
      qual: qualification(tables, tournament.matches),
      scorers: topScorers(tournament.players, tournament.teams, tournament.matches),
      // The bracket is shown once the groups are under way, with provisional line-ups until then.
      showKnockouts:
        tables.length > 0 && tournament.matches.some((m) => m.stage !== "friendly" && m.status !== "upcoming"),
    };
  }, [tournament]);

  const cardProps = (m: Match) => ({ match: m, teamA: teamName(m.teamAId), teamB: teamName(m.teamBId), playerName });
  const empty = tournament.matches.length === 0 && tournament.groups.length === 0;
  const bothLists = upcoming.length > 0 && completed.length > 0;

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader title={tournament.name}>
        <ConnectionStatus state={connection} />
      </SiteHeader>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
        {empty && <EmptyState />}

        {live.length > 0 && (
          <section aria-labelledby="live-heading">
            <h2 id="live-heading" className="mb-3 flex items-center gap-2.5 font-display text-3xl font-semibold">
              <LiveDot /> {live.length === 1 ? "Live now" : `Live now, ${live.length} matches`}
            </h2>
            <div className={`grid grid-cols-1 gap-5 ${live.length > 1 ? "lg:grid-cols-2" : ""}`}>
              {live.map((m) => (
                <LiveMatchCard key={m.id} {...cardProps(m)} />
              ))}
            </div>
          </section>
        )}

        {showKnockouts && (
          <section aria-labelledby="knockouts-heading">
            <h2 id="knockouts-heading" className="mb-3 font-display text-3xl font-semibold">
              Semi-finals &amp; Final
            </h2>
            <Knockouts qualification={qual} teamName={teamName} />
          </section>
        )}

        {tables.length > 0 && (
          <section aria-labelledby="standings-heading" className="flex flex-col gap-4">
            <h2 id="standings-heading" className="font-display text-3xl font-semibold">
              Leaderboard
            </h2>
            <Leaderboard tables={tables} qualification={qual} />
          </section>
        )}

        {scorers.length > 0 && (
          <section aria-labelledby="scorers-heading">
            <h2 id="scorers-heading" className="mb-3 font-display text-3xl font-semibold">
              Top scorers
            </h2>
            <TopScorers rows={scorers} />
          </section>
        )}

        {(upcoming.length > 0 || completed.length > 0) && (
          <div className={`grid grid-cols-1 items-start gap-8 ${bothLists ? "lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]" : ""}`}>
            {upcoming.length > 0 && (
              <List title="Coming up" count={upcoming.length} wide={!bothLists}>
                {upcoming.map((m) => (
                  <UpcomingRow key={m.id} match={m} teamA={teamName(m.teamAId)} teamB={teamName(m.teamBId)} />
                ))}
              </List>
            )}
            {completed.length > 0 && (
              <List title="Results" count={completed.length} wide={!bothLists}>
                {completed.map((m) => (
                  <ResultRow key={m.id} {...cardProps(m)} />
                ))}
              </List>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function List({
  title,
  count,
  wide,
  children,
}: {
  title: string;
  count: number;
  wide: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-baseline gap-2 font-display text-3xl font-semibold">
        {title}
        <span className="font-sans text-base font-semibold text-toloba">{count}</span>
      </h2>
      <div className="overflow-hidden rounded-xl border border-line bg-white">
        {/* Rows draw their own top border; -mt-px hides the first one. */}
        <ul className={`-mt-px grid grid-cols-1 *:border-t *:border-line ${wide ? "lg:grid-cols-2 lg:*:odd:border-r" : ""}`}>
          {children}
        </ul>
      </div>
    </section>
  );
}

function ConnectionStatus({ state }: { state: Connection }) {
  const styles: Record<Connection, [string, string]> = {
    live: ["bg-green-300", "Scores update live"],
    connecting: ["bg-ball animate-pulse", "Connecting"],
    offline: ["bg-white/50", "Reconnecting"],
  };
  const [dot, label] = styles[state];
  return (
    <span title={label} className="flex shrink-0 items-center gap-2 text-sm text-white/80">
      <span className={`size-2.5 rounded-full ${dot}`} />
      <span className="sr-only sm:not-sr-only">{label}</span>
    </span>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto w-full max-w-2xl text-center">
      <div className="rounded-xl border border-line bg-white p-3 sm:p-5">
        <div className="pitch relative aspect-[2/1] rounded-lg">
          <PitchLines />
        </div>
      </div>
      <h2 className="mt-6 font-display text-3xl font-semibold">No matches scheduled yet</h2>
      <p className="mx-auto mt-2 max-w-sm text-ink-soft">
        Keep this page open. Scores appear here the moment the first match starts.
      </p>
    </div>
  );
}
