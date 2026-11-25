import { useMemo, useState } from 'react';
import { ArrowRight, Bookmark, CalendarCheck2, CheckCircle2, Play, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { Link } from 'react-router';
import { CategoryTabs } from '../components/media/CategoryTabs';
import type { CategoryFilter } from '../components/media/CategoryTabs';
import { CompleteMediaDialog } from '../components/media/CompleteMediaDialog';
import { StartMediaDialog } from '../components/media/StartMediaDialog';
import { getMediaError } from '../hooks/useMediaLibrary';
import { updateMedia } from '../services/mediaRepository';
import { matchesMediaSearch } from '../utils/searchMedia';
import { MediaGridSkeleton } from '../components/media/MediaGridSkeleton';
import { RetryNotice } from '../components/common/RetryNotice';

import { MediaCard } from '../components/media/MediaCard';
import { useMediaLibrary } from '../hooks/useMediaLibrary';
import type { MediaRecord, WishPriority } from '../types/media';
import { priorityLabels } from '../utils/mediaLabels';

type PriorityFilter = WishPriority | 'all';
type WishlistSort = 'priority' | 'title' | 'recent';
const priorityScore: Record<WishPriority, number> = { high: 3, medium: 2, low: 1 };

export function WishlistPage() {
  const { items, loading, error, busyId, toggleFavorite, changeStatus, refresh } = useMediaLibrary();
  const [kind, setKind] = useState<CategoryFilter>('all');
  const [priority, setPriority] = useState<PriorityFilter>('all');
  const [sort, setSort] = useState<WishlistSort>('priority');
  const [search, setSearch] = useState('');
  const [completing, setCompleting] = useState<MediaRecord | null>(null);
  const [starting, setStarting] = useState<MediaRecord | null>(null);

  const wishlist = useMemo(() => items.filter((item) => item.status === 'wishlist'), [items]);
  const visible = useMemo(() => {
    return wishlist.filter((item) =>
      (kind === 'all' || item.kind === kind) &&
      (priority === 'all' || item.priority === priority) &&
      matchesMediaSearch(item, search),
    ).sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title, 'pt-BR');
      if (sort === 'recent') return b.createdAt.localeCompare(a.createdAt);
      return (priorityScore[b.priority ?? 'low'] - priorityScore[a.priority ?? 'low']) || a.title.localeCompare(b.title, 'pt-BR');
    });
  }, [wishlist, kind, priority, sort, search]);

  const hasFilters = kind !== 'all' || priority !== 'all' || sort !== 'priority' || search !== '';
  const clearFilters = () => { setKind('all'); setPriority('all'); setSort('priority'); setSearch(''); };

  return (
    <div className="page-enter acervo-lists-page">
      <header className="page-heading collection-heading">
        <div>
          <span className="eyebrow"><span className="eyebrow__line" /> AS PRÓXIMAS HISTÓRIAS</span>
          <h1>Lista de desejos<span className="heading-period">.</span></h1>
          <p>Livros na espera, filmes para uma noite especial e séries para começar.</p>
        </div>
        <Link className="btn btn--primary" to="/novo"><Plus size={17} /> Adicionar título</Link>
      </header>

      <div className="acervo-list-summary">
        <span className="acervo-list-summary__icon"><Bookmark size={21} /></span>
        <div><strong>{loading ? '—' : wishlist.length}</strong><span>{wishlist.length === 1 ? 'título para descobrir' : 'títulos para descobrir'}</span></div>
        <span className="acervo-list-summary__aside">Seus próximos capítulos começam aqui</span>
      </div>

      <div className="collection-toolbar acervo-list-filters">
        <CategoryTabs selected={kind} onChange={setKind} items={wishlist} />
        <div className="collection-filters">
          <label className="collection-search">
            <Search size={18} aria-hidden="true" />
            <span className="sr-only">Buscar na lista de desejos</span>
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar pelo título, autor ou gênero..." />
          </label>
          <label className="collection-select"><SlidersHorizontal size={16} aria-hidden="true" /><span className="sr-only">Prioridade</span>
            <select value={priority} onChange={(event) => setPriority(event.target.value as PriorityFilter)}>
              <option value="all">Todas as prioridades</option>
              <option value="high">Alta prioridade</option>
              <option value="medium">Média prioridade</option>
              <option value="low">Baixa prioridade</option>
            </select>
          </label>
          <label className="collection-select"><span className="sr-only">Ordenar a lista</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as WishlistSort)}>
              <option value="priority">Prioridade primeiro</option>
              <option value="title">Título A–Z</option>
              <option value="recent">Adicionados recentemente</option>
            </select>
          </label>
        </div>
      </div>

      <div className="collection-results">
        <span className="section-kicker">{loading ? 'CARREGANDO...' : `${visible.length} ${visible.length === 1 ? 'TÍTULO' : 'TÍTULOS'}`}</span>
        {hasFilters && <button type="button" className="collection-clear" onClick={clearFilters}>Limpar filtros <ArrowRight size={14} /></button>}
      </div>
      {error && <RetryNotice message={error} onRetry={() => { void refresh().catch(() => {}); }} />}
      {loading ? <MediaGridSkeleton count={6} /> : visible.length ? (
        <div className="media-grid acervo-action-grid">
          {visible.map((item) => (
            <div className="acervo-action-item" key={item.id}>
              <MediaCard item={item} busy={busyId === item.id} onFavorite={(record) => { void toggleFavorite(record); }} />
              <div className="acervo-action-item__toolbar">
                <span className={`acervo-priority ${item.priority ? `acervo-priority--${item.priority}` : ''}`}>
                  {item.priority ? `Prioridade ${priorityLabels[item.priority].toLowerCase()}` : 'Sem prioridade'}
                </span>
                <Link to={`/editar/${item.id}`} className="acervo-mini-link">Editar</Link>
              </div>
              <div className="acervo-action-item__buttons">
                <button type="button" disabled={Boolean(busyId)} onClick={() => setStarting(item)}>
                  <Play size={14} /> Começar
                </button>
                <button type="button" disabled={Boolean(busyId)} onClick={() => setCompleting(item)}>
                  <CheckCircle2 size={14} /> Concluir
                </button>
              </div>
              <button className="acervo-remove-wish" type="button" disabled={Boolean(busyId)}
                title="Move para Pausado, sem apagar o título ou a capa"
                onClick={() => { void changeStatus(item, 'paused'); }}>
                Retirar dos desejos sem excluir <ArrowRight size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : error ? null : (
        <div className="collection-empty">
          <div className="collection-empty__icon"><Bookmark size={30} /></div>
          <h2>{wishlist.length ? 'Nenhum título encontrado' : 'O que vem a seguir?'}</h2>
          <p>{wishlist.length ? 'Tente outra categoria, prioridade ou busca.' : 'Comece salvando um livro, filme ou série com o status “Quero ler” ou “Quero assistir”.'}</p>
          {wishlist.length ? <button type="button" className="btn btn--outline" onClick={clearFilters}>Limpar filtros</button>
            : <Link className="btn btn--primary" to="/novo"><Plus size={16} /> Adicionar primeiro desejo</Link>}
        </div>
      )}

      <p className="acervo-help-note"><CalendarCheck2 size={16} /> Ao concluir um título, você escolhe a data real. Ao retirar dos desejos, ele vai para “Pausado”, sem perder informações.</p>
      {starting && <StartMediaDialog key={starting.id} item={starting} onClose={() => setStarting(null)}
        onSave={async patch => {
          try { await updateMedia(starting.id, { ...starting, ...patch }); await refresh(); return null; }
          catch (reason) { return getMediaError(reason); }
        }} />}
      {completing && <CompleteMediaDialog key={completing.id} item={completing} onClose={() => setCompleting(null)}
        onComplete={async patch => {
          try { await updateMedia(completing.id, { ...completing, ...patch }); await refresh(); return null; }
          catch (reason) { return getMediaError(reason); }
        }} />}
    </div>
  );
}
