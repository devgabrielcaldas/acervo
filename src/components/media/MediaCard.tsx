import { Heart } from 'lucide-react';
import { Link } from 'react-router';
import { MediaCover } from './MediaCover';
import { RatingStars } from './RatingStars';
import { categoryLabels, describeCategoryStatus } from '../../utils/mediaLabels';
import type { MediaRecord } from '../../types/media';

export function MediaCard({ item, onFavorite, busy = false }: {
  item: MediaRecord;
  onFavorite: (item: MediaRecord) => void;
  busy?: boolean;
}) {
  const subtitle = item.kind === 'book' ? item.author : item.kind === 'movie' ? item.director : undefined;
  return (
    <article className="media-card">
      <div className="media-card__visual">
        <Link className="media-card__cover-link" to={`/colecao/${item.id}`} aria-label={`Ver detalhes: ${item.title}`}>
          <MediaCover kind={item.kind} title={item.title} mediaId={item.id} coverId={item.coverId} />
        </Link>
        <button
          className={`media-card__heart ${item.favorite ? 'media-card__heart--active' : ''}`}
          type="button"
          disabled={busy}
          aria-label={item.favorite ? `Remover ${item.title} dos favoritos` : `Favoritar ${item.title}`}
          aria-pressed={item.favorite}
          onClick={() => onFavorite(item)}
        >
          <Heart size={18} fill={item.favorite ? 'currentColor' : 'none'} />
        </button>
        <span className="media-card__kind">{categoryLabels[item.kind]}</span>
      </div>
      <div className="media-card__text">
        <span className={`media-card__status media-card__status--${item.status}`}>
          <span aria-hidden="true" />{describeCategoryStatus(item.kind, item.status)}
        </span>
        <Link to={`/colecao/${item.id}`} className="media-card__title">{item.title}</Link>
        <p className="media-card__subtitle">{subtitle || (item.releaseYear ? `Lançamento: ${item.releaseYear}` : categoryLabels[item.kind])}</p>
        <RatingStars rating={item.rating} />
      </div>
    </article>
  );
}
