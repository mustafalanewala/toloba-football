import "server-only";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { fetchTournament } from "./queries";
import { getServerSupabase } from "./supabase/server";
import type { Tournament } from "./types";

/** Always-fresh tournament data. Call inside a <Suspense> boundary. */
export async function getTournament() {
  await connection();
  return fetchTournament(getServerSupabase());
}

/** Like getTournament, but returns the error instead of crashing the page (e.g. a missed migration). */
export async function loadTournament(): Promise<{ tournament: Tournament; error: null } | { tournament: null; error: string }> {
  try {
    return { tournament: await getTournament(), error: null };
  } catch (e) {
    unstable_rethrow(e);
    console.error(e);
    return { tournament: null, error: e instanceof Error ? e.message : "Could not load the tournament." };
  }
}
