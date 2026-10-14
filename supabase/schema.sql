-- COMPLEXO AMERICA RP — WHITELIST
-- Execute no SQL Editor do projeto Supabase.
-- As tabelas privadas não permitem leitura pública. A inscrição e consulta passam pelas Edge Functions.

create extension if not exists pgcrypto;

create table if not exists public.wl_submissions (
  id uuid primary key default gen_random_uuid(),
  tracking_code_hash text not null unique,
  full_name text not null,
  age integer not null check (age between 13 and 99),
  discord_tag text,
  discord_id text,
  rules_read boolean not null default false,
  rp_experience text not null,
  character_type text not null,
  character_story text not null,
  q_metagaming text not null,
  q_value_life text not null,
  q_conflict text not null,
  q_bug text not null,
  motivation text not null,
  score integer not null default 0 check (score between 0 and 100),
  status text not null default 'pending' check (status in ('pending','approved','rejected','interview')),
  public_note text,
  staff_note text,
  reviewer_discord_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wl_submissions_created_at_idx on public.wl_submissions (created_at desc);
create index if not exists wl_submissions_status_idx on public.wl_submissions (status);
create index if not exists wl_submissions_discord_id_idx on public.wl_submissions (discord_id) where discord_id is not null;

create table if not exists public.wl_interviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.wl_submissions(id) on delete cascade,
  requested_at timestamptz not null default now(),
  preferred_time text,
  status text not null default 'requested' check (status in ('requested','scheduled','completed','cancelled')),
  staff_note text,
  created_at timestamptz not null default now()
);

create table if not exists public.wl_history (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.wl_submissions(id) on delete cascade,
  previous_status text,
  new_status text not null,
  actor_discord_id text,
  note text,
  created_at timestamptz not null default now()
);

alter table public.wl_submissions enable row level security;
alter table public.wl_interviews enable row level security;
alter table public.wl_history enable row level security;

-- Sem policies para anon/authenticated: acesso direto pelo navegador é bloqueado.
-- Edge Functions usam SUPABASE_SERVICE_ROLE_KEY somente no servidor.
revoke all on public.wl_submissions from anon, authenticated;
revoke all on public.wl_interviews from anon, authenticated;
revoke all on public.wl_history from anon, authenticated;

create or replace function public.wl_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists wl_submissions_touch_updated_at on public.wl_submissions;
create trigger wl_submissions_touch_updated_at before update on public.wl_submissions
for each row execute function public.wl_touch_updated_at();

-- A pontuação é calculada novamente no servidor. Esta função é ilustrativa para auditoria/admin.
create or replace function public.wl_score_answers(
  p_metagaming text, p_value_life text, p_conflict text, p_bug text,
  p_story text, p_motivation text, p_rules_read boolean
) returns integer language sql immutable as $$
  select least(100,
    (case when p_metagaming = 'correct' then 20 else 0 end) +
    (case when p_value_life = 'correct' then 20 else 0 end) +
    (case when p_conflict = 'correct' then 20 else 0 end) +
    (case when p_bug = 'correct' then 20 else 0 end) +
    (case when length(trim(coalesce(p_story,''))) >= 80 then 10
          when length(trim(coalesce(p_story,''))) >= 30 then 6 else 0 end) +
    (case when length(trim(coalesce(p_motivation,''))) >= 60 then 10
          when length(trim(coalesce(p_motivation,''))) >= 20 then 6 else 0 end) +
    (case when p_rules_read then 0 else 0 end)
  );
$$;

-- Nota: não crie policies públicas de SELECT para consultar status por código.
-- Configure Edge Functions com segredo e validação, conforme os arquivos em supabase/functions.
