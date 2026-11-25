import { getCoverBlob } from '../services/coverRepository';

// Cache apenas em memória: nunca usa localStorage nem expõe imagens entre sessões.
// Guarda Blobs e não object URLs (estas pertencem aos componentes montados).
const MAX_ENTRIES = 48;
const MAX_BYTES = 18 * 1024 * 1024;
const blobs = new Map<string, Blob>();
const pending = new Map<string, Promise<Blob | undefined>>();
let bytes = 0;
let generation = 0;

function cacheKey(mediaId: string, coverId: string): string { return `${mediaId}:${coverId}`; }

function remember(key: string, blob: Blob): void {
  if (blob.size > MAX_BYTES) return;
  const previous = blobs.get(key);
  if (previous) bytes -= previous.size;
  blobs.delete(key);
  blobs.set(key, blob);
  bytes += blob.size;
  while ((blobs.size > MAX_ENTRIES || bytes > MAX_BYTES) && blobs.size) {
    const oldest = blobs.keys().next().value;
    if (!oldest) break;
    const evicted = blobs.get(oldest);
    if (evicted) bytes -= evicted.size;
    blobs.delete(oldest);
  }
}

/** Deduplica chamadas simultâneas: cards repetidos compartilham o mesmo download. */
export function getCachedCoverBlob(mediaId: string, coverId: string): Promise<Blob | undefined> {
  const key = cacheKey(mediaId, coverId);
  const cached = blobs.get(key);
  if (cached) {
    blobs.delete(key);
    blobs.set(key, cached); // LRU
    return Promise.resolve(cached);
  }
  const inflight = pending.get(key);
  if (inflight) return inflight;
  const started = generation;
  const task = getCoverBlob(mediaId).then((blob) => {
    if (blob && started === generation) remember(key, blob);
    return started === generation ? blob : undefined;
  }).finally(() => {
    if (pending.get(key) === task) pending.delete(key);
  });
  pending.set(key, task);
  return task;
}

/** Chamada na troca de conta/logout para evitar reaproveitamento indevido. */
export function clearCoverBlobCache(): void {
  generation++;
  blobs.clear();
  pending.clear();
  bytes = 0;
}
