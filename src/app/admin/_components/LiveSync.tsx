"use client";

import { useRouter } from "next/navigation";
import { useLiveUpdates } from "@/lib/useLiveUpdates";

/** Keeps the scorer panel in step with changes from other devices; flags a dropped connection. */
export function LiveSync({ supabaseUrl, supabaseKey }: { supabaseUrl: string; supabaseKey: string }) {
  const router = useRouter();
  const connection = useLiveUpdates(supabaseUrl, supabaseKey, () => router.refresh());
  if (connection !== "offline") return null;
  return (
    <p
      role="status"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-sm rounded-full bg-ink px-4 py-2 text-center text-sm font-semibold text-white shadow-lg"
    >
      Reconnecting… scores still save, the panel refreshes every few seconds.
    </p>
  );
}
