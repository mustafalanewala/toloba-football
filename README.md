# Toloba Football — Live Scoreboard

A live scoreboard for a football tournament.

- **`/`**: public dashboard. Live matches are shown first with the match clock and scorers, then the semi-finals and Final, the group tables, top scorers, upcoming matches and results. It updates instantly through Supabase Realtime.
- **`/admin`**: scorer panel, where you add teams and players, generate fixtures, run the match clock and record goals.

## Admin login

The credentials are hardcoded in `src/lib/auth.ts`:

| Username | Password     |
| -------- | ------------ |
| `admin`  | `toloba@123` |

You can override them with the `ADMIN_USERNAME`, `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` env vars.

## Setup

1. **Create a Supabase project** at https://supabase.com.
2. **Create the tables:** open the Supabase dashboard, go to **SQL Editor → New query**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and click **Run**. It's safe to run more than once.
3. **Add env vars:** create `.env.local` with these values from **Project Settings → API Keys**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: the anon or publishable key
   - `SUPABASE_SERVICE_ROLE_KEY`: the service_role or secret key. Use it on the server only and never expose it.
4. Run the app:
   ```bash
   npm install
   npm run dev
   ```
   Then open http://localhost:3000 for the dashboard and http://localhost:3000/admin for the panel.

## Deploying to Vercel

1. Push the repo to GitHub and import it into Vercel. The framework (Next.js) is detected automatically.
2. Under **Project Settings → Environment Variables**, add the 3 Supabase vars above. Alternatively, install the Supabase integration, which adds them for you.
3. Set `ADMIN_PASSWORD` (and optionally `ADMIN_USERNAME`) so the public repo's default login doesn't work in production.
4. Deploy.

`vercel.json` runs the server functions in Sydney (`syd1`), next to the Supabase project (`ap-southeast-2`), so every scorer tap is one short round-trip. If the Supabase project is ever moved, change the region to match.

Live updates use Supabase Realtime, with a fallback: the board refetches when the tab comes back into view, when the device comes back online, and every few seconds while realtime is down. The scorer panel stays in sync with other scorers' phones the same way.

## Tournament format

8 teams, 15 matches: group stage (12), one semi-final per group (2) and the Final (1).

**1. Group stage.** Two groups of 4 play a round-robin, so every team plays 3 matches.

1. Add the teams in **Teams**, and each team's players under **Players** (shirt number is optional).
2. In **Groups**, click **Create Groups A and B**, then add 4 teams to each group.
3. Click **Generate fixtures** for each group. It creates all 6 matches in a spread-out order and never makes duplicates.

**Ranking rules:**

1. Points (3 for a win, 1 for a draw)
2. Goal difference
3. Goals scored
4. Head-to-head between the tied teams (points, goal difference, goals scored in their matches)
5. Coin toss, which the panel flags only when it decides a semi-final spot

**2. Semi-finals.** Each group's 1st and 2nd play that group's semi-final. When every match in a group is completed, **Semi-finals & Final** lets you create it. If 2nd and 3rd are level on every rule, it asks you to tick the team that won the coin toss.

**3. Final.** Unlocks when both semi-finals are completed and is created with the two winners.

A semi-final or Final that's level at full time goes straight to penalties.

**Locks: nothing can change underneath a later stage.**

- A group's results lock when its semi-final exists.
- Semi-final results lock when the Final exists.

To correct an old result, delete the later match first (possible only before it kicks off).

## Running a match

- **Kick-off** starts the clock. Then **Half time**, **Start 2nd half** and **Full time**. The button pulses once the half's time is up, and the clock shows stoppage time, e.g. `45+2'`.
- **+ Goal** opens the scorer picker with the minute pre-filled from the clock. Tick **Own goal** to pick a player from the other team, or choose **Unknown player**. Goals can be removed from the list below.
- In a level knockout match, **Full time** starts the shoot-out: tap + for each penalty scored, then **End shoot-out**.
- The second button steps back one period if you tapped by mistake, or **Reopen**s a finished match. **Reset** clears the clock and all goals.
- Half length is set under **Tournament** and applies to every match that hasn't kicked off.
- Changes are refused if the match changed on another device in the meantime.

## Security model

- The public dashboard reads data with the anon key. Row-level security allows reads only.
- All writes go through server actions that check the signed admin session cookie and then use the service-role key.
- `src/proxy.ts` redirects anyone who isn't logged in away from `/admin`.
