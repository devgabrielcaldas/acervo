import { cloudSaveMedia,cloudGetMedia,cloudListMedia,cloudDeleteMedia } from './cloudRepository';
import type {
  BookInput,
  DateOnly,
  MediaFilters,
  MediaInput,
  MediaRecord,
  MovieInput,
  SeriesInput,
} from '../types/media';

function optionalText(text?: string): string | undefined {
  return text?.trim() || undefined;
}

function checkedInteger(value: number | undefined, field: string, minimum = 0) {
  if (value !== undefined && (!Number.isSafeInteger(value) || value < minimum)) {
    throw new Error(`${field} deve ser um número inteiro igual ou superior a ${minimum}.`);
  }
  return value;
}

function checkedDate(value?: DateOnly): DateOnly | undefined {
  if (value === undefined) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Informe uma data válida (AAAA-MM-DD).');
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) {
    throw new Error(`A data ${value} não existe no calendário.`);
  }
  return value;
}

function validateInput(input: MediaInput): void {
  if (!['book', 'movie', 'series'].includes(input.kind)) throw new Error('Categoria inválida.');
  if (!input.title.trim()) throw new Error('Informe o título.');
  if (!['wishlist', 'in_progress', 'completed', 'paused', 'abandoned'].includes(input.status)) {
    throw new Error('Status inválido.');
  }
  if (input.rating !== undefined && (
    !Number.isFinite(input.rating) || input.rating < 0 || input.rating > 5 || !Number.isInteger(input.rating * 2)
  )) {
    throw new Error('A nota deve estar entre 0 e 5, com intervalos de meia estrela.');
  }
  if (input.priority !== undefined && !['high', 'medium', 'low'].includes(input.priority)) {
    throw new Error('Prioridade inválida.');
  }
  checkedInteger(input.releaseYear, 'Ano de lançamento');
  const start = checkedDate(input.startedOn);
  const end = checkedDate(input.completedOn);
  if (start && end && start > end) throw new Error('A conclusão não pode anteceder o início.');
  // Quando o status for concluído, a data deve ser informada no formulário.
  if (input.status === 'completed' && !end) {
    throw new Error('Informe a data real de conclusão antes de marcar como concluído.');
  }
  if (input.kind === 'book') {
    checkedInteger(input.totalPages, 'Total de páginas', 1);
    checkedInteger(input.currentPage, 'Página atual');
    if (input.totalPages !== undefined && input.currentPage !== undefined && input.currentPage > input.totalPages) {
      throw new Error('A página atual não pode superar o total de páginas.');
    }
    if (input.format !== undefined && !['physical', 'ebook', 'audiobook'].includes(input.format)) {
      throw new Error('Formato do livro inválido.');
    }
  }
  if (input.kind === 'movie') checkedInteger(input.durationMinutes, 'Duração', 1);
  if (input.kind === 'series') {
    checkedInteger(input.currentSeason, 'Temporada atual', 1);
    checkedInteger(input.currentEpisode, 'Episódio atual', 1);
    checkedInteger(input.totalSeasons, 'Total de temporadas', 1);
    checkedInteger(input.totalEpisodes, 'Total de episódios', 1);
  }
}

function normalizedFields(input: MediaInput) {
  return {
    title: input.title.trim(),
    status: input.status,
    genres: Array.from(new Set((input.genres ?? []).map((genre) => genre.trim()).filter(Boolean))),
    releaseYear: input.releaseYear,
    startedOn: input.startedOn,
    completedOn: input.completedOn,
    rating: input.rating,
    favorite: input.favorite ?? false,
    notes: optionalText(input.notes),
    priority: input.priority,
  };
}

function normalize(input: MediaInput, id: string, createdAt: string, coverId?: string): MediaRecord {
  validateInput(input);
  const common = { ...normalizedFields(input), id, createdAt, updatedAt: new Date().toISOString(), coverId };
  switch (input.kind) {
    case 'book': {
      const book: BookInput = input;
      return {
        ...common, kind: 'book', author: optionalText(book.author), totalPages: book.totalPages,
        currentPage: book.currentPage, format: book.format,
      };
    }
    case 'movie': {
      const movie: MovieInput = input;
      return {
        ...common, kind: 'movie', director: optionalText(movie.director),
        durationMinutes: movie.durationMinutes,
      };
    }
    case 'series': {
      const series: SeriesInput = input;
      return {
        ...common, kind: 'series', currentSeason: series.currentSeason,
        currentEpisode: series.currentEpisode, totalSeasons: series.totalSeasons,
        totalEpisodes: series.totalEpisodes,
      };
    }
  }
}

/** Cria um registro. Campos opcionais podem ficar em branco. */
export async function addMedia(input: MediaInput): Promise<MediaRecord> {
  const id = crypto.randomUUID();
  const record = normalize(input, id, new Date().toISOString());
  return cloudSaveMedia(record);
}

export async function getMedia(id: string): Promise<MediaRecord | undefined> {
  return cloudGetMedia(id);
}

/** Filtra registros existentes sem criar cópias das listas de desejos/favoritos. */
export async function listMedia(filters: MediaFilters = {}): Promise<MediaRecord[]> {
  const records = await cloudListMedia();
  return records.filter((item) => {
    if (filters.kind && item.kind !== filters.kind) return false;
    if (filters.status && item.status !== filters.status) return false;
    if (filters.favoritesOnly && !item.favorite) return false;
    if (filters.completedDay && item.completedOn !== filters.completedDay) return false;
    if (filters.completedYear !== undefined && !item.completedOn?.startsWith(`${filters.completedYear}-`)) return false;
    if (filters.completedMonth !== undefined && item.completedOn?.slice(5, 7) !== String(filters.completedMonth).padStart(2, '0')) return false;
    if (filters.search && !item.title.toLocaleLowerCase('pt-BR').includes(filters.search.trim().toLocaleLowerCase('pt-BR'))) return false;
    return true;
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Substitui os dados editáveis preservando ID, timestamps de criação e capa. */
export async function updateMedia(id: string, input: MediaInput): Promise<MediaRecord> {
  validateInput(input);
  const current = await cloudGetMedia(id);
  if (!current) throw new Error('Registro não encontrado.');
  if (current.kind !== input.kind) throw new Error('A categoria não pode ser alterada durante a edição.');
  const updated = normalize(input,current.id,current.createdAt,current.coverId);
  return cloudSaveMedia(updated);
}

/** Remove o item e a imagem associada na mesma transação. */
export async function deleteMedia(id: string): Promise<void> {
  await cloudDeleteMedia(id);
}
