// Group tables, the semi-final line-up and top scorers.
// Pure functions, shared by the dashboard, the admin panel and the server actions.
//
// Format (8 teams):
//   - 2 groups of 4, round-robin (6 matches per group).
//   - Each group's top two play that group's semi-final (1st v 2nd).
//   - The two semi-final winners play the Final. Level knockout matches go straight to penalties.
//
// Ranking: 3 points for a win, 1 for a draw. Ties are broken by, in order:
//   1. Goal difference  2. Goals scored  3. Head-to-head between the tied teams (points, goal difference, goals)
//   4. Coin toss (flagged for the admin when it decides a semi-final spot)
import { score } from "./scoring";
import type { Group, Match, Player, Team } from "./types";

export const MAX_TEAMS_PER_GROUP = 4;
export const QUALIFIERS_PER_GROUP = 2;

export type StandingRow = {
  team: Team;
  rank: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  /** Level on every rule across the semi-final cut-off once the group is complete: needs a coin toss. */
  tie: boolean;
  /** A tie the admin already settled by coin toss (when creating the semi-final). */
  toss: boolean;
};

export type GroupTable = {
  group: Group;
  rows: StandingRow[];
  played: number;
  total: number;
  complete: boolean;
};

export type QualificationStatus = "qualified" | "out";

export type GroupSemi = {
  group: Group;
  table: GroupTable;
  match: Match | null;
};

export type Qualification = {
  groupStageComplete: boolean;
  semis: GroupSemi[];
  final: Match | null;
  status: Map<string, { status: QualificationStatus; final: boolean }>;
  /** Plain-language notes about ties only a coin toss can settle. */
  coinTosses: string[];
};

/** Points, goal difference, goals scored. Negative when `a` ranks higher. */
export function compareRows(a: StandingRow, b: StandingRow) {
  return b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor;
}

const byName = (a: StandingRow, b: StandingRow) => a.team.name.localeCompare(b.team.name);

function tally(members: Team[], counted: Match[]) {
  const rows = new Map<string, StandingRow>(
    members.map((team) => [
      team.id,
      {
        team,
        rank: 0,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDiff: 0,
        points: 0,
        tie: false,
        toss: false,
      },
    ]),
  );

  for (const m of counted) {
    const a = rows.get(m.teamAId);
    const b = rows.get(m.teamBId);
    if (!a || !b) continue; // a team that left the table, or outside a head-to-head mini table
    const s = score(m);
    a.played++;
    b.played++;
    a.goalsFor += s.a;
    a.goalsAgainst += s.b;
    b.goalsFor += s.b;
    b.goalsAgainst += s.a;
    if (s.a > s.b) {
      a.won++;
      b.lost++;
    } else if (s.b > s.a) {
      b.won++;
      a.lost++;
    } else {
      a.drawn++;
      b.drawn++;
    }
  }

  for (const r of rows.values()) {
    r.goalDiff = r.goalsFor - r.goalsAgainst;
    r.points = r.won * 3 + r.drawn;
  }
  return rows;
}

/** Splits rows (already sorted by `cmp`) into runs that `cmp` can't separate. */
function blocks<T>(sorted: T[], cmp: (a: T, b: T) => number) {
  const out: T[][] = [];
  for (const r of sorted) {
    const last = out.at(-1);
    if (last && cmp(last[0], r) === 0) last.push(r);
    else out.push([r]);
  }
  return out;
}

/**
 * Orders teams level on the main rules by a mini table of the matches between them, re-applied to
 * any smaller group still level. Returns the order, plus the sets nothing could separate.
 */
function headToHead(block: StandingRow[], counted: Match[]): { order: StandingRow[]; level: StandingRow[][] } {
  if (block.length < 2) return { order: block, level: [] };
  const mini = tally(
    block.map((r) => r.team),
    counted,
  );
  const cmp = (a: StandingRow, b: StandingRow) => compareRows(mini.get(a.team.id)!, mini.get(b.team.id)!);
  const order: StandingRow[] = [];
  const level: StandingRow[][] = [];
  for (const sub of blocks([...block].sort((a, b) => cmp(a, b) || byName(a, b)), cmp)) {
    if (sub.length === block.length) {
      order.push(...sub);
      level.push(sub);
    } else {
      const inner = headToHead(sub, counted);
      order.push(...inner.order);
      level.push(...inner.level);
    }
  }
  return { order, level };
}

function buildTable(group: Group, members: Team[], stageMatches: Match[]): GroupTable {
  const counted = stageMatches.filter((m) => m.status === "completed");
  const total = (members.length * (members.length - 1)) / 2;
  const list = [...tally(members, counted).values()].sort((a, b) => compareRows(a, b) || byName(a, b));

  const rows: StandingRow[] = [];
  const level: StandingRow[][] = [];
  for (const block of blocks(list, compareRows)) {
    const h2h = headToHead(block, counted);
    rows.push(...h2h.order);
    level.push(...h2h.level);
  }
  rows.forEach((r, i) => (r.rank = i + 1));

  const complete =
    members.length >= 2 && counted.length >= total && stageMatches.every((m) => m.status === "completed");
  if (complete) {
    // Only a tie across the cut-off matters: it decides who plays the semi-final.
    for (const set of level) {
      const ranks = set.map((r) => r.rank);
      if (Math.min(...ranks) <= QUALIFIERS_PER_GROUP && Math.max(...ranks) > QUALIFIERS_PER_GROUP) {
        set.forEach((r) => (r.tie = true));
      }
    }
  }
  return { group, rows, played: counted.length, total, complete };
}

