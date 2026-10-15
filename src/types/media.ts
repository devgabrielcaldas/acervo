/** Categorias e situações compartilhadas pelas telas e pelo banco local. */
export type MediaCategory = 'book' | 'movie' | 'series';
export type MediaStatus = 'wishlist' | 'in_progress' | 'completed' | 'paused' | 'abandoned';
export type WishPriority = 'high' | 'medium' | 'low';
export type BookFormat = 'physical' | 'ebook' | 'audiobook';

/** Somente data de calendário: YYYY-MM-DD, sem conversão de fuso horário. */
export type DateOnly = `${number}-${number}-${number}`;

export interface MediaInputBase {
  title: string;
  status: MediaStatus;
  genres?: string[];
  releaseYear?: number;
  startedOn?: DateOnly;
  completedOn?: DateOnly;
  rating?: number; // 0 até 5, em passos de 0,5; indefinido = sem avaliação
  favorite?: boolean;
  notes?: string;
  priority?: WishPriority;
}

export interface BookInput extends MediaInputBase {
  kind: 'book';
  author?: string;
  totalPages?: number;
  currentPage?: number;
  format?: BookFormat;
}

export interface MovieInput extends MediaInputBase {
  kind: 'movie';
  director?: string;
  durationMinutes?: number;
}

export interface SeriesInput extends MediaInputBase {
  kind: 'series';
  currentSeason?: number;
  currentEpisode?: number;
  totalSeasons?: number;
  totalEpisodes?: number;
}

export type MediaInput = BookInput | MovieInput | SeriesInput;

export interface MediaRecordBase extends MediaInputBase {
  id: string;
  genres: string[];
  favorite: boolean;
  coverId?: string;
  createdAt: string; // Instante ISO: metadado técnico, NÃO é data de conclusão.
  updatedAt: string;
}

export interface BookRecord extends MediaRecordBase {
  kind: 'book';
  author?: string;
  totalPages?: number;
  currentPage?: number;
  format?: BookFormat;
}

export interface MovieRecord extends MediaRecordBase {
  kind: 'movie';
  director?: string;
  durationMinutes?: number;
}

export interface SeriesRecord extends MediaRecordBase {
  kind: 'series';
  currentSeason?: number;
  currentEpisode?: number;
  totalSeasons?: number;
  totalEpisodes?: number;
}

export type MediaRecord = BookRecord | MovieRecord | SeriesRecord;

export interface MediaFilters {
  kind?: MediaCategory;
  status?: MediaStatus;
  completedYear?: number;
  completedMonth?: number;
  completedDay?: DateOnly;
  favoritesOnly?: boolean;
  search?: string;
}

export interface CoverRecord {
  id: string;
  mediaId: string;
  image: Blob;
  mimeType: string;
  width: number;
  height: number;
  savedAt: string;
}

export interface AnnualGoal {
  year: number;
  books: number;
  movies: number;
  series: number;
  updatedAt: string;
}

export interface StorageSummary {
  books: number;
  movies: number;
  series: number;
  covers: number;
  goals: number;
}
