import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, Heart, Pencil, Trash2 } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { MediaCover } from '../components/media/MediaCover';
import { RatingStars } from '../components/media/RatingStars';
import { deleteMedia, getMedia, updateMedia } from '../services/mediaRepository';
import type { MediaRecord } from '../types/media';
import { categoryLabels, describeCategoryStatus, formatDate, priorityLabels } from '../utils/mediaLabels';

function getError(error: unknown) { return error instanceof Error ? error.message : 'Não foi possível completar a operação.'; }

export function MediaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [item, setItem] = useState<MediaRecord>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const saved = Boolean((location.state as { saved?: boolean } | null)?.saved);

  useEffect(() => {
    let active = true;
    if (!id) return;
    void getMedia(id).then((record) => {
      if (active) { setItem(record); if (!record) setError('Este título não foi encontrado.'); }
    }).catch((err: unknown) => { if (active) setError(getError(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  const toggleFavorite = async () => {
    if (!item || busy) return;
    setBusy(true);
    try {
      const updated = await updateMedia(item.id, { ...item, favorite: !item.favorite });
      setItem(updated);
      setError('');
    } catch (err) { setError(getError(err)); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!item || busy) return;
    const confirmed = window.confirm(`Excluir “${item.title}” e sua capa permanentemente? Esta ação não poderá ser desfeita.`);
    if (!confirmed) return;
    setBusy(true);
    try { await deleteMedia(item.id); navigate('/colecao', { replace: true }); }
    catch (err) { setError(getError(err)); setBusy(false); }
  };

  if (loading) return <div className="media-loading page-enter" role="status">Abrindo os detalhes...</div>;
  if (!item) return <div className="page-enter"><p className="media-alert media-alert--error" role="alert">{error || 'Título não encontrado.'}</p><Link className="btn btn--outline" to="/colecao"><ArrowLeft size={16} /> Voltar à coleção</Link></div>;

  const facts: { label: string; value?: string | number }[] = [
    { label: 'Categoria', value: categoryLabels[item.kind] },
    { label: 'Status', value: describeCategoryStatus(item.kind, item.status) },
    { label: 'Lançamento', value: item.releaseYear },
    { label: 'Início', value: item.startedOn ? formatDate(item.startedOn) : undefined },
    { label: 'Conclusão', value: item.completedOn ? formatDate(item.completedOn) : undefined },
    { label: 'Prioridade', value: item.priority ? priorityLabels[item.priority] : undefined },
  ];
  if (item.kind === 'book') facts.push(
    { label: 'Autor', value: item.author }, { label: 'Formato', value: item.format === 'physical' ? 'Físico' : item.format === 'ebook' ? 'E-book' : item.format === 'audiobook' ? 'Audiobook' : undefined },
    { label: 'Páginas', value: item.totalPages }, { label: 'Página atual', value: item.currentPage },
  );
  if (item.kind === 'movie') facts.push({ label: 'Diretor', value: item.director }, { label: 'Duração', value: item.durationMinutes ? `${item.durationMinutes} min` : undefined });
  if (item.kind === 'series') facts.push(
    { label: 'Temporada atual', value: item.currentSeason }, { label: 'Episódio atual', value: item.currentEpisode },
    { label: 'Total de temporadas', value: item.totalSeasons }, { label: 'Total de episódios', value: item.totalEpisodes },
  );

  return (
    <div className="media-detail-page page-enter">
      <Link className="media-back" to="/colecao"><ArrowLeft size={17} /> Minha coleção</Link>
      {saved && <div className="media-alert media-alert--success" role="status">Registro salvo com sucesso. Seus dados estão no armazenamento local.</div>}
      {error && <div className="media-alert media-alert--error" role="alert">{error}</div>}
      <div className="media-detail-hero">
        <MediaCover kind={item.kind} title={item.title} mediaId={item.id} coverId={item.coverId} className="media-cover--detail" />
        <div className="media-detail-hero__info">
          <div className="media-detail-kicker"><span>{categoryLabels[item.kind]}</span><span>•</span><span>{describeCategoryStatus(item.kind, item.status)}</span></div>
          <h1>{item.title}</h1>
          {item.kind === 'book' && item.author && <p className="media-detail-creator">de {item.author}</p>}
          {item.kind === 'movie' && item.director && <p className="media-detail-creator">Direção de {item.director}</p>}
          {item.genres.length > 0 && <div className="media-genres">{item.genres.map((genre) => <span key={genre}>{genre}</span>)}</div>}
          <div className="media-detail-rating"><RatingStars rating={item.rating} /></div>
          {item.completedOn && <p className="media-detail-finished"><CalendarDays size={17} /> Concluído em {formatDate(item.completedOn)}</p>}
          <div className="media-detail-actions">
            <Link className="btn btn--primary" to={`/editar/${item.id}`}><Pencil size={17} /> Editar registro</Link>
            <button className={`btn btn--outline ${item.favorite ? 'media-favorite-active' : ''}`} type="button" disabled={busy}
              aria-pressed={item.favorite} onClick={() => void toggleFavorite()}><Heart size={17} fill={item.favorite ? 'currentColor' : 'none'} /> {item.favorite ? 'Favorito' : 'Favoritar'}</button>
            <button className="btn btn--danger" type="button" disabled={busy} onClick={() => void remove()}><Trash2 size={17} /> Excluir</button>
          </div>
        </div>
      </div>
      <div className="media-detail-sections">
        <section className="media-form-panel">
          <span className="section-kicker">INFORMAÇÕES DO TÍTULO</span>
          <h2>Os detalhes</h2>
          <dl className="media-facts">
            {facts.filter((entry) => entry.value !== undefined).map(({ label, value }) =>
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
        </section>
        <section className="media-form-panel">
          <span className="section-kicker">REGISTRO PESSOAL</span>
          <h2>Minha impressão</h2>
          {item.notes ? <p className="media-detail-notes">{item.notes}</p> : <p className="media-detail-empty-notes">Ainda não há comentários. Adicione suas impressões quando quiser.</p>}
        </section>
      </div>
    </div>
  );
}
