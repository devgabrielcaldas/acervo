import { cloudSummary } from './cloudRepository';
import { getCoverBlob, saveCover } from './coverRepository';
import { addMedia, deleteMedia, getMedia, listMedia, updateMedia } from './mediaRepository';
import type { StorageSummary } from '../types/media';

/** Retorna contagens reais do banco deste navegador. */
export async function getStorageSummary(): Promise<StorageSummary> {
  return cloudSummary();
}

/** Testa cadastro, consulta, edição, busca e imagem; remove tudo ao final. */
export async function runStorageSelfTest(): Promise<void> {
  const created = await addMedia({
    kind: 'book',
    title: 'Teste técnico temporário do Acervo',
    status: 'wishlist',
  });

  try {
    const saved = await getMedia(created.id);
    if (!saved || saved.title !== created.title) throw new Error('Falha ao ler o registro gravado.');

    const results = await listMedia({ kind: 'book', status: 'wishlist' });
    if (!results.some((record) => record.id === created.id)) {
      throw new Error('Falha na consulta pelo índice.');
    }

    const updated = await updateMedia(created.id, {
      kind: 'book', title: created.title, status: 'in_progress', currentPage: 10,
    });
    if (updated.kind !== 'book' || updated.status !== 'in_progress' || updated.currentPage !== 10) {
      throw new Error('Falha ao editar o registro.');
    }

    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('O navegador não permite testar capas.');
    ctx.fillStyle = '#d5ad79';
    ctx.fillRect(0, 0, 16, 16);
    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Falha ao gerar a capa de teste.')), 'image/png');
    });
    await saveCover(created.id, png);
    const downloaded = await getCoverBlob(created.id);
    if (!downloaded || downloaded.size === 0) throw new Error('Falha ao recuperar a capa.');
  } finally {
    await deleteMedia(created.id);
  }

  if (await getMedia(created.id)) throw new Error('Falha ao excluir o registro de teste.');
  if (await getCoverBlob(created.id)) throw new Error('Falha ao excluir a capa de teste.');
}