/** The teams a group's semi-final may use: the places that are certain, plus a pool to pick from after a coin toss. */
export function semiCandidates(table: GroupTable) {
  const pool = table.rows.filter((r) => r.tie);
  const fixed = table.rows.slice(0, QUALIFIERS_PER_GROUP).filter((r) => !r.tie);
  return { fixed, pool, need: QUALIFIERS_PER_GROUP - fixed.length };
}

/** After a coin toss, the teams the admin put in the semi-final are shown in the top two. */
function applyCoinTossChoice(table: GroupTable, semi: Match) {
  const tied = table.rows.filter((r) => r.tie);
  if (tied.length === 0) return;
  const chosen = new Set([semi.teamAId, semi.teamBId]);
  const ordered = [...tied.filter((r) => chosen.has(r.team.id)), ...tied.filter((r) => !chosen.has(r.team.id))];
  const start = table.rows.indexOf(tied[0]);
  table.rows.splice(start, ordered.length, ...ordered);
  table.rows.forEach((r, i) => (r.rank = i + 1));
  ordered.forEach((r) => {
    r.tie = false;
    r.toss = true;
  });
}

export const findSemi = (matches: Match[], groupId: string) =>
  matches.find((m) => m.round === "semi" && m.groupId === groupId) ?? null;

export const findFinal = (matches: Match[]) => matches.find((m) => m.round === "final") ?? null;

export function groupStandings(groups: Group[], teams: Team[], matches: Match[]): GroupTable[] {
  return groups.map((group) => {
    const members = teams.filter((t) => t.groupId === group.id);
    const stageMatches = matches.filter((m) => m.stage === "group" && m.groupId === group.id);
    const table = buildTable(group, members, stageMatches);
    const semi = findSemi(matches, group.id);
    if (table.complete && semi) applyCoinTossChoice(table, semi);
    return table;
  });
}

export function qualification(tables: GroupTable[], matches: Match[]): Qualification {
  const groupStageComplete = tables.length > 0 && tables.every((t) => t.complete);
  const status: Qualification["status"] = new Map();
  const coinTosses: string[] = [];

  for (const t of tables) {
    // Before a group's first result, alphabetical order would look like a ranking: show nothing yet.
    if (t.played === 0) continue;
    t.rows.forEach((r, i) =>
      status.set(r.team.id, { status: i < QUALIFIERS_PER_GROUP ? "qualified" : "out", final: t.complete && !r.tie }),
    );
    const tied = t.rows.filter((r) => r.tie).map((r) => r.team.name);
    if (tied.length) {
      coinTosses.push(
        `${t.group.name}: ${tied.join(" and ")} are level on every rule. Toss a coin, then pick the semi-finalists when creating the semi-final.`,
      );
    }
  }

  return {
    groupStageComplete,
    semis: tables.map((t) => ({ group: t.group, table: t, match: findSemi(matches, t.group.id) })),
    final: findFinal(matches),
    status,
    coinTosses,
  };
}

export type ScorerRow = { player: Player; team: Team | undefined; goals: number };

/** Goals in group and knockout matches; own goals and friendlies don't count. */
export function topScorers(players: Player[], teams: Team[], matches: Match[]): ScorerRow[] {
  const goals = new Map<string, number>();
  for (const m of matches) {
    if (m.stage === "friendly" || m.status === "upcoming") continue;
    for (const g of m.goals) {
      if (g.playerId && !g.ownGoal) goals.set(g.playerId, (goals.get(g.playerId) ?? 0) + 1);
    }
  }
  return players
    .filter((p) => goals.has(p.id))
    .map((p) => ({ player: p, team: teams.find((t) => t.id === p.teamId), goals: goals.get(p.id)! }))
    .sort((x, y) => y.goals - x.goals || x.player.name.localeCompare(y.player.name));
}

/** Round-robin pairs in a play order that spreads each team's matches out. */
export function roundRobinPairs<T>(items: T[]): [T, T][] {
  const [a, b, c, d] = items;
  if (items.length === 3) return [[a, b], [b, c], [c, a]];
  if (items.length === 4) return [[a, b], [c, d], [a, c], [b, d], [a, d], [b, c]];
  const pairs: [T, T][] = [];
  for (let gap = 1; gap < items.length; gap++) {
    for (let i = 0; i + gap < items.length; i++) pairs.push([items[i], items[i + gap]]);
  }
  return pairs;
}

/**
 * Each stage feeds the next, so a result can't change once the next stage was built from it:
 * group results → that group's semi-final → Final. Returns why a match is locked, or null.
 */
export function lockReason(match: Match, matches: Match[]): string | null {
  if (match.stage === "group" && match.groupId) {
    const semi = findSemi(matches, match.groupId);
    if (semi) return `The ${semi.label ?? "semi-final"} was created from these results. Delete it first.`;
  }
  if (match.round === "semi" && findFinal(matches)) {
    return "The Final was created from the semi-final results. Delete the Final first.";
  }
  return null;
}
