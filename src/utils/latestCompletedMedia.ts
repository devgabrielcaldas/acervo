import type { MediaCategory, MediaRecord } from '../types/media';

/**
 * Seleciona o último título CONCLUÍDO de uma categoria.
 * A data real de conclusão tem prioridade: editar uma nota não torna um
 * título antigo o mais recente. Títulos sem data só são usados quando
 * não existe nenhum concluído datado daquela categoria.
 * Não modifica a coleção original.
 */
export function latestCompletedMedia(
  items: readonly MediaRecord[],
  kind: MediaCategory,
): MediaRecord | undefined {
  const completed = items.filter((item) => item.kind === kind && item.status === 'completed');
  if (completed.length === 0) return undefined;

  const hasActualDate = (item: MediaRecord) =>
    typeof item.completedOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.completedOn);

  const dated = completed.filter(hasActualDate);
  const pool = dated.length > 0 ? dated : completed;

  const score = (item: MediaRecord) => dated.length > 0
    ? (item.completedOn ?? '')
    : (item.updatedAt || item.createdAt || '');

  return [...pool].sort((a, b) =>
    score(b).localeCompare(score(a)) ||
    (b.updatedAt || '').localeCompare(a.updatedAt || '') ||
    b.id.localeCompare(a.id),
  )[0];
}
