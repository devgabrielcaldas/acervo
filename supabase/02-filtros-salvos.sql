-- ACERVO ETAPA 11 — Execute no SQL Editor do MESMO projeto Supabase.
-- Cria APENAS uma tabela independente. Não modifica registros, capas, metas nem auth.users.
create table if not exists public.acervo_saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 50),
  config jsonb not null check (jsonb_typeof(config) = 'object'),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
create index if not exists acervo_saved_views_user_idx on public.acervo_saved_views(user_id, created_at);
alter table public.acervo_saved_views enable row level security;
revoke all on public.acervo_saved_views from public, anon;
grant select, insert, delete on public.acervo_saved_views to authenticated;
drop policy if exists "acervo saved views owner" on public.acervo_saved_views;
create policy "acervo saved views owner" on public.acervo_saved_views
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
