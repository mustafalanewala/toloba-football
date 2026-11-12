import { Suspense } from "react";
import { connection } from "next/server";
import { LiveBoard } from "@/components/LiveBoard";
import { loadTournament } from "@/lib/data";
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/supabase/server";

export default function Home() {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <Board />
    </Suspense>
  );
}

async function Board() {
  await connection();
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const { tournament, error } = await loadTournament();
  if (!tournament) return <UnavailableNotice error={error} />;
  return <LiveBoard initial={tournament} supabaseUrl={getSupabaseUrl()} supabaseKey={getSupabaseAnonKey()} />;
}

function BoardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl animate-pulse px-4 py-8 sm:px-6 lg:px-8">
      <div className="h-10 w-72 max-w-full rounded-xl bg-slate-200/60" />
      <div className="mx-auto mt-12 h-80 max-w-3xl rounded-xl bg-slate-200/60" />
      <div className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-slate-200/60" />
        ))}
      </div>
    </div>
  );
}

function SetupNotice() {
  return (
    <div className="mx-auto mt-24 max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
      <h1 className="text-lg font-bold">Supabase isn&apos;t configured yet</h1>
      <p className="mt-2 text-amber-800">
        Run <code className="font-mono">supabase/schema.sql</code> in your Supabase project, then set{" "}
        <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
        <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> and{" "}
        <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code>.
      </p>
    </div>
  );
}

function UnavailableNotice({ error }: { error: string }) {
  return (
    <div className="mx-auto mt-24 max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
      <h1 className="text-lg font-bold">Scores are temporarily unavailable</h1>
      <p className="mt-2 text-amber-800">Please refresh in a moment.</p>
      <p className="mt-3 font-mono text-xs break-words text-amber-700">{error}</p>
    </div>
  );
}
