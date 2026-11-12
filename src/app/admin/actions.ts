"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { endSession, isAdmin } from "@/lib/auth";
import { fetchTournament, toGoal, toMatch, type GoalRow, type MatchRow } from "@/lib/queries";
import {
  applyEndShootout,
  applyFullTime,
  applyHalfTime,
  applyKickOff,
  applyPenalty,
  applySecondHalf,
  applyUndoPeriod,
  other,
  parseMinute,
} from "@/lib/scoring";
import {
  MAX_TEAMS_PER_GROUP,
  findFinal,
  findSemi,
  groupStandings,
  lockReason,
  roundRobinPairs,
  semiCandidates,
} from "@/lib/standings";
import { getServerSupabase } from "@/lib/supabase/server";
import { FINAL_LABEL, semiLabel, type Match, type Side } from "@/lib/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Wraps every admin mutation: checks the session, maps errors to messages, refreshes the UI. */
async function adminAction(fn: () => Promise<void>): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Your session expired. Please log in again." };
  try {
    await fn();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
  refresh();
  return { ok: true };
}

function db() {
  return getServerSupabase();
}

function check(error: { message: string; code?: string } | null, friendly?: Record<string, string>) {
  if (!error) return;
  throw new Error((error.code && friendly?.[error.code]) || error.message);
}

async function fetchMatches(filter: { stage?: Match["stage"]; groupId?: string } = {}) {
  let query = db().from("matches").select("*");
  if (filter.stage) query = query.eq("stage", filter.stage);
  if (filter.groupId) query = query.eq("group_id", filter.groupId);
  const { data, error } = await query;
  check(error);
  return ((data ?? []) as MatchRow[]).map((row) => toMatch(row));
}

const samePair = (m: Match, x: string, y: string) =>
  (m.teamAId === x && m.teamBId === y) || (m.teamAId === y && m.teamBId === x);

/** Current standings, computed on the server from fresh data (never trusted from the browser). */
async function loadStandings() {
  const t = await fetchTournament(db());
  return { ...t, tables: groupStandings(t.groups, t.teams, t.matches) };
}

async function currentHalfMinutes() {
  const { data, error } = await db().from("settings").select("half_minutes").eq("id", 1).maybeSingle();
  check(error);
  return (data?.half_minutes as number | undefined) ?? 15;
}

/** A group's results feed its semi-final, so no new group matches once the semi exists. */
async function assertGroupOpen(groupId: string) {
  const semi = findSemi(await fetchMatches({ groupId }), groupId);
  if (semi) throw new Error(`The ${semi.label ?? "semi-final"} already exists, so this group's fixtures are closed.`);
}

// ---- Tournament ----

export async function updateTournamentName(name: string) {
  return adminAction(async () => {
    const value = name.trim();
    if (!value) throw new Error("Tournament name can't be empty.");
    const { error } = await db().from("settings").upsert({ id: 1, tournament_name: value });
    check(error);
  });
}

/** Sets the half length for new matches and for every match that hasn't kicked off yet. */
export async function updateHalfMinutes(minutes: number) {
  return adminAction(async () => {
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 60) {
      throw new Error("Half length must be between 1 and 60 minutes.");
    }
    const { error } = await db().from("settings").update({ half_minutes: minutes }).eq("id", 1);
    check(error);
    const { error: matchError } = await db().from("matches").update({ half_minutes: minutes }).eq("status", "upcoming");
    check(matchError);
  });
}

// ---- Teams ----

const DUPLICATE_TEAM = { "23505": "A team with that name already exists." };

export async function addTeam(name: string) {
  return adminAction(async () => {
    const value = name.trim();
    if (!value) throw new Error("Team name can't be empty.");
    const { error } = await db().from("teams").insert({ name: value });
    check(error, DUPLICATE_TEAM);
  });
}

export async function renameTeam(id: string, name: string) {
  return adminAction(async () => {
    const value = name.trim();
    if (!value) throw new Error("Team name can't be empty.");
    const { error } = await db().from("teams").update({ name: value }).eq("id", id);
    check(error, DUPLICATE_TEAM);
  });
}

export async function deleteTeam(id: string) {
  return adminAction(async () => {
    const { error } = await db().from("teams").delete().eq("id", id);
    check(error, { "23503": "This team is part of a match. Delete its matches first." });
  });
}

// ---- Players ----

