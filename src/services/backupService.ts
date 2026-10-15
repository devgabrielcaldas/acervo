import { getDatabase } from './database';
import type { AnnualGoal, CoverRecord, MediaRecord, StorageSummary } from '../types/media';

/**
 * Formato público do backup do Acervo (independente da versão interna do IndexedDB).
 * Alterações futuras devem receber um novo version, com migração explícita.
 */
const BACKUP_FORMAT = 'acervo-backup';
const BACKUP_VERSION = 1;
const MAX_FILE_BYTES = 150 * 1024 * 1024;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_MEDIA = 10_000;
const MAX_COVERS = 10_000;
const MAX_GOALS = 1_000;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface BackupPreview extends StorageSummary {
  exportedAt: string;
  fileName: string;
  sizeBytes: number;
  theme: 'dark' | 'light';
}

interface SerializableCover extends Omit<CoverRecord, 'image'> {
  /** Bytes originais da capa, codificados em Base64 (sem prefixo data:). */
  base64: string;
}

interface BackupDocument {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  data: {
    media: MediaRecord[];
    covers: SerializableCover[];
    goals: AnnualGoal[];
    settings: { theme: 'dark' | 'light' };
  };
}

/** Resultado validado e decodificado, antes de qualquer escrita no banco. */
export interface PreparedBackup {
  preview: BackupPreview;
  records: MediaRecord[];
  covers: CoverRecord[];
  goals: AnnualGoal[];
  theme: 'dark' | 'light';
}

function fail(message: string): never {
  throw new Error(message);
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonempty(value: unknown, maxLength = 500): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

function optionalString(value: unknown): boolean {
  return value === undefined || (typeof value === 'string' && value.length <= 100_000);
}

function optionalInteger(value: unknown, minimum = 0): boolean {
  return value === undefined || (Number.isSafeInteger(value) && (value as number) >= minimum);
}

function validDate(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || year > 9999) return false;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

function optionalDate(value: unknown): boolean {
  return value === undefined || validDate(value);
}

function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
}

function oneOf(value: unknown, choices: readonly string[]): boolean {
  return typeof value === 'string' && choices.includes(value);
}

function validateMedia(value: unknown, index: number): asserts value is MediaRecord {
  const tag = `Registro ${index + 1}`;
  if (!object(value) || !nonempty(value.id, 256) || !nonempty(value.title) ||
      !oneOf(value.kind, ['book', 'movie', 'series']) ||
      !oneOf(value.status, ['wishlist', 'in_progress', 'completed', 'paused', 'abandoned']) ||
      !Array.isArray(value.genres) || !value.genres.every((genre: unknown) => typeof genre === 'string' && genre.length <= 200) ||
      value.favorite !== true && value.favorite !== false ||
      !validTimestamp(value.createdAt) || !validTimestamp(value.updatedAt) ||
      !optionalInteger(value.releaseYear) || !optionalDate(value.startedOn) || !optionalDate(value.completedOn) ||
      !optionalString(value.notes) ||
      (value.priority !== undefined && !oneOf(value.priority, ['high', 'medium', 'low'])) ||
      (value.coverId !== undefined && !nonempty(value.coverId, 256))) {
    fail(`${tag} contém informações inválidas ou incompletas.`);
  }
  if (value.rating !== undefined && (typeof value.rating !== 'number' ||
      !Number.isFinite(value.rating) || value.rating < 0 || value.rating > 5 ||
      !Number.isInteger(value.rating * 2))) {
    fail(`${tag} possui uma avaliação inválida.`);
  }
  if (value.status === 'completed' && !validDate(value.completedOn)) {
    fail(`${tag} está concluído, mas não tem data válida de conclusão.`);
  }
  if (typeof value.startedOn === 'string' && typeof value.completedOn === 'string' && value.startedOn > value.completedOn) {
    fail(`${tag} possui data de conclusão anterior à de início.`);
  }
  if (value.kind === 'book') {
    if (!optionalString(value.author) || !optionalInteger(value.totalPages, 1) ||
        !optionalInteger(value.currentPage) ||
        (value.format !== undefined && !oneOf(value.format, ['physical', 'ebook', 'audiobook']))) {
      fail(`${tag}: campos de livro inválidos.`);
    }
    if (typeof value.totalPages === 'number' && typeof value.currentPage === 'number' && value.currentPage > value.totalPages) {
      fail(`${tag}: a página atual ultrapassa o total de páginas.`);
    }
  }
  if (value.kind === 'movie' && (!optionalString(value.director) || !optionalInteger(value.durationMinutes, 1))) {
    fail(`${tag}: campos de filme inválidos.`);
  }
  if (value.kind === 'series' && (!optionalInteger(value.currentSeason, 1) ||
      !optionalInteger(value.currentEpisode, 1) || !optionalInteger(value.totalSeasons, 1) ||
      !optionalInteger(value.totalEpisodes, 1))) {
    fail(`${tag}: campos de série inválidos.`);
  }
}

