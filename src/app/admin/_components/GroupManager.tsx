"use client";

import { MAX_TEAMS_PER_GROUP } from "@/lib/standings";
import type { Group, Match, Team } from "@/lib/types";
import {
  createDefaultGroups,
  deleteGroup,
  generateGroupFixtures,
  renameGroup,
  setTeamGroup,
} from "../actions";
import { Button, Card, ErrorText, inputClass, useAdminAction } from "./ui";

type Props = { groups: Group[]; teams: Team[]; matches: Match[] };

export function GroupManager({ groups, teams, matches }: Props) {
  const { run, pending, error } = useAdminAction();
  const unassigned = teams.filter((t) => !t.groupId);

  return (
    <Card title="Groups">
      {groups.length < 2 && (
        <Button variant="primary" className="mb-3 w-full py-2.5" disabled={pending} onClick={() => run(createDefaultGroups)}>
          Create Groups A and B
        </Button>
      )}

      <div className="flex flex-col gap-3">
        {groups.map((g) => (
          <GroupCard
            key={g.id}
            group={g}
            members={teams.filter((t) => t.groupId === g.id)}
            unassigned={unassigned}
            matches={matches.filter((m) => m.stage === "group" && m.groupId === g.id)}
          />
        ))}
      </div>

      <ErrorText error={error} />
      {groups.length > 0 && unassigned.length > 0 && (
        <p className="mt-2 text-sm text-ink-soft">
          {unassigned.length} team{unassigned.length === 1 ? "" : "s"} not in a group yet.
        </p>
      )}
    </Card>
  );
}

function GroupCard({
  group,
  members,
  unassigned,
  matches,
}: {
  group: Group;
  members: Team[];
  unassigned: Team[];
  matches: Match[];
}) {
  const { run, pending, error } = useAdminAction();
  const needed = (members.length * (members.length - 1)) / 2;
  const full = members.length >= MAX_TEAMS_PER_GROUP;
  const fixturesDone = members.length >= 2 && matches.length >= needed;
  const playedTeams = new Set(matches.flatMap((m) => [m.teamAId, m.teamBId]));

  return (
    <section className="rounded-lg border border-line p-3">
      <header className="flex items-center gap-2">
        <h3 className="min-w-0 flex-1 truncate font-display text-xl font-semibold">{group.name}</h3>
        <span className="text-sm text-ink-soft">
          {members.length}/{MAX_TEAMS_PER_GROUP}
        </span>
        <Button
          variant="ghost"
          className="px-2 py-1 text-sm"
          onClick={() => {
            const next = prompt("Rename group", group.name);
            if (next && next.trim() !== group.name) run(() => renameGroup(group.id, next));
          }}
        >
          Rename
        </Button>
        <Button
          variant="ghost"
          className="px-2 py-1 text-sm text-red-600"
          disabled={pending || matches.length > 0}
          title={matches.length > 0 ? "Delete this group's matches first" : undefined}
          onClick={() => {
            if (confirm(`Delete ${group.name}? Its teams will become unassigned.`)) run(() => deleteGroup(group.id));
          }}
        >
          Delete
        </Button>
      </header>

      <ul className="mt-2 flex flex-col gap-1">
        {members.map((t) => (
          <li key={t.id} className="flex items-center gap-2 rounded-md bg-background px-2.5 py-1.5">
            <span className="min-w-0 flex-1 truncate font-medium">{t.name}</span>
            {!playedTeams.has(t.id) && (
              <button
                type="button"
                disabled={pending}
                className="text-sm font-semibold text-ink-soft hover:text-red-600"
                onClick={() => run(() => setTeamGroup(t.id, null))}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      {!full && (
        <select
          className={`${inputClass} mt-2`}
          value=""
          disabled={pending || unassigned.length === 0}
          aria-label={`Add team to ${group.name}`}
          onChange={(e) => e.target.value && run(() => setTeamGroup(e.target.value, group.id))}
        >
          <option value="">{unassigned.length ? "+ Add team to this group" : "All teams are in groups"}</option>
          {unassigned.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-sm text-ink-soft">
          {members.length < 2 ? "Needs at least 2 teams" : `${Math.min(matches.length, needed)}/${needed} fixtures created`}
        </span>
        <Button
          className="py-1.5 text-sm"
          variant={fixturesDone ? "secondary" : "primary"}
          disabled={pending || members.length < 2 || fixturesDone}
          onClick={() => run(() => generateGroupFixtures(group.id))}
        >
          {fixturesDone ? "Fixtures ready" : "Generate fixtures"}
        </Button>
      </div>
      <ErrorText error={error} />
    </section>
  );
}
