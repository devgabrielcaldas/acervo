import type { BookFormat, DateOnly, MediaRecord } from '../types/media';
import { formatPlaybackTime, parsePlaybackTime } from './progress';

/** Dados de edição rápida, mantidos como texto até a validação no envio. */
export interface QuickProgressDraft {
  bookFormat: BookFormat;
  currentPage: string;
  totalPages: string;
  percent: string;
  watchedEpisodes: string;
  totalEpisodes: string;
  pausedAt: string;
  durationMinutes: string;
  /** Aciona a conclusão dentro do modal para livros e filmes. */
  finish: boolean;
  completedOn: string;
  rating: string;
}

type ProgressOnlyPatch =
  | { format: BookFormat; currentPage?: number; totalPages?: number; ebookPercent?: number }
  | { currentEpisode?: number; totalEpisodes?: number; pausedAtSeconds?: number }
  | { durationMinutes?: number; pausedAtSeconds?: number };

/** O mesmo patch pode concluir o registro, sem perder os outros campos. */
export type QuickProgressPatch = ProgressOnlyPatch & {
  status?: 'completed';
  completedOn?: DateOnly;
  rating?: number;
};

/** Carrega os mesmos valores que o formulário completo utiliza. */
export function quickProgressDraft(item: MediaRecord): QuickProgressDraft {
  return {
    bookFormat: item.kind === 'book' ? (item.format ?? 'physical') : 'physical',
    currentPage: item.kind === 'book' ? String(item.currentPage ?? '') : '',
    totalPages: item.kind === 'book' ? String(item.totalPages ?? '') : '',
    percent: item.kind === 'book' ? String(item.ebookPercent ?? '') : '',
    watchedEpisodes: item.kind === 'series' ? String(item.currentEpisode ?? '0') : '',
    totalEpisodes: item.kind === 'series' ? String(item.totalEpisodes ?? '') : '',
    pausedAt: item.kind === 'book' ? '' : formatPlaybackTime(item.pausedAtSeconds),
    durationMinutes: item.kind === 'movie' ? String(item.durationMinutes ?? '') : '',
    finish: false,
    completedOn: '',
    rating: item.rating === undefined ? '' : String(item.rating),
  };
}

function numberField(raw: string, label: string, min: number, max?: number): number | undefined {
  const value = raw.trim();
  if (!value) return undefined;
  if (!/^\d+$/.test(value)) throw new Error(`${label}: informe um número inteiro válido.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || (max !== undefined && parsed > max)) {
    throw new Error(max === undefined ? `${label}: o valor mínimo é ${min}.` : `${label}: informe um valor de ${min} a ${max}.`);
  }
  return parsed;
}

/** Só exige uma data REAL quando o usuário escolhe finalizar. */
function realCompletionDate(raw: string, startedOn?: DateOnly): DateOnly {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error('Informe a data real de conclusão (dia, mês e ano).');
  }
  const [year, month, day] = raw.split('-').map(Number);
  const parsed = new Date(0);
  parsed.setUTCFullYear(year, month - 1, day);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() + 1 !== month || parsed.getUTCDate() !== day) {
    throw new Error('A data de conclusão não existe no calendário.');
  }
  if (startedOn && raw < startedOn) throw new Error('A conclusão não pode anteceder a data de início.');
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  if (raw > today) throw new Error('A data de conclusão não pode ser futura.');
  return raw as DateOnly;
}

function optionalRating(raw: string): number | undefined {
  if (raw === '') return undefined;
  const rating = Number(raw);
  if (!Number.isFinite(rating) || rating < 0 || rating > 5 || !Number.isInteger(rating * 2)) {
    throw new Error('Selecione uma nota de 0 a 5 em intervalos de 0,5.');
  }
  return rating;
}

/**
 * Atualiza o progresso normalmente, ou conclui livros/filmes com data e nota.
 * Jamais altera título, capa, comentários, favoritos ou dados da outra conta.
 */
export function quickProgressPatch(item: MediaRecord, draft: QuickProgressDraft): QuickProgressPatch {
  if (draft.finish) {
    if (item.kind === 'series') throw new Error('Conclua temporadas pelo botão Concluir.');
    const completedOn = realCompletionDate(draft.completedOn, item.startedOn);
    const rating = optionalRating(draft.rating);
    if (item.kind === 'book') {
      if (!['physical', 'ebook', 'audiobook'].includes(draft.bookFormat)) throw new Error('Formato do livro inválido.');
      if (draft.bookFormat !== 'physical') {
        return { format: draft.bookFormat, ebookPercent: 100, status: 'completed', completedOn, rating };
      }
      const totalPages = numberField(draft.totalPages, 'Total de páginas', 1);
      return {
        format: 'physical', totalPages,
        currentPage: totalPages ?? item.totalPages ?? item.currentPage,
        status: 'completed', completedOn, rating,
      };
    }
    const durationMinutes = numberField(draft.durationMinutes, 'Duração do filme', 1);
    return { durationMinutes, pausedAtSeconds: undefined, status: 'completed', completedOn, rating };
  }
  if (item.kind === 'book') {
    if (!['physical', 'ebook', 'audiobook'].includes(draft.bookFormat)) throw new Error('Formato do livro inválido.');
    if (draft.bookFormat === 'physical') {
      const currentPage = numberField(draft.currentPage, 'Página atual', 0);
      const totalPages = numberField(draft.totalPages, 'Total de páginas', 1);
      if (currentPage === undefined) throw new Error('Informe a página em que você está.');
      if (totalPages !== undefined && currentPage > totalPages) throw new Error('A página atual não pode ultrapassar o total de páginas.');
      return { format: 'physical', currentPage, totalPages };
    }
    const ebookPercent = numberField(draft.percent, 'Percentual', 0, 100);
    if (ebookPercent === undefined) throw new Error('Informe seu percentual de progresso.');
    return { format: draft.bookFormat, ebookPercent };
  }

  const pausedAtSeconds = parsePlaybackTime(draft.pausedAt);
  if (item.kind === 'movie') {
    const durationMinutes = numberField(draft.durationMinutes, 'Duração do filme', 1);
    if (durationMinutes !== undefined && pausedAtSeconds !== undefined && pausedAtSeconds > durationMinutes * 60) {
      throw new Error('A posição assistida não pode ultrapassar a duração do filme.');
    }
    return { durationMinutes, pausedAtSeconds };
  }

  const currentEpisode = numberField(draft.watchedEpisodes, 'Episódios concluídos', 0);
  const totalEpisodes = numberField(draft.totalEpisodes, 'Total de episódios', 1);
  if (currentEpisode === undefined) throw new Error('Informe quantos episódios foram concluídos (zero se ainda está no primeiro).');
  if (totalEpisodes !== undefined && currentEpisode > totalEpisodes) {
    throw new Error('Episódios concluídos não podem superar o total da temporada.');
  }
  if (totalEpisodes !== undefined && currentEpisode === totalEpisodes && pausedAtSeconds !== undefined && pausedAtSeconds > 0) {
    throw new Error('Todos os episódios estão concluídos. Limpe o tempo de pausa ou ajuste a quantidade de episódios.');
  }
  return { currentEpisode, totalEpisodes, pausedAtSeconds };
}
