-- Routine app · Phase 1 schema (Supabase / Postgres)
-- Mirrors the app's local data model so on-device data can sync up later.
-- Every table is locked to its owner with row level security.

create table if not exists profiles (
  user_id uuid primary key references auth.users on delete cascade,
  wake_time time not null default '04:50',
  bed_time time not null default '21:00',
  home_time time not null default '17:00',
  streak_threshold int not null default 80 check (streak_threshold between 50 and 100),
  rest_passes_per_week int not null default 1 check (rest_passes_per_week between 0 and 7),
  default_reminder_lead int not null default 10,
  question_timing text not null default 'after' check (question_timing in ('before', 'after')),
  accountability_level text not null default 'standard' check (accountability_level in ('standard', 'high', 'hard')),
  created_at timestamptz not null default now()
);

create table if not exists template_blocks (
  id text not null,
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  subtitle text,
  category text not null check (category in ('skill', 'reading', 'family', 'chore', 'anchor')),
  days_of_week int[] not null,
  start_min int not null check (start_min % 15 = 0),
  duration_min int not null check (duration_min >= 15 and duration_min % 15 = 0),
  min_duration_min int not null check (min_duration_min >= 15 and min_duration_min % 15 = 0),
  type text not null check (type in ('fixed', 'flexible', 'droppable', 'protected')),
  priority int not null check (priority between 1 and 5),
  checklist text[],
  primary key (user_id, id)
);

create table if not exists day_blocks (
  id text not null,
  user_id uuid not null references auth.users on delete cascade,
  date date not null,
  template_block_id text,
  title text not null,
  category text not null,
  type text not null,
  priority int not null,
  planned_start int not null check (planned_start % 15 = 0),
  duration_min int not null check (duration_min >= 15 and duration_min % 15 = 0),
  status text not null check (status in ('planned', 'done', 'partial', 'skipped', 'missed')),
  note text,
  skip_reason text check (skip_reason in ('event', 'obstacle', 'energy', 'distracted', 'chose-else')),
  excused boolean,
  resistance int check (resistance between 1 and 10),
  energy int check (energy between 1 and 10),
  start_difficulty int check (start_difficulty between 1 and 10),
  did_it_anyway boolean,
  reminder_lead_min int not null default 10,
  checklist_done int[],
  actual_start timestamptz,
  focused_minutes int,
  timer_completed boolean,
  completed_at timestamptz,
  corrections jsonb not null default '[]',
  corrected_at timestamptz,
  primary key (user_id, id)
);
create index if not exists day_blocks_user_date on day_blocks (user_id, date);

create table if not exists daily_scores (
  user_id uuid not null references auth.users on delete cascade,
  date date not null,
  completion_percent numeric,
  daily_score numeric,
  is_streak_day boolean not null default false,
  rest_pass_used boolean not null default false,
  rest_pass_reason text,
  primary key (user_id, date)
);

create table if not exists discipline_snapshots (
  user_id uuid not null references auth.users on delete cascade,
  date date not null,
  discipline_index numeric not null,
  level text not null,
  consistency numeric not null,
  primary key (user_id, date)
);

do $$
declare t text;
begin
  foreach t in array array['profiles', 'template_blocks', 'day_blocks', 'daily_scores', 'discipline_snapshots'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "own rows" on %I', t);
    execute format('create policy "own rows" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;
