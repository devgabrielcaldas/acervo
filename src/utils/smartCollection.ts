import type { MediaInput, MediaRecord, MediaCategory, MediaStatus } from '../types/media';
import { normalizeSearch } from './searchMedia';

/** Compara títulos sem acentos, diferenças de pontuação e espaços. Não modifica os dados originais. */
export function identityText(text: string): string {
  return normalizeSearch(text).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export interface SeasonIdentity { name: string; season?: number }
export function seasonIdentity(item: { title: string; seriesTitle?: string; seasonNumber?: number }): SeasonIdentity {
  const suffix = /^(.*?)\s*[—–-]\s*Temp(?:orada)?\.?\s*(\d{1,3})\s*$/i.exec(item.title.trim());
  const suffixSeason = suffix?.[2] ? Number(suffix[2]) : undefined;
  const season = item.seasonNumber && Number.isSafeInteger(item.seasonNumber) && item.seasonNumber > 0
    ? item.seasonNumber : suffixSeason;
  const name = item.seriesTitle?.trim() || suffix?.[1]?.trim() || item.title.trim();
  return { name, season };
}

/** Alerta visual de potenciais duplicidades; a confirmação de cadastro continua sendo do usuário. */
export function findPossibleDuplicates(input: MediaInput, items: MediaRecord[], editingId?: string): MediaRecord[] {
  const requested = input.kind === 'series' ? seasonIdentity(input) : null;
  const title = identityText(input.kind === 'series' ? requested!.name : input.title);
  if (!title) return [];
  return items.filter((item) => {
    if (item.id === editingId || item.kind !== input.kind) return false;
    if (input.kind === 'series' && item.kind === 'series') {
      const existing = seasonIdentity(item);
      if (identityText(existing.name) !== title) return false;
      // Só indica duplicidade quando as duas temporadas são identificadas e iguais.
      // Registros antigos sem número são considerados se o título inteiro coincidir.
      if (requested?.season !== undefined && existing.season !== undefined) return requested.season === existing.season;
      return identityText(input.title) === identityText(item.title);
    }
    if (identityText(item.title) !== title) return false;
    if (input.kind === 'book' && item.kind === 'book') {
      return !input.author?.trim() || !item.author?.trim() || identityText(input.author) === identityText(item.author);
    }
    if (input.kind === 'movie' && item.kind === 'movie') {
      if (input.releaseYear && item.releaseYear && input.releaseYear !== item.releaseYear) return false;
      return !input.director?.trim() || !item.director?.trim() || identityText(input.director) === identityText(item.director);
    }
    return true;
  }).slice(0, 5);
}

export type SmartKindFilter = MediaCategory | 'all';
export type SmartStatusFilter = MediaStatus | 'all';
export type SmartSort = 'recent' | 'title' | 'completed' | 'rating';
export interface SmartFilters {
  kind: SmartKindFilter;
  status: SmartStatusFilter;
  author: string;
  completionYear: string;
  search: string;
  sort: SmartSort;
  minRating: string;
}
export const EMPTY_SMART_FILTERS: SmartFilters = {
  kind: 'all', status: 'all', author: 'all', completionYear: 'all', search: '', sort: 'recent', minRating: 'all',
};
export interface SavedSmartView { id: string; name: string; filters: SmartFilters }
const validKinds = ['all', 'book', 'movie', 'series'];
const validStatuses = ['all', 'wishlist', 'in_progress', 'completed', 'paused', 'abandoned'];
const validSort = ['recent', 'title', 'completed', 'rating'];
const validRating = ['all', '3', '4', '4.5', '5'];

export function sanitizeSmartFilters(source: unknown): SmartFilters {
  if (!source || typeof source !== 'object') return { ...EMPTY_SMART_FILTERS };
  const s = source as Record<string, unknown>;
  const text = (key: string, fallback: string, max: number) => typeof s[key] === 'string' ? (s[key] as string).slice(0, max) : fallback;
  const kind = text('kind', 'all', 32);
  const status = text('status', 'all', 32);
  const sort = text('sort', 'recent', 32);
  const minRating = text('minRating', 'all', 8);
  const completionYear = text('completionYear', 'all', 8);
  return {
    kind: validKinds.includes(kind) ? kind as SmartKindFilter : 'all',
    status: validStatuses.includes(status) ? status as SmartStatusFilter : 'all',
    author: text('author', 'all', 150),
    completionYear: completionYear === 'all' || /^\d{4}$/.test(completionYear) ? completionYear : 'all',
    search: text('search', '', 200),
    sort: validSort.includes(sort) ? sort as SmartSort : 'recent',
    minRating: validRating.includes(minRating) ? minRating : 'all',
  };
}

export interface SeasonGroup { key: string; name: string; items: MediaRecord[] }
export function groupMediaSeasons(items: MediaRecord[]): { groups: SeasonGroup[]; singles: MediaRecord[] } {
  const map = new Map<string, SeasonGroup>();
  for (const item of items) {
    if (item.kind !== 'series') continue;
    const id = seasonIdentity(item);
    if (!id.name || id.season === undefined) continue;
    const key = identityText(id.name);
    if (!key) continue;
    const group = map.get(key) || { key, name: id.name, items: [] };
    group.items.push(item);
    map.set(key, group);
  }
  const groups = [...map.values()].filter(g => g.items.length >= 2)
    .map(g => ({ ...g, items: [...g.items].sort((a, b) => (seasonIdentity(a).season ?? 0) - (seasonIdentity(b).season ?? 0) || a.title.localeCompare(b.title, 'pt-BR')) }));
  const groupedIds = new Set(groups.flatMap(g => g.items.map(i => i.id)));
  return { groups, singles: items.filter(i => !groupedIds.has(i.id)) };
}
