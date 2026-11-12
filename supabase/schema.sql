-- Toloba football scoreboard schema.
-- Run this once in the Supabase dashboard: SQL Editor → New query → paste → Run.

create extension if not exists pgcrypto;

-- Single-row table for tournament-wide settings.
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  tournament_name text not null default 'Football Tournament',
  -- Length of each half in minutes, copied onto every match when it's created.
  half_minutes smallint not null default 15 check (half_minutes between 1 and 60)
);

insert into public.settings (id, tournament_name)
values (1, 'Toloba Football Tournament')
on conflict (id) do nothing;

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) > 0),
  group_id uuid references public.groups (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  number smallint check (number between 0 and 99),
  created_at timestamptz not null default now()
);

create index if not exists players_team_idx on public.players (team_id);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  team_a_id uuid not null references public.teams (id) on delete restrict,
  team_b_id uuid not null references public.teams (id) on delete restrict,
  label text,
  -- group = league match, knockout = a group's semi-final or the Final, friendly = counts nowhere.
  stage text not null default 'friendly' check (stage in ('group', 'knockout', 'friendly')),
  group_id uuid references public.groups (id) on delete restrict,
  round text check (round in ('semi', 'final')),
  half_minutes smallint not null default 15 check (half_minutes between 1 and 60),
  status text not null default 'upcoming' check (status in ('upcoming', 'live', 'completed')),
  period text check (period in ('first', 'half_time', 'second', 'penalties')),
  first_half_at timestamptz,
  second_half_at timestamptz,
  pens_a smallint check (pens_a >= 0),
  pens_b smallint check (pens_b >= 0),
  winner_id uuid references public.teams (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (team_a_id <> team_b_id),
  check (round is null or stage = 'knockout'),
  check (round is distinct from 'semi' or group_id is not null)
);

-- One semi-final per group, one Final.
create unique index if not exists matches_semi_key on public.matches (group_id) where round = 'semi';
create unique index if not exists matches_final_key on public.matches (round) where round = 'final';

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  -- The side the goal counts for. For an own goal the player is from the other team.
  side text not null check (side in ('a', 'b')),
  player_id uuid references public.players (id) on delete restrict,
  own_goal boolean not null default false,
  minute smallint not null check (minute between 0 and 200),
  extra smallint not null default 0 check (extra between 0 and 30),
  created_at timestamptz not null default now()
);

create index if not exists goals_match_idx on public.goals (match_id);

-- Row Level Security: the public (anon key) may only read.
-- All writes happen on the server with the service-role key, which bypasses RLS.
do $$
declare t text;
begin
  foreach t in array array['settings', 'groups', 'teams', 'players', 'matches', 'goals'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Public read %s" on public.%I', t, t);
    execute format('create policy "Public read %s" on public.%I for select to anon, authenticated using (true)', t, t);
  end loop;
end $$;

-- Realtime: broadcast row changes so the dashboard updates instantly.
do $$
declare t text;
begin
  foreach t in array array['settings', 'groups', 'teams', 'players', 'matches', 'goals'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
