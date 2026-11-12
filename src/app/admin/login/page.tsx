import { Logo } from "@/components/Logo";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Admin login — Toloba Football" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-xl border border-line bg-white p-6 sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo className="size-20" />
          <h1 className="mt-4 font-display text-3xl font-semibold">Scorer sign in</h1>
          <p className="mt-1 text-ink-soft">Manage teams, players, matches and live scores</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