async function validPlayer(teamId: string, name: string, number: number | null, exceptId?: string) {
  const value = name.trim();
  if (!value) throw new Error("Player name can't be empty.");
  if (number !== null && (!Number.isInteger(number) || number < 0 || number > 99)) {
    throw new Error("Shirt number must be between 0 and 99.");
  }
  if (number !== null) {
    let query = db().from("players").select("name").eq("team_id", teamId).eq("number", number);
    if (exceptId) query = query.neq("id", exceptId);
    const { data, error } = await query;
    check(error);
    if (data?.length) throw new Error(`Number ${number} is already worn by ${data[0].name}.`);
  }
  return value;
}

export async function addPlayer(teamId: string, name: string, number: number | null) {
  return adminAction(async () => {
    const value = await validPlayer(teamId, name, number);
    const { error } = await db().from("players").insert({ team_id: teamId, name: value, number });
    check(error, { "23503": "That team no longer exists." });
  });
}

export async function updatePlayer(id: string, name: string, number: number | null) {
  return adminAction(async () => {
    const { data: player, error } = await db().from("players").select("team_id").eq("id", id).single();
    check(error);
    if (!player) throw new Error("Player not found.");
    const value = await validPlayer(player.team_id, name, number, id);
    const { error: updateError } = await db().from("players").update({ name: value, number }).eq("id", id);
    check(updateError);
  });
}

export async function deletePlayer(id: string) {
  return adminAction(async () => {
    const { error } = await db().from("players").delete().eq("id", id);
    check(error, { "23503": "This player has goals on record. Remove those goals first." });
  });
}

// ---- Groups ----

const DUPLICATE_GROUP = { "23505": "A group with that name already exists." };

export async function createDefaultGroups() {
  return adminAction(async () => {
    const { error } = await db()
      .from("groups")
      .upsert(["Group A", "Group B"].map((name) => ({ name })), { onConflict: "name", ignoreDuplicates: true });
    check(error);
  });
}

export async function renameGroup(id: string, name: string) {
  return adminAction(async () => {
    const value = name.trim();
    if (!value) throw new Error("Group name can't be empty.");
    const { error } = await db().from("groups").update({ name: value }).eq("id", id);
    check(error, DUPLICATE_GROUP);
    // Semi-finals keep their label in the database for lock messages, so keep it in step.
    const { error: labelError } = await db()
      .from("matches")
      .update({ label: semiLabel(value) })
      .eq("group_id", id)
      .eq("round", "semi");
    check(labelError);
  });
}

export async function deleteGroup(id: string) {
  return adminAction(async () => {
    const { error } = await db().from("groups").delete().eq("id", id);
    check(error, { "23503": "This group has matches. Delete its matches first." });
  });
}

/** Put a team in a group (or take it out with null). */
export async function setTeamGroup(teamId: string, groupId: string | null) {
  return adminAction(async () => {
    const { data: team, error } = await db().from("teams").select("id, name, group_id").eq("id", teamId).single();
    check(error);
    if (!team) throw new Error("Team not found.");
    if (team.group_id === groupId) return;

    // Moving a team after it has played (or been drawn) would silently change the standings.
    const { count, error: countError } = await db()
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("stage", "group")
      .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`);
    check(countError);
    if (count) {
      throw new Error(`${team.name} already has group matches. Delete those matches before moving the team.`);
    }

    if (groupId) {
      const { count: size, error: sizeError } = await db()
        .from("teams")
        .select("id", { count: "exact", head: true })
        .eq("group_id", groupId);
      check(sizeError);
      if ((size ?? 0) >= MAX_TEAMS_PER_GROUP) {
        throw new Error(`This group already has ${MAX_TEAMS_PER_GROUP} teams.`);
      }
    }

    const { error: updateError } = await db().from("teams").update({ group_id: groupId }).eq("id", teamId);
    check(updateError);
  });
}

/** Create every missing round-robin match in a group. Safe to run more than once. */
export async function generateGroupFixtures(groupId: string) {
  return adminAction(async () => {
    const { data: teams, error } = await db()
      .from("teams")
      .select("id")
      .eq("group_id", groupId)
      .order("created_at");
    check(error);
    if (!teams || teams.length < 2) throw new Error("Add at least two teams to this group first.");
    await assertGroupOpen(groupId);

    const existing = await fetchMatches({ stage: "group", groupId });
    const missing = roundRobinPairs(teams.map((t) => t.id as string)).filter(
      ([x, y]) => !existing.some((m) => samePair(m, x, y)),
    );
    if (missing.length === 0) throw new Error("All fixtures for this group already exist.");

    const halfMinutes = await currentHalfMinutes();
    // One insert per match so created_at keeps the play order.
    for (const [a, b] of missing) {
      const { error: insertError } = await db()
        .from("matches")
        .insert({ team_a_id: a, team_b_id: b, stage: "group", group_id: groupId, half_minutes: halfMinutes });
      check(insertError);
    }
  });
}

// ---- Knockouts ----

/**
 * Create a group's semi-final: 1st v 2nd. `teamIds` are the two semi-finalists; they only differ
 * from the top two when a coin toss settled a tie across the cut-off.
 */
export async function createSemi(groupId: string, teamIds: string[]) {
  return adminAction(async () => {
    const { tables, matches, halfMinutes } = await loadStandings();
    const table = tables.find((t) => t.group.id === groupId);
    if (!table) throw new Error("Group not found.");
    if (findSemi(matches, groupId)) throw new Error(`The ${semiLabel(table.group.name)} already exists.`);
    if (!table.complete) throw new Error(`Finish all ${table.group.name} matches before creating its semi-final.`);

    const picked = [...new Set(teamIds)];
    const { fixed, pool, need } = semiCandidates(table);
    const fromPool = picked.filter((id) => pool.some((r) => r.team.id === id));
    const valid =
      picked.length === 2 && fixed.every((r) => picked.includes(r.team.id)) && fromPool.length === need;
    if (!valid) throw new Error(`Those aren't the top two of ${table.group.name}.`);

    // The higher-placed team is listed first.
    const [a, b] = table.rows.filter((r) => picked.includes(r.team.id));
    const { error } = await db().from("matches").insert({
      team_a_id: a.team.id,
      team_b_id: b.team.id,
      stage: "knockout",
      round: "semi",
      group_id: groupId,
      label: semiLabel(table.group.name),
      half_minutes: halfMinutes,
    });
    check(error, { "23505": `The ${semiLabel(table.group.name)} already exists.` });
  });
}

