-- Google refresh tokens for calendar sync. Only the google-token Edge Function
-- (service role) reads or writes this table: RLS is on with no policies, so the
-- app itself can never read a token back.
create table if not exists google_tokens (
  user_id uuid primary key references auth.users on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);
alter table google_tokens enable row level security;
