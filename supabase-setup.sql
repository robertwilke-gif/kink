-- Run this in your Supabase SQL editor

-- Sessions table
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '30 days')
);

-- Responses table
create table if not exists responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  slot integer not null check (slot in (1, 2)),
  name text not null,
  answers jsonb not null default '{}',
  submitted_at timestamptz default now(),
  unique (session_id, slot)
);

-- Custom items table
create table if not exists custom_items (
  id text primary key,
  session_id uuid not null references sessions(id) on delete cascade,
  created_by_slot integer not null check (created_by_slot in (1, 2)),
  label text not null,
  info text not null default '',
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table sessions enable row level security;
alter table responses enable row level security;
alter table custom_items enable row level security;

-- Public access policies (code is the access protection)
create policy "public read sessions" on sessions for select using (true);
create policy "public insert sessions" on sessions for insert with check (true);

create policy "public read responses" on responses for select using (true);
create policy "public insert responses" on responses for insert with check (true);
create policy "public update responses" on responses for update using (true);

create policy "public read custom_items" on custom_items for select using (true);
create policy "public insert custom_items" on custom_items for insert with check (true);
create policy "public delete custom_items" on custom_items for delete using (true);
