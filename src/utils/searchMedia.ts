import type { MediaRecord } from '../types/media';

/** Torna a busca tolerante a acentos, caixa e espaços repetidos, sem alterar os títulos salvos. */
export function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim();
}

/** Cada termo digitado pode estar em qualquer campo; respeita os filtros existentes. */
export function matchesMediaSearch(item: MediaRecord, raw: string): boolean {
  const terms = normalizeSearch(raw).split(' ').filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = normalizeSearch([
    item.title,
    item.kind === 'book' ? item.author : item.kind === 'movie' ? item.director : item.seriesTitle,
    ...item.genres,
  ].filter(Boolean).join(' '));
  return terms.every((term) => haystack.includes(term));
}
