"use client";

import { useState } from "react";
import type { Group, Player, Team } from "@/lib/types";
import { addPlayer, addTeam, deletePlayer, deleteTeam, renameTeam, updatePlayer } from "../actions";
import { Button, Card, ErrorText, inputClass, useAdminAction } from "./ui";

export function TeamManager({ teams, groups, players }: { teams: Team[]; groups: Group[]; players: Player[] }) {
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const [name, setName] = useState("");
  const { run, pending, error } = useAdminAction();

  return (
    <Card title={`Teams (${teams.length})`}>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => addTeam(name), () => setName(""));
        }}
      >
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New team name"
          aria-label="New team name"
          maxLength={60}
        />
        <Button type="submit" variant="primary" disabled={!name.trim() || pending}>
          Add
        </Button>
      </form>
      <ErrorText error={error} />

      {teams.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft">No teams yet. Add at least two to create a match.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {teams.map((team) => (
            <TeamRow
              key={team.id}
              team={team}
              group={team.groupId ? groupName.get(team.groupId) : undefined}
              players={players.filter((p) => p.teamId === team.id)}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

function TeamRow({ team, group, players }: { team: Team; group?: string; players: Player[] }) {
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(team.name);
  const { run, pending, error } = useAdminAction();

  return (
    <li className="py-2">
      {editing ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => renameTeam(team.id, value), () => setEditing(false));
          }}
        >
          <input
            autoFocus
            className={inputClass}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label="Team name"
            maxLength={60}
          />
          <Button type="submit" variant="primary" disabled={!value.trim() || pending}>
            Save
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setValue(team.name);
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
          <span className="flex min-w-40 flex-1 items-center gap-2">
            <span className="min-w-0 truncate font-medium">{team.name}</span>
            {group && <span className="shrink-0 rounded-md bg-toloba-soft px-2 py-0.5 text-xs font-semibold text-toloba">{group}</span>}
          </span>
          <Button variant="ghost" className="px-2.5 py-1.5" aria-expanded={open} onClick={() => setOpen(!open)}>
            Players ({players.length})
          </Button>
          <Button variant="ghost" className="px-2.5 py-1.5" onClick={() => setEditing(true)}>
            Rename
          </Button>
          <Button
            variant="danger"
            className="px-2.5 py-1.5"
            disabled={pending}
            onClick={() => {
              if (confirm(`Delete team "${team.name}"?`)) run(() => deleteTeam(team.id));
            }}
          >
            Delete
          </Button>
        </div>
      )}
      <ErrorText error={error} />
      {open && <Roster teamId={team.id} players={players} />}
    </li>
  );
}

const parseNumber = (text: string) => (text.trim() === "" ? null : Number(text));

/** A team's players: shirt number (optional) and name. Goals are credited to these players. */
function Roster({ teamId, players }: { teamId: string; players: Player[] }) {
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const { run, pending, error } = useAdminAction();

  return (
    <div className="mt-2 rounded-lg bg-background p-2.5">
      {players.length === 0 ? (
        <p className="px-1 text-sm text-ink-soft">No players yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {players.map((p) => (
            <PlayerRow key={p.id} player={p} />
          ))}
        </ul>
      )}
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => addPlayer(teamId, name, parseNumber(number)),
            () => {
              setName("");
              setNumber("");
            },
          );
        }}
      >
        <input
          className={`${inputClass} w-16 shrink-0 px-2.5`}
          value={number}
          onChange={(e) => setNumber(e.target.value.replace(/\D/g, ""))}
          placeholder="No."
          aria-label="Shirt number"
          inputMode="numeric"
          maxLength={2}
        />
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Player name"
          aria-label="Player name"
          maxLength={60}
        />
        <Button type="submit" variant="primary" disabled={!name.trim() || pending}>
          Add
        </Button>
      </form>
      <ErrorText error={error} />
    </div>
  );
}

function PlayerRow({ player }: { player: Player }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(player.name);
  const [number, setNumber] = useState(player.number === null ? "" : String(player.number));
  const { run, pending, error } = useAdminAction();

  return (
    <li>
      {editing ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => updatePlayer(player.id, name, parseNumber(number)), () => setEditing(false));
          }}
        >
          <input
            className={`${inputClass} w-16 shrink-0 px-2.5 py-1.5`}
            value={number}
            onChange={(e) => setNumber(e.target.value.replace(/\D/g, ""))}
            aria-label="Shirt number"
            inputMode="numeric"
            maxLength={2}
          />
          <input
            autoFocus
            className={`${inputClass} py-1.5`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Player name"
            maxLength={60}
          />
          <Button type="submit" variant="primary" className="py-1.5" disabled={!name.trim() || pending}>
            Save
          </Button>
          <Button variant="ghost" className="py-1.5" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </form>
      ) : (
        <div className="flex items-center gap-2 rounded-md bg-white px-2.5 py-1">
          <span className="w-6 shrink-0 text-right font-display text-lg font-semibold text-ink-soft tabular-nums">
            {player.number ?? ""}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium">{player.name}</span>
          <Button variant="ghost" className="px-2 py-1 text-sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button
            variant="ghost"
            className="px-2 py-1 text-sm text-red-600"
            disabled={pending}
            onClick={() => {
              if (confirm(`Remove ${player.name}?`)) run(() => deletePlayer(player.id));
            }}
          >
            Remove
          </Button>
        </div>
      )}
      <ErrorText error={error} />
    </li>
  );
}
