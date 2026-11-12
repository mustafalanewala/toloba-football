export type Side = "a" | "b";

export type Score = { a: number; b: number };

export type MatchStatus = "upcoming" | "live" | "completed";

/** Where a live match is. Upcoming and completed matches have no period. */
export type Period = "first" | "half_time" | "second" | "penalties";

/** group = league match, knockout = a group's semi-final or the Final, friendly = counts nowhere. */
export type MatchStage = "group" | "knockout" | "friendly";

export type KnockoutRound = "semi" | "final";

export const FINAL_LABEL = "Final";

export const semiLabel = (groupName: string) => `${groupName} semi-final`;

export type Group = {
  id: string;
  name: string;
};

export type Team = {
  id: string;
  name: string;
  groupId: string | null;
};

export type Player = {
  id: string;
  teamId: string;
  name: string;
  number: number | null;
};

export type Goal = {
  id: string;
  matchId: string;
  /** The side the goal counts for. For an own goal the player is from the other team. */
  side: Side;
  playerId: string | null;
  ownGoal: boolean;
  minute: number;
  /** Stoppage time, e.g. 2 for 45+2'. */
  extra: number;
  createdAt: string;
};

export type Match = {
  id: string;
  teamAId: string;
  teamBId: string;
  label: string | null;
  stage: MatchStage;
  groupId: string | null;
  round: KnockoutRound | null;
  halfMinutes: number;
  status: MatchStatus;
  period: Period | null;
  firstHalfAt: string | null;
  secondHalfAt: string | null;
  /** Shoot-out score, only for knockout matches level at full time. */
  pens: Score | null;
  winnerId: string | null;
  /** In match order. */
  goals: Goal[];
  createdAt: string;
  updatedAt: string;
};

export type Tournament = {
  name: string;
  halfMinutes: number;
  groups: Group[];
  teams: Team[];
  players: Player[];
  matches: Match[];
};
