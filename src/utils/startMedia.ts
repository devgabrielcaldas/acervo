import type { BookFormat, DateOnly, MediaRecord } from '../types/media';
import { quickProgressDraft, quickProgressPatch } from './quickProgress';
import type { QuickProgressDraft } from './quickProgress';

export type StartDraft = QuickProgressDraft & { startedOn: string };
export type StartPatch = {
  status: 'in_progress';
  completedOn: undefined;
  startedOn?: DateOnly;
  format?: BookFormat;
  currentPage?: number;
  totalPages?: number;
  ebookPercent?: number;
  currentEpisode?: number;
  totalEpisodes?: number;
  durationMinutes?: number;
  pausedAtSeconds?: number;
};

export function startDraft(item: MediaRecord): StartDraft {
  const draft = quickProgressDraft(item);
  return {
    ...draft,
    currentPage: draft.currentPage || '0',
    percent: draft.percent || '0',
    watchedEpisodes: draft.watchedEpisodes || '0',
    startedOn: item.startedOn ?? '',
    finish: false,
  };
}

function verifyStartDate(value: string): DateOnly | undefined {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Informe uma data de início válida.');
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(0);
  parsed.setUTCFullYear(year, month - 1, day);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() + 1 !== month || parsed.getUTCDate() !== day) {
    throw new Error('A data de início não existe no calendário.');
  }
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (value > today) throw new Error('A data de início não pode ser futura.');
  return value as DateOnly;
}

/** Muda apenas o registro existente, sem criar outro item nem tocar na capa ou na avaliação. */
export function startPatch(item: MediaRecord, draft: StartDraft): StartPatch {
  if (item.status !== 'wishlist') throw new Error('Somente títulos da lista de desejos podem ser iniciados.');
  const progress = quickProgressPatch(item, {
    ...draft,
    finish: false,
    currentPage: draft.currentPage.trim() || '0',
    percent: draft.percent.trim() || '0',
    watchedEpisodes: draft.watchedEpisodes.trim() || '0',
  });
  return {
    ...progress,
    status: 'in_progress',
    completedOn: undefined,
    startedOn: verifyStartDate(draft.startedOn),
  };
}