function validateGoal(value: unknown, index: number): asserts value is AnnualGoal {
  if (!object(value) || !Number.isSafeInteger(value.year) || (value.year as number) < 1 ||
      !Number.isSafeInteger(value.books) || (value.books as number) < 0 ||
      !Number.isSafeInteger(value.movies) || (value.movies as number) < 0 ||
      !Number.isSafeInteger(value.series) || (value.series as number) < 0 ||
      !validTimestamp(value.updatedAt)) {
    fail(`Meta anual ${index + 1} inválida.`);
  }
}

function isValidImageSignature(bytes: Uint8Array, type: string): boolean {
  if (type === 'image/png') {
    return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n);
  }
  if (type === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  return bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
}

function decodeCover(raw: unknown, index: number): CoverRecord {
  const tag = `Capa ${index + 1}`;
  if (!object(raw) || !nonempty(raw.id, 256) || !nonempty(raw.mediaId, 256) ||
      !oneOf(raw.mimeType, [...IMAGE_TYPES]) ||
      !Number.isSafeInteger(raw.width) || (raw.width as number) < 1 || (raw.width as number) > 20_000 ||
      !Number.isSafeInteger(raw.height) || (raw.height as number) < 1 || (raw.height as number) > 20_000 ||
      !validTimestamp(raw.savedAt) || typeof raw.base64 !== 'string' ||
      raw.base64.length === 0 || raw.base64.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 4 ||
      raw.base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(raw.base64)) {
    fail(`${tag} contém metadados ou imagem Base64 inválidos.`);
  }
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(raw.base64), (character) => character.charCodeAt(0));
  } catch {
    fail(`${tag} não pôde ser decodificada.`);
  }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES || !isValidImageSignature(bytes, raw.mimeType as string)) {
    fail(`${tag} não é uma imagem JPG, PNG ou WebP válida.`);
  }
  // Copiamos o buffer para um ArrayBuffer próprio, aceito pelo TypeScript e pelo Blob.
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return {
    id: raw.id as string,
    mediaId: raw.mediaId as string,
    image: new Blob([buffer], { type: raw.mimeType as string }),
    mimeType: raw.mimeType as string,
    width: raw.width as number,
    height: raw.height as number,
    savedAt: raw.savedAt as string,
  };
}

function getTheme(): 'dark' | 'light' {
  try {
    return window.localStorage.getItem('acervo:theme') === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler uma das capas. O backup não foi gerado.'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') return reject(new Error('Imagem ilegível.'));
      const comma = reader.result.indexOf(',');
      if (comma < 0) return reject(new Error('Imagem não pôde ser convertida.'));
      resolve(reader.result.slice(comma + 1));
    };
    reader.readAsDataURL(blob);
  });
}

function summarize(records: MediaRecord[], covers: CoverRecord[], goals: AnnualGoal[]): StorageSummary {
  return {
    books: records.filter((item) => item.kind === 'book').length,
    movies: records.filter((item) => item.kind === 'movie').length,
    series: records.filter((item) => item.kind === 'series').length,
    covers: covers.length,
    goals: goals.length,
  };
}

/** Faz uma leitura consistente de todas as tabelas numa única transação read-only. */
export async function createBackupFile(): Promise<{ fileName: string; blob: Blob; summary: StorageSummary }> {
  const db = await getDatabase();
  const tx = db.transaction(['media', 'covers', 'goals'], 'readonly');
  const [media, covers, goals] = await Promise.all([
    tx.objectStore('media').getAll(),
    tx.objectStore('covers').getAll(),
    tx.objectStore('goals').getAll(),
  ]);
  await tx.done;

  const serializedCovers: SerializableCover[] = [];
  for (const cover of covers) {
    if (!(cover.image instanceof Blob)) throw new Error('Uma capa armazenada está inválida. Backup cancelado.');
    serializedCovers.push({
      id: cover.id, mediaId: cover.mediaId, mimeType: cover.mimeType,
      width: cover.width, height: cover.height, savedAt: cover.savedAt,
      base64: await blobToBase64(cover.image),
    });
  }
  const exportedAt = new Date().toISOString();
  const backup: BackupDocument = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    data: { media, covers: serializedCovers, goals, settings: { theme: getTheme() } },
  };
  const fileName = `acervo-backup-${exportedAt.slice(0, 16).replace(/[:T]/g, '-')}.json`;
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  if (blob.size > MAX_FILE_BYTES) {
    throw new Error('O backup ultrapassa 150 MB. Reduza a quantidade de capas antes de exportar.');
  }
  return { fileName, blob, summary: summarize(media, covers, goals) };
}

