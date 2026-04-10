-- Tabla de integraciones OAuth (Instagram, Google Calendar)
create table if not exists integrations (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique, -- 'instagram' | 'google_calendar'
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  metadata jsonb default '{}', -- ig_user_id, ig_account_id, selected_calendar_ids, etc.
  connected_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table integrations enable row level security;
create policy "allow all" on integrations for all using (true) with check (true);

create trigger integrations_updated_at
  before update on integrations
  for each row execute function update_updated_at();
