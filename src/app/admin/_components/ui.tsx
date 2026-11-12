"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "../actions";

/** Runs an admin server action in a transition and tracks its error message. */
export function useAdminAction() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<ActionResult>, onSuccess?: () => void) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        setError(null);
        onSuccess?.();
      } else {
        setError(result.error);
      }
    });

  return { pending, error, run, clearError: () => setError(null) };
}

export function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white p-4 sm:p-5">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-2xl font-semibold">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {error}
    </p>
  );
}

type Variant = "primary" | "secondary" | "danger" | "ghost" | "success" | "unstyled";

const variants: Record<Variant, string> = {
  primary: "bg-toloba text-white hover:bg-toloba-deep",
  success: "bg-ink text-white hover:bg-ink/85",
  secondary: "border border-line bg-white text-ink hover:border-ink-soft/50 hover:bg-background",
  danger: "border border-red-200 bg-white text-red-600 hover:bg-red-50",
  ghost: "text-ink-soft hover:bg-background hover:text-ink",
  unstyled: "",
};

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 font-semibold transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 ${variants[variant]} ${className}`}
    />
  );
}

export const inputClass =
  "w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-base text-ink placeholder:text-ink-soft/70 outline-none transition focus:border-toloba focus:ring-2 focus:ring-toloba/20";
