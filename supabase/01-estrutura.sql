-- ACERVO: execute no SQL Editor de um projeto Supabase novo.
-- Use apenas a publishable key no React. Nunca uma secret/service_role key.

create table if not exists public.acervo_media (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  unique (id, user_id)
);
create index if not exists acervo_media_owner_idx on public.acervo_media(user_id);

create table if not exists public.acervo_goals (
  user_id uuid not null references auth.users(id) on delete cascade,
  year integer not null check (year between 1 and 9999),
  data jsonb not null,
  primary key (user_id, year)
);

create table if not exists public.acervo_covers (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  media_id uuid not null,
  path text not null,
  mime_type text not null check (mime_type in ('image/webp','image/jpeg','image/png')),
  width integer not null check (width between 1 and 20000),
  height integer not null check (height between 1 and 20000),
  saved_at timestamptz not null,
  unique(user_id, media_id),
  unique(path),
  foreign key (media_id,user_id) references public.acervo_media(id,user_id) on delete cascade
);

alter table public.acervo_media enable row level security;
alter table public.acervo_goals enable row level security;
alter table public.acervo_covers enable row level security;

-- A conta autenticada só acessa suas próprias linhas.
drop policy if exists "acervo media owner" on public.acervo_media;
create policy "acervo media owner" on public.acervo_media for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "acervo goals owner" on public.acervo_goals;
create policy "acervo goals owner" on public.acervo_goals for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "acervo covers owner" on public.acervo_covers;
create policy "acervo covers owner" on public.acervo_covers for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.acervo_media,public.acervo_goals,public.acervo_covers from anon;
grant select,insert,update,delete on public.acervo_media,public.acervo_goals,public.acervo_covers to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('acervo-covers','acervo-covers',false,12582912,array['image/webp','image/jpeg','image/png'])
on conflict (id) do update set public=false, file_size_limit=12582912,allowed_mime_types=array['image/webp','image/jpeg','image/png'];

drop policy if exists "acervo read covers" on storage.objects;
create policy "acervo read covers" on storage.objects for select to authenticated
using (bucket_id='acervo-covers' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "acervo upload covers" on storage.objects;
create policy "acervo upload covers" on storage.objects for insert to authenticated
with check (bucket_id='acervo-covers' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "acervo update covers" on storage.objects;
create policy "acervo update covers" on storage.objects for update to authenticated
using (bucket_id='acervo-covers' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check (bucket_id='acervo-covers' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "acervo delete covers" on storage.objects;
create policy "acervo delete covers" on storage.objects for delete to authenticated
using (bucket_id='acervo-covers' and (storage.foldername(name))[1]=(select auth.uid())::text);

-- Restaura as 3 tabelas juntas. Os arquivos Storage são enviados ANTES da transação.
-- Não utiliza SECURITY DEFINER e respeita RLS. Se falhar, o Postgres desfaz o banco todo.
create or replace function public.acervo_restore_snapshot(
  p_media jsonb,
  p_goals jsonb,
  p_covers jsonb
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'Autenticação necessária'; end if;
  if jsonb_typeof(p_media) <> 'array' or jsonb_typeof(p_goals) <> 'array' or jsonb_typeof(p_covers) <> 'array' then
    raise exception 'Formato de backup inválido';
  end if;
  if jsonb_array_length(p_media)>10000 or jsonb_array_length(p_goals)>1000 or jsonb_array_length(p_covers)>10000 then
    raise exception 'Backup excede limites';
  end if;
  delete from public.acervo_covers where user_id=uid;
  delete from public.acervo_media where user_id=uid;
  delete from public.acervo_goals where user_id=uid;
  insert into public.acervo_media(id,user_id,data)
  select (m->>'id')::uuid,uid,m from jsonb_array_elements(p_media) m;
  insert into public.acervo_goals(user_id,year,data)
  select uid,(g->>'year')::integer,g from jsonb_array_elements(p_goals) g;
  insert into public.acervo_covers(id,user_id,media_id,path,mime_type,width,height,saved_at)
  select (c->>'id')::uuid,uid,(c->>'media_id')::uuid,c->>'path',c->>'mime_type',
  (c->>'width')::integer,(c->>'height')::integer,(c->>'saved_at')::timestamptz
  from jsonb_array_elements(p_covers) c;
end;
$$;
revoke all on function public.acervo_restore_snapshot(jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.acervo_restore_snapshot(jsonb,jsonb,jsonb) to authenticated;
