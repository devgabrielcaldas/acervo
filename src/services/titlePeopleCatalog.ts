import { requireSupabase } from '../lib/supabase';
import type { MediaRecord } from '../types/media';

export interface CastPerson {
  id: number;
  name: string;
  character: string;
  profilePath?: string;
}
export interface TitleCast {
  cast: CastPerson[];
  matchedTitle?: string;
  matchedBy?: 'id' | 'title';
  unmatched?: boolean;
}

/** Consulta somente o catálogo autenticado; a chave secreta TMDB fica no Supabase. */
export async function loadTitleCast(item: MediaRecord): Promise<TitleCast> {
  if (item.kind === 'book') return { cast: [] };
  const title = item.kind === 'series' ? (item.seriesTitle || item.title.replace(/\s*[—-]\s*Temp\.\s*\d+$/i, '')) : item.title;
  const payload = {
    action: 'cast', kind: item.kind, title, releaseYear: item.releaseYear,
    tmdbId: item.tmdbId, seasonNumber: item.kind === 'series' ? item.seasonNumber : undefined,
  };
  const { data, error } = await requireSupabase().functions.invoke('catalog', { body: payload });
  if (error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const details = await context.clone().json() as { error?: string };
        if (typeof details.error === 'string') throw new Error(details.error);
      } catch (cause) {
        if (cause instanceof Error && cause.message !== 'Unexpected end of JSON input' && !(cause instanceof SyntaxError)) throw cause;
      }
    }
    throw new Error(`Não foi possível consultar o elenco: ${error.message}`);
  }
  if (!data || typeof data !== 'object' || !Array.isArray((data as TitleCast).cast)) throw new Error('O catálogo retornou um elenco inválido.');
  const cast = (data as TitleCast).cast.filter(person =>
    person && Number.isSafeInteger(person.id) && person.id > 0 &&
    typeof person.name === 'string' && typeof person.character === 'string'
  ).slice(0, 25);
  return { ...data as TitleCast, cast };
}