/** The Final, between the two semi-final winners. */
export async function createFinal() {
  return adminAction(async () => {
    const { groups, matches, halfMinutes } = await loadStandings();
    if (findFinal(matches)) throw new Error("The Final already exists.");
    const semis = groups.map((g) => findSemi(matches, g.id)).filter((m): m is Match => Boolean(m));
    if (semis.length !== 2 || semis.some((m) => m.status !== "completed" || !m.winnerId)) {
      throw new Error("Both semi-finals must be completed before creating the Final.");
    }
    const { error } = await db().from("matches").insert({
      team_a_id: semis[0].winnerId,
      team_b_id: semis[1].winnerId,
      stage: "knockout",
      round: "final",
      label: FINAL_LABEL,
      half_minutes: halfMinutes,
    });
    check(error, { "23505": "The Final already exists." });
  });
}

// ---- Matches ----

export type NewMatch =
  | { kind: "group"; groupId: string; teamAId: string; teamBId: string }
  | { kind: "friendly"; teamAId: string; teamBId: string; label: string };

export async function createMatch(input: NewMatch) {
  return adminAction(async () => {
    const { teamAId, teamBId } = input;
    if (!teamAId || !teamBId) throw new Error("Pick both teams.");
    if (teamAId === teamBId) throw new Error("A team can't play itself.");
    const base = { team_a_id: teamAId, team_b_id: teamBId, half_minutes: await currentHalfMinutes() };

    if (input.kind === "group") {
      const { data: teams, error } = await db().from("teams").select("id, group_id").in("id", [teamAId, teamBId]);
      check(error);
      if (teams?.length !== 2 || teams.some((t) => t.group_id !== input.groupId)) {
        throw new Error("Both teams must be in the selected group.");
      }
      await assertGroupOpen(input.groupId);
      const existing = await fetchMatches({ stage: "group", groupId: input.groupId });
      if (existing.some((m) => samePair(m, teamAId, teamBId))) {
        throw new Error("These two teams already have a match in this group.");
      }
      const { error: insertError } = await db()
        .from("matches")
        .insert({ ...base, stage: "group", group_id: input.groupId });
      check(insertError);
      return;
    }

    const { error } = await db()
      .from("matches")
      .insert({ ...base, stage: "friendly", label: input.label.trim() || null });
    check(error);
  });
}

/** A result is locked once the next stage was built from it (see lockReason). */
async function assertUnlocked(match: Match) {
  const reason = lockReason(match, await fetchMatches());
  if (reason) throw new Error(reason);
}

async function loadMatch(id: string) {
  const [match, goals] = await Promise.all([
    db().from("matches").select("*").eq("id", id).single(),
    db().from("goals").select("*").eq("match_id", id),
  ]);
  check(match.error ?? goals.error);
  const row = match.data as MatchRow;
  return { row, match: toMatch(row, ((goals.data ?? []) as GoalRow[]).map(toGoal)) };
}

export async function deleteMatch(id: string) {
  return adminAction(async () => {
    const { match } = await loadMatch(id);
    if (match.status === "live") throw new Error("This match is being played. Reset it before deleting.");
    await assertUnlocked(match);
    const { error } = await db().from("matches").delete().eq("id", id);
    check(error);
  });
}

