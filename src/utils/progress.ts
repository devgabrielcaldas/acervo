import type { MediaRecord } from '../types/media';

export interface ProgressData { percent: number; description: string; }

/** Formato estrito HH:MM:SS; não é hora do dia, é posição de reprodução. */
export function parsePlaybackTime(value: string): number | undefined {
  if (!value.trim()) return undefined;
  if (!/^\d{1,2}:\d{2}:\d{2}$/.test(value.trim())) throw new Error('Informe o tempo como HH:MM:SS (ex.: 00:48:40).');
  const [h,m,s] = value.trim().split(':').map(Number);
  if (h > 99 || m > 59 || s > 59) throw new Error('Tempo inválido: minutos e segundos devem ser menores que 60.');
  return h*3600 + m*60 + s;
}
export function formatPlaybackTime(seconds?: number): string {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return '';
  const t = Math.floor(seconds);
  return `${String(Math.floor(t/3600)).padStart(2,'0')}:${String(Math.floor(t%3600/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;
}
export function seasonDisplayTitle(seriesTitle: string, seasonNumber: number): string {
  return `${seriesTitle.trim()} — Temp. ${seasonNumber}`;
}
/** Uma temporada concluída conta como UM registro concluído nas estatísticas anuais. */
export function mediaProgress(item: MediaRecord): ProgressData | undefined {
  if (item.status !== 'in_progress' && item.status !== 'paused') return undefined;
  let value: number | undefined;
  let description = '';
  if (item.kind === 'book') {
    if (item.format === 'ebook' && item.ebookPercent !== undefined) {
      value = item.ebookPercent;
      description = `E-book · ${value}%`;
    } else if (item.format !== 'ebook' && item.format !== 'audiobook' && item.totalPages && item.currentPage !== undefined) {
      value = (item.currentPage / item.totalPages) * 100;
      description = `Página ${item.currentPage} de ${item.totalPages}`;
    }
  } else if (item.kind === 'series') {
    if (item.totalEpisodes && item.currentEpisode !== undefined) {
      value = item.currentEpisode / item.totalEpisodes * 100;
      description = `${item.currentEpisode} de ${item.totalEpisodes} episódios`;
    }
  } else if (item.durationMinutes && item.pausedAtSeconds !== undefined) {
    value = item.pausedAtSeconds / (item.durationMinutes * 60) * 100;
    description = `Filme · ${formatPlaybackTime(item.pausedAtSeconds)} de ${formatPlaybackTime(item.durationMinutes * 60)}`;
  }
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return { percent: Math.round(Math.min(100,Math.max(0,value))*10)/10, description };
}
