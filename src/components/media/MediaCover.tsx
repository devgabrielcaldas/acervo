import { BookOpen, Film, Tv } from 'lucide-react';
import { useCoverUrl } from '../../hooks/useCoverUrl';
import type { MediaCategory } from '../../types/media';

const icons = { book: BookOpen, movie: Film, series: Tv };

interface MediaCoverProps {
  kind: MediaCategory;
  title: string;
  mediaId?: string;
  coverId?: string;
  src?: string;
  className?: string;
}

export function MediaCover({ kind, title, mediaId, coverId, src, className = '' }: MediaCoverProps) {
  const storedUrl = useCoverUrl(mediaId, coverId);
  const Icon = icons[kind];
  const coverSrc = src ?? storedUrl;
  return (
    <div className={`media-cover media-cover--${kind} ${className}`}>
      {coverSrc ? (
        <img src={coverSrc} alt={`Capa de ${title}`} loading="lazy" />
      ) : (
        <div className="media-cover__fallback" aria-label={`Sem capa: ${title}`}>
          <Icon size={42} strokeWidth={1.1} aria-hidden="true" />
          <span>{title || 'Sua próxima história'}</span>
          <small>ACERVO</small>
        </div>
      )}
    </div>
  );
}
