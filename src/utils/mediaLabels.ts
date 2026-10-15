import type { DateOnly, MediaCategory, MediaStatus, WishPriority } from '../types/media';

export const categoryLabels: Record<MediaCategory, string> = {
  book: 'Livro', movie: 'Filme', series: 'Série',
};
export const statusLabels: Record<MediaStatus, string> = {
  wishlist: 'Quero conhecer', in_progress: 'Em andamento', completed: 'Concluído',
  paused: 'Pausado', abandoned: 'Abandonado',
};
export const priorityLabels: Record<WishPriority, string> = {
  high: 'Alta', medium: 'Média', low: 'Baixa',
};
export function formatDate(date?: DateOnly): string {
  if (!date) return 'Não informada';
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}
export function describeCategoryStatus(kind: MediaCategory, status: MediaStatus): string {
  if (status === 'wishlist') return kind === 'book' ? 'Quero ler' : 'Quero assistir';
  if (status === 'in_progress') return kind === 'book' ? 'Lendo' : 'Assistindo';
  if (status === 'completed') return kind === 'book' ? 'Lido' : 'Assistido';
  return statusLabels[status];
}
