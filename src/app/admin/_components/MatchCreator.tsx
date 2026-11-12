"use client";

import { useState } from "react";
import type { Group, Team } from "@/lib/types";
import { createMatch, type NewMatch } from "../actions";
import { Button, Card, ErrorText, inputClass, useAdminAction } from "./ui";

type Kind = NewMatch["kind"];

const KINDS: { kind: Kind; label: string }[] = [
  { kind: "group", label: "Group" },
  { kind: "friendly", label: "Friendly" },
];

type Props = { teams: Team[]; groups: Group[] };

export function MatchCreator({ teams, groups }: Props) {
  const [kind, setKind] = useState<Kind>(groups.length ? "group" : "friendly");
  const [groupId, setGroupId] = useState("");
  const [teamAId, setTeamAId] = useState("");
  const [teamBId, setTeamBId] = useState("");
  const [label, setLabel] = useState("");
  const { run, pending, error } = useAdminAction();

  const resetTeams = () => {
    setTeamAId("");
    setTeamBId("");
  };

  const pool = kind === "group" ? teams.filter((t) => groupId && t.groupId === groupId) : teams;
  const valid = teamAId && teamBId && teamAId !== teamBId && (kind !== "group" || groupId);

  const submit = () => {
    const input: NewMatch =
      kind === "group" ? { kind, groupId, teamAId, teamBId } : { kind, label, teamAId, teamBId };
    run(
      () => createMatch(input),
      () => {
        resetTeams();
        setLabel("");
      },
    );
  };

  if (teams.length < 2) {
    return (
      <Card title="New match">
        <p className="text-ink-soft">Add at least two teams first.</p>
      </Card>
    );
  }

  return (
    <Card title="New match">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Segmented
          options={KINDS.map((k) => ({ value: k.kind, label: k.label }))}
          value={kind}
          onChange={(k) => {
            setKind(k);
            resetTeams();
          }}
        />

        {kind === "group" &&
          (groups.length === 0 ? (
            <p className="text-sm text-ink-soft">Create groups in the Groups panel first.</p>
          ) : (
            <select
              className={inputClass}
              value={groupId}
              aria-label="Group"
              onChange={(e) => {
                setGroupId(e.target.value);
                resetTeams();
              }}
            >
              <option value="">Choose group</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          ))}

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <TeamSelect label="Team A" value={teamAId} onChange={setTeamAId} teams={pool} exclude={teamBId} />
          <span className="text-sm text-ink-soft">vs</span>
          <TeamSelect label="Team B" value={teamBId} onChange={setTeamBId} teams={pool} exclude={teamAId} />
        </div>

        {kind === "friendly" && (
          <input
            className={inputClass}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional), e.g. Exhibition"
            aria-label="Match label"
            maxLength={40}
          />
        )}

        <Button type="submit" variant="primary" disabled={!valid || pending} className="py-2.5">
          Create match
        </Button>
        <p className="text-sm text-ink-soft">
          {kind === "friendly"
            ? "Friendly matches don't count in the tables or top scorers."
            : "Usually not needed: Generate fixtures in Groups creates every group match. Semi-finals and the Final are created in their own panel."}
        </p>
      </form>
      <ErrorText error={error} />
    </Card>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg border border-line bg-background p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-md px-3 py-1.5 font-semibold transition ${
            value === o.value ? "bg-toloba text-white" : "text-ink-soft hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function TeamSelect({
  label,
  value,
  onChange,
  teams,
  exclude,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  teams: Team[];
  exclude: string;
}) {
  return (
    <select className={`${inputClass} min-w-0`} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <option value="">{label}</option>
      {teams.map((t) => (
        <option key={t.id} value={t.id} disabled={t.id === exclude}>
          {t.name}
        </option>
      ))}
    </select>
  );
}
