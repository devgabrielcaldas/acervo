import { Clock3 } from 'lucide-react';
import type { MediaRecord } from '../../types/media';
import { formatPlaybackTime, mediaProgress } from '../../utils/progress';

/** Indicador apenas para títulos em andamento ou pausados, sem inventar progresso. */
export function MediaProgress({ item }: { item: MediaRecord }) {
  if (item.status !== 'in_progress' && item.status !== 'paused') return null;
  const progress = mediaProgress(item);
  const position = item.kind === 'book' ? undefined : item.pausedAtSeconds;
  if (!progress && position === undefined) return null;
  return <div className="acervo-media-progress">
    {progress && <>
      <div className="acervo-media-progress__label"><span>{progress.description}</span><strong>{progress.percent.toLocaleString('pt-BR', {maximumFractionDigits: 1})}%</strong></div>
      <div className="acervo-media-progress__track" role="progressbar" aria-label={`Progresso de ${item.title}`}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}>
        <span style={{ width: `${progress.percent}%` }} />
      </div>
    </>}
    {position !== undefined && <span className="acervo-media-progress__pause"><Clock3 size={13} aria-hidden="true" /> Parou em {formatPlaybackTime(position)}</span>}
  </div>;
}
