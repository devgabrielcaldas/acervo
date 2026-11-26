import { cloudListGoals, cloudListMedia } from './cloudRepository';
import { goalsToCsv, mediaToCsv } from './portableCsv';

/** Exportação somente leitura: não altera Supabase, capas ou backups JSON. */
export async function createCsvExport(kind: 'catalog' | 'goals'): Promise<{ blob: Blob; fileName: string }> {
  const date = new Date().toISOString().slice(0, 10);
  const csv = kind === 'catalog'
    ? mediaToCsv(await cloudListMedia())
    : goalsToCsv(await cloudListGoals());
  return {
    blob: new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    fileName: `acervo-${kind === 'catalog' ? 'catalogo' : 'metas'}-${date}.csv`,
  };
}