/** Valida o arquivo inteiro e decodifica todas as capas ANTES de alterar o banco. */
export async function prepareBackup(file: File): Promise<PreparedBackup> {
  if (!file.name.toLowerCase().endsWith('.json')) throw new Error('Selecione um arquivo de backup .json.');
  if (file.size === 0 || file.size > MAX_FILE_BYTES) throw new Error('O arquivo deve ter até 150 MB e não pode estar vazio.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text()) as unknown;
  } catch {
    throw new Error('O arquivo não contém um JSON válido. Nenhum dado foi alterado.');
  }
  if (!object(parsed) || parsed.format !== BACKUP_FORMAT || parsed.version !== BACKUP_VERSION) {
    throw new Error('Backup incompatível. É necessário um backup Acervo no formato versão 1. Nenhum dado foi alterado.');
  }
  if (!validTimestamp(parsed.exportedAt) || !object(parsed.data) ||
      !Array.isArray(parsed.data.media) || !Array.isArray(parsed.data.covers) ||
      !Array.isArray(parsed.data.goals) || !object(parsed.data.settings) ||
      !oneOf(parsed.data.settings.theme, ['dark', 'light'])) {
    throw new Error('Estrutura do backup incompleta ou inválida. Nenhum dado foi alterado.');
  }
  if (parsed.data.media.length > MAX_MEDIA || parsed.data.covers.length > MAX_COVERS || parsed.data.goals.length > MAX_GOALS) {
    throw new Error('O backup excede o limite de registros suportados por esta versão.');
  }

  const records: MediaRecord[] = [];
  const covers: CoverRecord[] = [];
  const goals: AnnualGoal[] = [];
  const mediaIds = new Set<string>();
  const coverIds = new Set<string>();
  const coverMediaIds = new Set<string>();
  const goalYears = new Set<number>();

  for (const [index, raw] of parsed.data.media.entries()) {
    validateMedia(raw, index);
    if (mediaIds.has(raw.id)) fail(`Há registros duplicados com ID ${raw.id}.`);
    mediaIds.add(raw.id);
    records.push(raw);
  }
  for (const [index, raw] of parsed.data.goals.entries()) {
    validateGoal(raw, index);
    if (goalYears.has(raw.year)) fail(`O ano ${raw.year} aparece mais de uma vez nas metas.`);
    goalYears.add(raw.year);
    goals.push(raw);
  }
  for (const [index, raw] of parsed.data.covers.entries()) {
    const cover = decodeCover(raw, index);
    if (coverIds.has(cover.id) || coverMediaIds.has(cover.mediaId)) fail('Há capas duplicadas no backup.');
    coverIds.add(cover.id);
    coverMediaIds.add(cover.mediaId);
    if (!mediaIds.has(cover.mediaId)) fail(`Uma capa (${index + 1}) está sem título correspondente.`);
    covers.push(cover);
  }
  const byMedia = new Map(covers.map((cover) => [cover.mediaId, cover.id]));
  for (const record of records) {
    if (record.coverId !== undefined && record.coverId !== byMedia.get(record.id)) {
      fail(`A capa de "${record.title}" não corresponde ao registro.`);
    }
    if (record.coverId === undefined && byMedia.has(record.id)) {
      fail(`"${record.title}" tem uma capa desvinculada no backup.`);
    }
  }

  const theme = parsed.data.settings.theme as 'dark' | 'light';
  return {
    records, covers, goals, theme,
    preview: {
      ...summarize(records, covers, goals),
      exportedAt: parsed.exportedAt,
      fileName: file.name,
      sizeBytes: file.size,
      theme,
    },
  };
}

/** Substituição atômica das três tabelas; um erro aborta toda a transação. */
export async function restoreBackup(prepared: PreparedBackup): Promise<void> {
  const db = await getDatabase();
  const tx = db.transaction(['media', 'covers', 'goals'], 'readwrite');
  try {
    await Promise.all([
      tx.objectStore('media').clear(),
      tx.objectStore('covers').clear(),
      tx.objectStore('goals').clear(),
    ]);
    for (const record of prepared.records) await tx.objectStore('media').put(record);
    for (const cover of prepared.covers) await tx.objectStore('covers').put(cover);
    for (const goal of prepared.goals) await tx.objectStore('goals').put(goal);
    await tx.done;
  } catch (error) {
    try { tx.abort(); } catch { /* A transação já pode ter sido abortada pelo navegador. */ }
    try { await tx.done; } catch { /* A transação abortada é esperada após a falha. */ }
    throw error;
  }
  // O tema é uma preferência opcional fora do IndexedDB; não deve invalidar a restauração.
  try { window.localStorage.setItem('acervo:theme', prepared.theme); } catch { /* Armazenamento restrito. */ }
}
