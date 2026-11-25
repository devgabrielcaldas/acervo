import { Heart, Play } from 'lucide-react';
import { Link } from 'react-router';
import { MediaCover } from './MediaCover';
import { RatingStars } from './RatingStars';
import { MediaProgress } from './MediaProgress';
import { categoryLabels, describeCategoryStatus } from '../../utils/mediaLabels';
import type { MediaRecord } from '../../types/media';
import { getSeriesCardTitle } from '../../utils/cardSeasonTitle';

export function MediaListRow({ item, busy, onFavorite, onStart }: {
  item: MediaRecord;
  busy?: boolean;
  onFavorite: (item: MediaRecord) => void;
  onStart: (item: MediaRecord) => void;
}) {
  const season = getSeriesCardTitle(item);
  const subtitle = item.kind === 'book' ? item.author : item.kind === 'movie' ? item.director : (season ? `Temporada ${season.season}` : 'Série');
  return (
    <article className="acervo-media-row">
      <Link to={`/colecao/${item.id}`} className="acervo-media-row__cover" aria-label={`Detalhes de ${item.title}`}>
        <MediaCover kind={item.kind} title={item.title} mediaId={item.id} coverId={item.coverId} />
      </Link>
      <div className="acervo-media-row__text">
        <Link to={`/colecao/${item.id}`} className="acervo-media-row__title">{season ? `${season.name} · Temp. ${season.season}` : item.title}</Link>
        <span>{subtitle || categoryLabels[item.kind]}</span>
      </div>
      <span className="acervo-media-row__status">{describeCategoryStatus(item.kind, item.status)}</span>
      <span className="acervo-media-row__rating"><RatingStars rating={item.rating} /></span>
      <div className="acervo-media-row__progress"><MediaProgress item={item} /></div>
      <div className="acervo-media-row__actions">
        {item.status === 'wishlist' && <button type="button" className="acervo-media-row__start" disabled={busy} onClick={() => onStart(item)} aria-label={`Iniciar ${item.title}`} title="Iniciar"><Play size={16}/></button>}
        <button type="button" className="acervo-media-row__favorite" disabled={busy} onClick={() => onFavorite(item)}
          aria-pressed={item.favorite} aria-label={item.favorite ? `Desfavoritar ${item.title}` : `Favoritar ${item.title}`}>
          <Heart size={17} fill={item.favorite ? 'currentColor' : 'none'} />
        </button>
      </div>
    </article>
  );
}
