import { getDatabase } from './database';
import type { CoverRecord } from '../types/media';

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1200;
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Redimensiona uma imagem local antes do armazenamento. */
async function prepareCover(file: Blob): Promise<Pick<CoverRecord, 'image' | 'mimeType' | 'width' | 'height'>> {
  if (!ACCEPTED_TYPES.has(file.type)) {
    throw new Error('Use uma imagem JPG, PNG ou WebP.');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('A imagem deve ter, no máximo, 12 MB.');
  }

  const sourceUrl = URL.createObjectURL(file);
  const image = new Image();
  try {
    image.src = sourceUrl;
    try {
      await image.decode();
    } catch {
      throw new Error('A imagem está corrompida ou em um formato não compatível.');
    }
    if (image.naturalWidth === 0 || image.naturalHeight === 0) {
      throw new Error('A imagem selecionada não pôde ser lida.');
    }

    const ratio = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * ratio));
    const height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('O navegador não permite processar imagens.');
    context.drawImage(image, 0, 0, width, height);

    const compressed = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Não foi possível compactar a imagem.')),
        'image/webp',
        0.82,
      );
    });
    return { image: compressed, mimeType: compressed.type, width, height };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

/** Troca a capa mantendo, no máximo, uma imagem por registro. */
export async function saveCover(mediaId: string, file: Blob): Promise<CoverRecord> {
  const prepared = await prepareCover(file);
  const db = await getDatabase();
  const tx = db.transaction(['media', 'covers'], 'readwrite');
  const items = tx.objectStore('media');
  const covers = tx.objectStore('covers');
  const item = await items.get(mediaId);
  if (!item) {
    await tx.done;
    throw new Error('Cadastre o item antes de adicionar uma capa.');
  }

  const previous = await covers.index('by-media-id').get(mediaId);
  if (previous) await covers.delete(previous.id);

  const cover: CoverRecord = {
    id: crypto.randomUUID(),
    mediaId,
    ...prepared,
    savedAt: new Date().toISOString(),
  };
  await covers.put(cover);
  await items.put({ ...item, coverId: cover.id, updatedAt: new Date().toISOString() });
  await tx.done;
  return cover;
}

export async function getCoverBlob(mediaId: string): Promise<Blob | undefined> {
  const db = await getDatabase();
  const cover = await db.getFromIndex('covers', 'by-media-id', mediaId);
  return cover?.image;
}

export async function removeCover(mediaId: string): Promise<void> {
  const db = await getDatabase();
  const tx = db.transaction(['media', 'covers'], 'readwrite');
  const items = tx.objectStore('media');
  const covers = tx.objectStore('covers');
  const item = await items.get(mediaId);
  const cover = await covers.index('by-media-id').get(mediaId);
  if (cover) await covers.delete(cover.id);
  if (item) {
    const updated = { ...item };
    delete updated.coverId;
    await items.put({ ...updated, updatedAt: new Date().toISOString() });
  }
  await tx.done;
}
