-- Gemsafety core schema.
--
-- Design:
--  * All data lives in the private `app` schema, which the Supabase REST API
--    does not expose. Row level security is enabled on every table with no
--    policies, so the anon / authenticated roles cannot read or write it.
--  * The browser talks to the database only through the `public.gs_*`
--    functions below (SECURITY DEFINER). Each one checks a session token and
--    applies role-based read/write rules before touching the data.
--  * Passwords are bcrypt-hashed (pgcrypto). Session tokens are random and
--    only their SHA-256 hash is stored.
--  * Records are stored as JSON documents per collection, matching the
--    app's data model, so features can evolve without schema churn.
--
-- Idempotent: safe to run more than once.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists app;
create table if not exists app.records (
  collection text not null,
  id text not null,
  data jsonb not null,
  owner_id text,
  deleted boolean not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  updated_by text,
  primary key (collection, id)
);
create index if not exists records_updated_idx on app.records (updated_at);
create index if not exists records_owner_idx on app.records (collection, owner_id);
create index if not exists records_user_civil_idx on app.records ((data->>'civilId')) where collection = 'users';
create index if not exists records_user_email_idx on app.records (lower(data->>'email')) where collection = 'users';

create table if not exists app.credentials (
  user_id text primary key,
  login text not null unique,
  password_hash text not null,
  must_change boolean not null default false,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app.sessions (
  token_hash text primary key,
  user_id text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists sessions_user_idx on app.sessions (user_id);

create table if not exists app.activation_attempts (
  civil_id text primary key,
  failures int not null default 0,
  locked_until timestamptz
);

alter table app.records enable row level security;
alter table app.credentials enable row level security;
alter table app.sessions enable row level security;
alter table app.activation_attempts enable row level security;
