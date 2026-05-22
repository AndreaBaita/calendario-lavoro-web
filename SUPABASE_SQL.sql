-- Schema per Calendario Lavoro Web
-- Se hai già creato le tabelle precedenti, puoi eseguire comunque questo SQL.

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password text not null,
  role text not null default 'user',
  approved boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists work_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  date text not null,
  address text,
  lat double precision,
  lng double precision,
  people integer default 1,
  notes text,
  created_at timestamptz default now()
);

alter table profiles enable row level security;
alter table work_days enable row level security;

drop policy if exists "allow all profiles" on profiles;
drop policy if exists "allow all work days" on work_days;

create policy "allow all profiles"
on profiles for all
using (true)
with check (true);

create policy "allow all work days"
on work_days for all
using (true)
with check (true);
