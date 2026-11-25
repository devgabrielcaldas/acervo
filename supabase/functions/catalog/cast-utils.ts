/** Utilitários de elenco TMDB; nenhuma chave ou URL fornecida pelo navegador é acessada diretamente. */
export interface CastRow { id: number; name: string; character: string; profilePath?: string }
export interface CastResponse { cast: CastRow[]; matchedTitle?: string; matchedBy?: 'id' | 'title'; unmatched?: boolean }
export type ReadCatalogJson = (url: URL, headers?: HeadersInit) => Promise<unknown>;

type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : undefined;
}
function text(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
function int(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}
function normalizeTitle(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
function yearOf(value: unknown): number | undefined {
  const match = /^\d{4}/.exec(text(value));
  return match ? Number(match[0]) : undefined;
}
function tmdb(path: string): URL {
  const url = new URL(`https://api.themoviedb.org/3/${path}`);
  url.searchParams.set('language', 'pt-BR');
  return url;
}
function photoPath(value: unknown): string | undefined {
  const candidate = text(value);
  return /^\/[A-Za-z0-9_-]{3,90}\.(jpg|jpeg|png|webp)$/i.test(candidate) ? candidate : undefined;
}
function characterOf(person: RecordValue): string {
  const direct = text(person.character);
  if (direct) return direct;
  const roles = Array.isArray(person.roles) ? person.roles : [];
  return roles.map(role => text(record(role)?.character)).filter(Boolean).slice(0, 2).join(' / ');
}
export function normalizeTmdbCast(data: unknown): CastRow[] {
  const source = record(data);
  const rows = Array.isArray(source?.cast) ? source.cast : [];
  const people: CastRow[] = [];
  const seen = new Set<string>();
  for (const raw of rows) {
    const actor = record(raw);
    const id = int(actor?.id), name = text(actor?.name), character = actor && characterOf(actor);
    if (!id || !name || !character) continue;
    const key = `${id}|${character}`;
    if (seen.has(key)) continue;
    seen.add(key);
    people.push({ id, name: name.slice(0, 130), character: character.slice(0, 180), profilePath: photoPath(actor?.profile_path) });
    if (people.length >= 25) break;
  }
  return people;
}

/** Busca por título apenas quando registros antigos não têm ID TMDB. Evita resultado homônimo de outro ano. */
export function pickTmdbMatch(data: unknown, kind: 'movie' | 'series', title: string, releaseYear?: number): { id: number; title: string } | undefined {
  const candidates = record(data)?.results;
  if (!Array.isArray(candidates)) return undefined;
  const wanted = normalizeTitle(title.replace(/\s*[—-]\s*Temp\.\s*\d+$/i, ''));
  const exact = candidates.map(record).filter((value): value is RecordValue => Boolean(value))
    .filter(row => normalizeTitle(text(kind === 'movie' ? row.title : row.name)) === wanted ||
      normalizeTitle(text(kind === 'movie' ? row.original_title : row.original_name)) === wanted);
  const eligible = exact.filter(row => {
    if (kind !== 'movie' || !releaseYear) return true;
    const year = yearOf(row.release_date);
    return year !== undefined && Math.abs(year - releaseYear) <= 1;
  });
  if (eligible.length === 0) return undefined;
  // Se o título não tem ano e há vários homônimos, não inventar a associação.
  if (kind === 'movie' && !releaseYear && eligible.length > 1) return undefined;
  const match = eligible[0];
  const id = int(match.id);
  if (!id) return undefined;
  return { id, title: text(kind === 'movie' ? match.title : match.name) || title };
}

export async function fetchTmdbCast(options: {
  kind: 'movie' | 'series'; title: string; releaseYear?: number; tmdbId?: number; seasonNumber?: number;
}, read: ReadCatalogJson, headers: HeadersInit): Promise<CastResponse> {
  const { kind, releaseYear, seasonNumber } = options;
  let tmdbId = options.tmdbId;
  let matchedTitle = options.title;
  let matchedBy: 'id' | 'title' = 'id';
  if (!tmdbId) {
    const url = tmdb(`search/${kind === 'movie' ? 'movie' : 'tv'}`);
    url.searchParams.set('query', options.title);
    url.searchParams.set('include_adult', 'false');
    const search = await read(url, headers);
    const match = pickTmdbMatch(search, kind, options.title, releaseYear);
    if (!match) return { cast: [], unmatched: true };
    tmdbId = match.id;
    matchedTitle = match.title;
    matchedBy = 'title';
  }
  let response: unknown;
  if (kind === 'movie') {
    response = await read(tmdb(`movie/${tmdbId}/credits`), headers);
  } else if (seasonNumber) {
    try { response = await read(tmdb(`tv/${tmdbId}/season/${seasonNumber}/credits`), headers); }
    catch { /* Temporada pode não ter elenco individual disponível. */ }
    if (!normalizeTmdbCast(response).length) response = await read(tmdb(`tv/${tmdbId}/aggregate_credits`), headers);
  } else {
    response = await read(tmdb(`tv/${tmdbId}/aggregate_credits`), headers);
  }
  return { cast: normalizeTmdbCast(response), matchedTitle, matchedBy };
}
