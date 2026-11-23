import type { DateOnly, MediaRecord } from '../types/media';

export interface CompleteDraft {
  completedOn: string;
  rating: string;
  notes: string;
  favorite: boolean;
}

export function completeDraft(item: MediaRecord): CompleteDraft {
  return { completedOn: item.completedOn ?? '', rating: item.rating === undefined ? '' : String(item.rating), notes: item.notes ?? '', favorite: item.favorite };
}

export type CompletePatch = {
  status: 'completed';
  completedOn: DateOnly;
  rating?: number;
  notes?: string;
  favorite: boolean;
  ebookPercent?: number;
  currentPage?: number;
  currentEpisode?: number;
  pausedAtSeconds?: number;
};

/** Conclusão com data real, meia estrela e atualização do progresso para 100% quando há total conhecido. */
export function completePatch(item: MediaRecord, draft: CompleteDraft): CompletePatch {
  const date = draft.completedOn;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Informe o dia real de conclusão.');
  const [y, m, d] = date.split('-').map(Number);
  const check = new Date(0);
  check.setUTCFullYear(y, m - 1, d);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() + 1 !== m || check.getUTCDate() !== d) {
    throw new Error('Data de conclusão inválida.');
  }
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (date > today) throw new Error('A conclusão não pode estar no futuro.');
  if (item.startedOn && date < item.startedOn) throw new Error('A conclusão não pode anteceder o início.');
  const rating = draft.rating.trim() === '' ? undefined : Number(draft.rating);
  if (rating !== undefined && (!Number.isFinite(rating) || rating < 0 || rating > 5 || !Number.isInteger(rating * 2))) {
    throw new Error('A nota deve estar entre 0 e 5, em intervalos de 0,5.');
  }
  const result: CompletePatch = {
    status: 'completed', completedOn: date as DateOnly, rating,
    notes: draft.notes.trim() || undefined, favorite: draft.favorite,
  };
  if (item.kind === 'book') {
    if (item.format === 'ebook' || item.format === 'audiobook') result.ebookPercent = 100;
    else if (item.totalPages !== undefined) result.currentPage = item.totalPages;
  }
  if (item.kind === 'movie') result.pausedAtSeconds = undefined;
  if (item.kind === 'series') {
    result.pausedAtSeconds = undefined;
    if (item.totalEpisodes !== undefined) result.currentEpisode = item.totalEpisodes;
  }
  return result;
}
