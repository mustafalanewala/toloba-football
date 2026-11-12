// Shared read queries. Works with both the server (service-role) and browser (anon) clients.
import type { SupabaseClient } from "@supabase/supabase-js";
import { sortGoals } from "./scoring";
import { FINAL_LABEL, semiLabel, type Goal, type Group, type KnockoutRound, type Match, type Player, type Side, type Tournament } from "./types";

export type MatchRow = {
  id: string;
  team_a_id: string;
  team_b_id: string;
  label: string | null;
  stage: Match["stage"] | null;
  group_id: string | null;
  round: KnockoutRound | null;
  half_minutes: number;
  status: Match["status"];
  period: Match["period"];
  first_half_at: string | null;
  second_half_at: string | null;
  pens_a: number | null;
  pens_b: number | null;
  winner_id: string | null;
  created_at: string;
  updated_at: string;
};

export type GoalRow = {
  id: string;
  match_id: string;
  side: Side;
  player_id: string | null;
  own_goal: boolean;
  minute: number;
  extra: number;
  created_at: string;
};

type TeamRow = { id: string; name: string; group_id: string | null };
type PlayerRow = { id: string; team_id: string; name: string; number: number | null };

export function toGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    matchId: row.match_id,
    side: row.side,
    playerId: row.player_id,
    ownGoal: row.own_goal,
    minute: row.minute,
    extra: row.extra,
    createdAt: row.created_at,
  };
}

export function toMatch(row: MatchRow, goals: Goal[] = []): Match {
  return {
    id: row.id,
    teamAId: row.team_a_id,
    teamBId: row.team_b_id,
    label: row.label,
    stage: row.stage ?? "friendly",
    groupId: row.group_id,
    round: row.round,
    halfMinutes: row.half_minutes,
    status: row.status,
    period: row.period,
    firstHalfAt: row.first_half_at,
    secondHalfAt: row.second_half_at,
    pens: row.pens_a === null || row.pens_b === null ? null : { a: row.pens_a, b: row.pens_b },
    winnerId: row.winner_id,
    goals: sortGoals(goals.filter((g) => g.matchId === row.id)),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Group matches are labelled with their group's current name, knockout matches with their round. */
function displayLabel(match: Match, groups: Map<string, string>) {
  const groupName = match.groupId ? groups.get(match.groupId) : undefined;
  if (match.round === "final") return FINAL_LABEL;
  if (match.round === "semi") return groupName ? semiLabel(groupName) : match.label;
  if (match.stage === "group") return groupName ?? match.label;
  return match.label || "Friendly";
}

export async function fetchTournament(supabase: SupabaseClient): Promise<Tournament> {
  const [settings, groups, teams, players, matches, goals] = await Promise.all([
    supabase.from("settings").select("tournament_name, half_minutes").eq("id", 1).maybeSingle(),
    supabase.from("groups").select("id, name").order("name"),
    supabase.from("teams").select("id, name, group_id").order("name"),
    supabase.from("players").select("id, team_id, name, number").order("number", { nullsFirst: false }).order("name"),
    supabase.from("matches").select("*").order("created_at"),
    supabase.from("goals").select("*"),
  ]);

  const error = settings.error ?? groups.error ?? teams.error ?? players.error ?? matches.error ?? goals.error;
  if (error) {
    const missingSchema = /does not exist|schema cache|column/i.test(error.message);
    throw new Error(
      missingSchema
        ? `Database tables are missing. Run supabase/schema.sql in the Supabase SQL Editor. (${error.message})`
        : `Failed to load tournament: ${error.message}`,
    );
  }

  const groupList = (groups.data ?? []) as Group[];
  const groupNames = new Map(groupList.map((g) => [g.id, g.name]));
  const goalList = ((goals.data ?? []) as GoalRow[]).map(toGoal);

  return {
    name: settings.data?.tournament_name ?? "Football Tournament",
    halfMinutes: settings.data?.half_minutes ?? 15,
    groups: groupList,
    teams: ((teams.data ?? []) as TeamRow[]).map((t) => ({ id: t.id, name: t.name, groupId: t.group_id })),
    players: ((players.data ?? []) as PlayerRow[]).map(
      (p): Player => ({ id: p.id, teamId: p.team_id, name: p.name, number: p.number }),
    ),
    matches: ((matches.data ?? []) as MatchRow[]).map((row) => {
      const match = toMatch(row, goalList);
      return { ...match, label: displayLabel(match, groupNames) };
    }),
  };
}
