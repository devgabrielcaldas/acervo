-- ACERVO ETAPA 14 - Calendário de atividades, a partir da ativação.
-- Execute APENAS no SQL Editor do projeto Supabase do Acervo.
-- Não altera a estrutura nem os dados de acervo_media/goals/covers/auth.users.
-- O gatilho observa apenas UPDATE em acervo_media (não INSERT, DELETE nem a restauração de backup).
-- O dia do evento é fixado no horário de Brasília (America/Sao_Paulo).

create table if not exists public.acervo_activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  media_id uuid not null,                 -- Sem FK para preservar o histórico após excluir a obra
  media_title text not null check (char_length(media_title) between 1 and 400),
  media_kind text not null check (media_kind in ('book','movie','series')),
  event_kind text not null check (event_kind in ('progress','completed')),
  metric text not null check (metric in ('pages','percent','episodes','seconds','completion')),
  previous_value integer not null default 0 check (previous_value >= 0),
  current_value integer not null default 0 check (current_value >= 0),
  delta_value integer not null default 0 check (delta_value >= 0),
  activity_day date not null,
  occurred_at timestamptz not null default now(),
  constraint acervo_activity_measure_check check (
    (metric = 'completion' and previous_value = 0 and current_value = 0 and delta_value = 0)
    or (metric <> 'completion' and current_value > previous_value and delta_value = current_value - previous_value)
  )
);

create index if not exists acervo_activity_user_day_idx
  on public.acervo_activity_events(user_id, activity_day desc, occurred_at desc);

alter table public.acervo_activity_events enable row level security;
revoke all on public.acervo_activity_events from public, anon, authenticated;
grant select on public.acervo_activity_events to authenticated;
drop policy if exists "acervo activity select own" on public.acervo_activity_events;
create policy "acervo activity select own" on public.acervo_activity_events
  for select to authenticated using (user_id = (select auth.uid()));

-- Invocada exclusivamente por gatilho. A função usa uma entrada já protegida
-- pela RLS existente de acervo_media. O navegador não pode criar eventos avulsos.
create or replace function public.acervo_capture_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
  v_field text;
  v_metric text := 'completion';
  v_before integer := 0;
  v_after integer := 0;
  v_delta integer := 0;
  v_completed boolean;
  v_format text;
  v_now timestamptz;
begin
  if tg_op <> 'UPDATE' or NEW.id is distinct from OLD.id
     or NEW.user_id is distinct from OLD.user_id then
    return NEW;
  end if;
  if NEW.data = OLD.data then return NEW; end if;

  v_kind := NEW.data->>'kind';
  if v_kind is null or v_kind not in ('book','movie','series')
     or v_kind is distinct from (OLD.data->>'kind') then
    return NEW;
  end if;
  -- Não confundir correções de uma obra já concluída com novas sessões.
  if NEW.data->>'status' = 'completed' and OLD.data->>'status' = 'completed' then
    return NEW;
  end if;
  v_completed := coalesce(OLD.data->>'status','') <> 'completed'
                 and NEW.data->>'status' = 'completed';

  if v_kind = 'book' then
    v_format := coalesce(nullif(NEW.data->>'format',''), 'physical');
    if v_format = coalesce(nullif(OLD.data->>'format',''), 'physical') then
      if v_format = 'physical' then
        v_field := 'currentPage'; v_metric := 'pages';
      elsif v_format in ('ebook','audiobook') then
        v_field := 'ebookPercent'; v_metric := 'percent';
      end if;
    end if;
  elsif v_kind = 'movie' then
    v_field := 'pausedAtSeconds'; v_metric := 'seconds';
  elsif v_kind = 'series' then
    -- Episódios têm prioridade sobre a posição do episódio atual.
    v_field := 'currentEpisode'; v_metric := 'episodes';
  end if;

  if v_field is not null then
    if (OLD.data->>v_field) ~ '^[0-9]{1,9}$' then
      v_before := (OLD.data->>v_field)::integer;
    end if;
    if (NEW.data->>v_field) ~ '^[0-9]{1,9}$' then
      v_after := (NEW.data->>v_field)::integer;
    end if;
    if v_after > v_before then
      v_delta := v_after - v_before;
    end if;
  end if;

  if v_kind = 'series' and v_delta = 0 then
    -- Pode existir avanço na posição do episódio, sem episódio concluído.
    v_field := 'pausedAtSeconds'; v_metric := 'seconds';
    v_before := 0; v_after := 0;
    if (OLD.data->>v_field) ~ '^[0-9]{1,9}$' then
      v_before := (OLD.data->>v_field)::integer;
    end if;
    if (NEW.data->>v_field) ~ '^[0-9]{1,9}$' then
      v_after := (NEW.data->>v_field)::integer;
    end if;
    if v_after > v_before and
      coalesce((OLD.data->>'currentEpisode'),'0') = coalesce((NEW.data->>'currentEpisode'),'0') then
      v_delta := v_after - v_before;
    end if;
  end if;

  if v_delta = 0 and not v_completed then return NEW; end if;
  if v_delta = 0 then
    v_metric := 'completion';
    v_before := 0;
    v_after := 0;
  end if;
  v_now := clock_timestamp();
  insert into public.acervo_activity_events (
    user_id, media_id, media_title, media_kind, event_kind, metric,
    previous_value, current_value, delta_value, activity_day, occurred_at
  ) values (
    NEW.user_id, NEW.id, left(coalesce(nullif(trim(NEW.data->>'title'),''), 'Título sem nome'),400),
    v_kind, case when v_completed then 'completed' else 'progress' end,
    v_metric, v_before, v_after, v_delta,
    (v_now at time zone 'America/Sao_Paulo')::date, v_now
  );
  return NEW;
end;
$$;

revoke all on function public.acervo_capture_activity() from public, anon, authenticated;
drop trigger if exists acervo_activity_after_media_update on public.acervo_media;
create trigger acervo_activity_after_media_update
  after update of data on public.acervo_media
  for each row execute function public.acervo_capture_activity();

-- Consultas de conferência SEGURAS (somente leitura):
-- select count(*) from public.acervo_activity_events;
-- select tgname from pg_trigger where tgrelid = 'public.acervo_media'::regclass and not tgisinternal;
-- select policyname,cmd,roles from pg_policies where tablename = 'acervo_activity_events';
