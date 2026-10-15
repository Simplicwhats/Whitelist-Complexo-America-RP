-- COMPLEXO AMERICA RP — WHITELIST AUTOMÁTICA + PAINEL ADMIN
-- Execute no SQL Editor do Supabase. Não coloque service_role no frontend.
create extension if not exists pgcrypto;

create table if not exists public.wl_submissions (
 id uuid primary key default gen_random_uuid(), tracking_code_hash text not null unique,
 full_name text not null, age integer not null check(age between 13 and 99), discord_tag text, discord_id text, fivem_id text,
 rules_read boolean not null default false, rp_experience text not null, character_type text not null,
 character_story text not null, q_metagaming text not null, q_value_life text not null, q_conflict text not null,
 q_bug text not null, motivation text not null, score integer not null default 0 check(score between 0 and 100),
 status text not null default 'pending' check(status in ('pending','approved','rejected','interview')),
 public_note text, staff_note text, reviewer_discord_id text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- Migração segura para quem já executou a primeira versão do projeto.
alter table public.wl_submissions add column if not exists q_rdm text not null default 'wrong1';
alter table public.wl_submissions add column if not exists q_powergaming text not null default 'wrong1';
alter table public.wl_submissions add column if not exists q_approach text not null default 'wrong1';
alter table public.wl_submissions add column if not exists q_injury text not null default 'wrong1';
alter table public.wl_submissions add column if not exists q_disconnect text not null default 'wrong1';
alter table public.wl_submissions add column if not exists q_community text not null default 'wrong1';
create index if not exists wl_submissions_created_at_idx on public.wl_submissions(created_at desc);
create index if not exists wl_submissions_status_idx on public.wl_submissions(status);
create index if not exists wl_submissions_discord_id_idx on public.wl_submissions(discord_id) where discord_id is not null;

create table if not exists public.wl_interviews (
 id uuid primary key default gen_random_uuid(), submission_id uuid not null references public.wl_submissions(id) on delete cascade,
 requested_at timestamptz not null default now(), preferred_time text,
 status text not null default 'requested' check(status in ('requested','scheduled','completed','cancelled')),
 staff_note text, created_at timestamptz not null default now()
);
create table if not exists public.wl_history (
 id uuid primary key default gen_random_uuid(), submission_id uuid not null references public.wl_submissions(id) on delete cascade,
 previous_status text, new_status text not null, actor_discord_id text, note text, created_at timestamptz not null default now()
);
-- Lista de e-mails autorizados também é usada pelo painel; cadastre aqui somente os administradores.
create table if not exists public.wl_admins (
 email text primary key check(email=lower(email)), created_at timestamptz not null default now()
);

alter table public.wl_submissions enable row level security;
alter table public.wl_interviews enable row level security;
alter table public.wl_history enable row level security;
alter table public.wl_admins enable row level security;
revoke all on public.wl_submissions from anon, authenticated;
revoke all on public.wl_interviews from anon, authenticated;
revoke all on public.wl_history from anon, authenticated;
revoke all on public.wl_admins from anon, authenticated;
drop policy if exists "admin reads own allowlist entry" on public.wl_admins;
create policy "admin reads own allowlist entry" on public.wl_admins for select to authenticated using (email = lower(auth.jwt()->>'email'));
grant select on public.wl_admins to authenticated;

create or replace function public.wl_touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists wl_submissions_touch_updated_at on public.wl_submissions;
create trigger wl_submissions_touch_updated_at before update on public.wl_submissions for each row execute function public.wl_touch_updated_at();

-- Campos da versão de 20 questões e fluxo de liberação do ID FiveM.
alter table public.wl_submissions add column if not exists fivem_id text;
alter table public.wl_submissions add column if not exists q_vdm text not null default 'wrong1';
alter table public.wl_submissions add column if not exists q_combatlog text not null default 'wrong1';
alter table public.wl_submissions add column if not exists q_failrp text not null default 'wrong1';
alter table public.wl_submissions add column if not exists q_meta_voice text not null default 'wrong1';
alter table public.wl_submissions add column if not exists q_nvl text not null default 'wrong1';
alter table public.wl_submissions add column if not exists q_rp_scene text not null default 'wrong1';
alter table public.wl_submissions add column if not exists q_ooc_ic text not null default 'wrong1';
alter table public.wl_submissions add column if not exists q_safezone text not null default 'wrong1';
alter table public.wl_submissions add column if not exists q_revenge text not null default 'wrong1';
alter table public.wl_submissions add column if not exists q_pov text not null default 'wrong1';
alter table public.wl_submissions add column if not exists q_character text not null default 'wrong1';
alter table public.wl_submissions add column if not exists q_robbery text not null default 'wrong1';
alter table public.wl_submissions drop constraint if exists wl_submissions_status_check;
alter table public.wl_submissions add constraint wl_submissions_status_check check(status in ('pending','approved','rejected','interview','awaiting_id_release','id_submitted','released'));

-- A aprovação é decidida pela Edge Function submit-wl: 10 perguntas x 10 pontos; 80+ aprovado.