/**
 * Read → change → write, refusing to write if someone else changed the match in between
 * (e.g. a second scorer's phone), so no update is ever silently overwritten.
 */
async function updateMatch(id: string, change: (m: Match) => Match | Promise<Match>, retries = 0) {
  const { row, match } = await loadMatch(id);
  const next = await change(match);
  const { data, error } = await db()
    .from("matches")
    .update({
      status: next.status,
      period: next.period,
      first_half_at: next.firstHalfAt,
      second_half_at: next.secondHalfAt,
      pens_a: next.pens?.a ?? null,
      pens_b: next.pens?.b ?? null,
      winner_id: next.winnerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("updated_at", row.updated_at)
    .select("id");
  check(error);
  if (!data?.length) {
    if (retries > 0) return updateMatch(id, change, retries - 1);
    throw new Error("This match was just updated on another device. Check the latest score and try again.");
  }
}

export async function kickOff(id: string) {
  return adminAction(() => updateMatch(id, (m) => applyKickOff(m, new Date().toISOString())));
}

export async function halfTime(id: string) {
  return adminAction(() => updateMatch(id, applyHalfTime));
}

export async function startSecondHalf(id: string) {
  return adminAction(() => updateMatch(id, (m) => applySecondHalf(m, new Date().toISOString())));
}

export async function fullTime(id: string) {
  return adminAction(() => updateMatch(id, applyFullTime));
}

export async function changePenalty(id: string, side: Side, delta: 1 | -1) {
  // A tap is "+1 / −1 on fresh data", so a clash with another tap is simply retried.
  return adminAction(() => updateMatch(id, (m) => applyPenalty(m, side, delta), 3));
}

export async function endShootout(id: string) {
  return adminAction(() => updateMatch(id, applyEndShootout));
}

/** Step back one period; on a completed match this reopens it. */
export async function undoPeriod(id: string) {
  return adminAction(() =>
    updateMatch(id, async (m) => {
      if (m.status === "completed") await assertUnlocked(m);
      return applyUndoPeriod(m);
    }),
  );
}

export async function resetMatch(id: string) {
  return adminAction(async () => {
    await updateMatch(id, async (m) => {
      await assertUnlocked(m);
      return { ...m, status: "upcoming", period: null, firstHalfAt: null, secondHalfAt: null, pens: null, winnerId: null };
    });
    // The match is upcoming now, so no new goal can slip in while these are removed.
    const { error } = await db().from("goals").delete().eq("match_id", id);
    check(error);
  });
}

// ---- Goals ----

export type NewGoal = { side: Side; playerId: string | null; ownGoal: boolean; minute: string };

export async function addGoal(matchId: string, input: NewGoal) {
  return adminAction(async () => {
    const { match } = await loadMatch(matchId);
    if (match.status !== "live" || match.period === "penalties") {
      throw new Error(match.status === "completed" ? "Reopen the match to change its goals." : "Goals can only be added during the match.");
    }
    const minute = parseMinute(input.minute);
    if (!minute) throw new Error("Enter the minute like 37 or 45+2.");
    if (input.side !== "a" && input.side !== "b") throw new Error("Invalid side.");

    if (input.playerId) {
      const { data: player, error } = await db().from("players").select("team_id").eq("id", input.playerId).single();
      check(error);
      if (!player) throw new Error("Player not found.");
      const teamOf = (s: Side) => (s === "a" ? match.teamAId : match.teamBId);
      // An own goal is scored by a player of the other team.
      if (player.team_id !== teamOf(input.ownGoal ? other(input.side) : input.side)) {
        throw new Error("That player isn't in the right team for this goal.");
      }
    }

    const { error } = await db().from("goals").insert({
      match_id: matchId,
      side: input.side,
      player_id: input.playerId,
      own_goal: input.ownGoal,
      minute: minute.minute,
      extra: minute.extra,
    });
    check(error);
  });
}

export async function deleteGoal(goalId: string) {
  return adminAction(async () => {
    const { data: goal, error } = await db().from("goals").select("match_id").eq("id", goalId).single();
    check(error, { PGRST116: "That goal was already removed." });
    if (!goal) throw new Error("That goal was already removed.");
    const { match } = await loadMatch(goal.match_id);
    if (match.status !== "live") throw new Error("Reopen the match to change its goals.");
    const { error: deleteError } = await db().from("goals").delete().eq("id", goalId);
    check(deleteError);
  });
}

// ---- Session ----

export async function logout() {
  await endSession();
  redirect("/admin/login");
}
