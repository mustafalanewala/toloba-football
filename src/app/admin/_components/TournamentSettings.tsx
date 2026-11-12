"use client";

import { useState } from "react";
import { updateHalfMinutes, updateTournamentName } from "../actions";
import { Button, Card, ErrorText, inputClass, useAdminAction } from "./ui";

export function TournamentSettings({ name, halfMinutes }: { name: string; halfMinutes: number }) {
  const [value, setValue] = useState(name);
  const [half, setHalf] = useState(String(halfMinutes));
  const { run, pending, error } = useAdminAction();
  const dirty = value.trim() !== name;
  const halfValue = Number(half);
  const halfDirty = half !== "" && halfValue !== halfMinutes;

  return (
    <Card title="Tournament">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => updateTournamentName(value));
        }}
      >
        <input
          className={inputClass}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Tournament name"
          aria-label="Tournament name"
        />
        <Button type="submit" variant="primary" disabled={!dirty || pending}>
          Save
        </Button>
      </form>
      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => updateHalfMinutes(halfValue));
        }}
      >
        <label htmlFor="half-minutes" className="shrink-0 text-ink-soft">
          Each half
        </label>
        <input
          id="half-minutes"
          className={`${inputClass} w-20`}
          value={half}
          onChange={(e) => setHalf(e.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          maxLength={2}
        />
        <span className="flex-1 text-ink-soft">min</span>
        <Button type="submit" variant="primary" disabled={!halfDirty || pending}>
          Save
        </Button>
      </form>
      <p className="mt-2 text-sm text-ink-soft">Applies to new matches and every match that hasn&apos;t kicked off.</p>
      <ErrorText error={error} />
    </Card>
  );
}
