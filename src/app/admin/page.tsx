import { Suspense } from "react";
import Link from "next/link";
import { Knockouts } from "@/components/Knockouts";
import { SiteHeader } from "@/components/SiteHeader";
import { Leaderboard } from "@/components/Standings";
import { requireAdmin } from "@/lib/auth";
import { loadTournament } from "@/lib/data";
import { groupStandings, lockReason, qualification } from "@/lib/standings";
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Match } from "@/lib/types";
import { logout } from "./actions";
import { MatchControl } from "./_components/MatchControl";
import { GroupManager } from "./_components/GroupManager";
import { KnockoutSetup } from "./_components/KnockoutSetup";
import { LiveSync } from "./_components/LiveSync";
import { MatchCreator } from "./_components/MatchCreator";
import { TeamManager } from "./_components/TeamManager";
import { TournamentSettings } from "./_components/TournamentSettings";

export const metadata = { title: "Admin — Toloba Football" };

export default function AdminPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader title="Scorer panel" compact wide>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Link
            href="/"
            target="_blank"
            className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-toloba hover:bg-toloba-soft"
          >
            <span className="sm:hidden">Scoreboard</span>
            <span className="hidden sm:inline">Open scoreboard</span>
          </Link>
          <form action={logout}>
            <button type="submit" className="rounded-lg px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white">
              Log out
            </button>
          </form>
        </div>
      </SiteHeader>

      <div className="mx-auto w-full max-w-[1440px] flex-1 px-4 pt-6 pb-16 sm:px-6 sm:pt-8 lg:px-8">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-slate-200/60" />}>
          <AdminContent />
        </Suspense>
      </div>
    </div>
  );
}

async function AdminContent() {
  await requireAdmin();
  if (!isSupabaseConfigured()) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        Supabase isn&apos;t configured. Add the Supabase keys listed in the README and run{" "}
        <code className="font-mono">supabase/schema.sql</code>.
      </p>
    );
  }

  const { tournament, error } = await loadTournament();
  if (!tournament) {
    return (
      <p className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm break-words text-red-800">{error}</p>
    );
  }
  const names = new Map(tournament.teams.map((t) => [t.id, t.name]));
  const group = (status: Match["status"]) => tournament.matches.filter((m) => m.status === status);
  const live = group("live");
  const upcoming = group("upcoming");
  const completed = group("completed").sort((x, y) => (x.updatedAt < y.updatedAt ? 1 : -1));
  const tables = groupStandings(tournament.groups, tournament.teams, tournament.matches);
  const qual = qualification(tables, tournament.matches);
  const knockoutExists = tournament.matches.some((m) => m.stage === "knockout");
  const teamName = (id: string) => names.get(id) ?? "TBD";

  const renderMatch = (m: Match) => (
    <MatchControl
      key={m.id}
      match={m}
      teamA={names.get(m.teamAId) ?? "TBD"}
      teamB={names.get(m.teamBId) ?? "TBD"}
      players={tournament.players.filter((p) => p.teamId === m.teamAId || p.teamId === m.teamBId)}
      locked={m.status === "completed" ? lockReason(m, tournament.matches) : null}
    />
  );

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px] xl:gap-8">
      <LiveSync supabaseUrl={getSupabaseUrl()} supabaseKey={getSupabaseAnonKey()} />
      {/* Matches first: on phones the scorer needs these at the top. */}
      <main className="flex min-w-0 flex-col gap-8">
        <MatchGroup title="Live" wide empty="Nothing live. Kick off a match from Coming up.">
          {live.map(renderMatch)}
        </MatchGroup>
        <MatchGroup title="Coming up" empty="No matches scheduled. Create one in the New match panel.">
          {upcoming.map(renderMatch)}
        </MatchGroup>
        {knockoutExists && (
          <section>
            <h2 className="mb-3 font-display text-3xl font-semibold">Semi-finals &amp; Final</h2>
            <Knockouts qualification={qual} teamName={teamName} />
          </section>
        )}
        {tables.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="font-display text-3xl font-semibold">Leaderboard</h2>
            <Leaderboard tables={tables} qualification={qual} showRules={false} />
          </section>
        )}
        {completed.length > 0 && <MatchGroup title="Results">{completed.map(renderMatch)}</MatchGroup>}
      </main>

      <aside className="flex flex-col gap-4">
        <TournamentSettings name={tournament.name} halfMinutes={tournament.halfMinutes} />
        {tables.length > 0 && <KnockoutSetup qualification={qual} teams={tournament.teams} />}
        <GroupManager groups={tournament.groups} teams={tournament.teams} matches={tournament.matches} />
        <TeamManager teams={tournament.teams} groups={tournament.groups} players={tournament.players} />
        <MatchCreator teams={tournament.teams} groups={tournament.groups} />
      </aside>
    </div>
  );
}

function MatchGroup({
  title,
  empty,
  wide,
  children,
}: {
  title: string;
  empty?: string;
  wide?: boolean;
  children: React.ReactNode[];
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-baseline gap-2 font-display text-3xl font-semibold">
        {title}
        <span className="font-sans text-base font-semibold text-toloba">{children.length}</span>
      </h2>
      {children.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-soft/30 px-4 py-6 text-center text-ink-soft">{empty}</p>
      ) : (
        <div className={`grid grid-cols-1 gap-4 ${wide ? "" : "xl:grid-cols-2"}`}>{children}</div>
      )}
    </section>
  );
}
