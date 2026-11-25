import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BookOpen, BookmarkPlus, CalendarDays, Film, LayoutGrid, LibraryBig, List, Play, Plus, Search, SlidersHorizontal, Trash2, Tv, UserRound } from 'lucide-react';
import { Link } from 'react-router';
import { MediaCard } from '../components/media/MediaCard';
import { MediaListRow } from '../components/media/MediaListRow';
import { useAuth } from '../contexts/AuthContext';
import { listSavedViews, createSavedView, removeSavedView } from '../services/savedViewsRepository';
import { groupMediaSeasons, EMPTY_SMART_FILTERS } from '../utils/smartCollection';
import type { SavedSmartView, SmartFilters } from '../utils/smartCollection';
import { StartMediaDialog } from '../components/media/StartMediaDialog';
import { MediaGridSkeleton } from '../components/media/MediaGridSkeleton';
import { RetryNotice } from '../components/common/RetryNotice';
import { getMediaError } from '../hooks/useMediaLibrary';

import { listMedia, updateMedia } from '../services/mediaRepository';
import type { MediaCategory, MediaRecord, MediaStatus } from '../types/media';
import { statusLabels } from '../utils/mediaLabels';
import { matchesMediaSearch } from '../utils/searchMedia';
import { getCompletionYear, listCompletionYears } from '../utils/completionYears';

type KindFilter = MediaCategory | 'all';
type StatusFilter = MediaStatus | 'all';
type SortMode = 'recent' | 'title' | 'completed' | 'rating';

const tabs = [
  { key: 'all', label: 'Todos', icon: LibraryBig },
  { key: 'book', label: 'Livros', icon: BookOpen },
  { key: 'movie', label: 'Filmes', icon: Film },
  { key: 'series', label: 'Séries', icon: Tv },
] as const;

const authorCollator = new Intl.Collator('pt-BR', { sensitivity: 'base' });

function formatCount(n: number) { return `${n} ${n === 1 ? 'título' : 'títulos'}`; }
function errorText(error: unknown) { return error instanceof Error ? error.message : 'Não foi possível acessar seus registros.'; }

export function CollectionPage() {
  const [items, setItems] = useState<MediaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [author, setAuthor] = useState('all');
  const [completionYear, setCompletionYear] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('recent');
  const [busyId, setBusyId] = useState<string>();
  const [starting, setStarting] = useState<MediaRecord | null>(null);
  const { user } = useAuth();
  const [minRating, setMinRating] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const mobileFilterButtonRef = useRef<HTMLButtonElement>(null);
  const [groupSeasons, setGroupSeasons] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedSmartView[]>([]);
  const [viewName, setViewName] = useState('');
  const [viewBusy, setViewBusy] = useState(false);
  const [viewLoading, setViewLoading] = useState(true);
  const [viewError, setViewError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const results = await listMedia();
      setItems(results);
      setError('');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void listMedia()
      .then((records) => {
        if (active) {
          setItems(records);
          setError('');
        }
      })
      .catch((err: unknown) => {
        if (active) setError(errorText(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  // Filtros são salvos no Supabase com RLS: cada usuário só vê os próprios.
  useEffect(() => {
    if (!user?.id) { setSavedViews([]); setViewLoading(false); return; }
    let active = true;
    setViewLoading(true);
    void listSavedViews().then(views => {
      if (active) { setSavedViews(views); setViewError(''); }
    }).catch((reason: unknown) => {
      if (active) setViewError(reason instanceof Error ? reason.message : 'Não foi possível carregar seus filtros.');
    }).finally(() => { if (active) setViewLoading(false); });
    return () => { active = false; };
  }, [user?.id]);

  // Extrai apenas autores de livros desta conta, remove repetições e ordena A–Z.
  const authors = useMemo(() => {
    const names = items.flatMap((item) =>
      item.kind === 'book' && item.author?.trim()
        ? [item.author.trim().replace(/\s+/g, ' ')]
        : [],
    ).sort(authorCollator.compare);

    return names.filter((name, index) =>
      index === 0 || authorCollator.compare(name, names[index - 1]) !== 0,
    );
  }, [items]);

  // Opções dinâmicas: somente anos com pelo menos um título realmente concluído e datado.
  const completionYears = useMemo(() => listCompletionYears(items), [items]);
  const selectedYear = completionYear === 'all' || completionYears.includes(completionYear)
    ? completionYear
    : 'all';

  // Se um autor deixar de existir na coleção, evita um filtro sem opção no select.
  const selectedAuthor = authors.some((name) => authorCollator.compare(name, author) === 0)
    ? author
    : 'all';

  const visible = useMemo(() => {
    const result = items.filter((item) =>
      (kind === 'all' || item.kind === kind) &&
      (status === 'all' || item.status === status) &&
      (selectedYear === 'all' || getCompletionYear(item) === selectedYear) &&
      (selectedAuthor === 'all' || (item.kind === 'book' &&
        authorCollator.compare(item.author?.trim().replace(/\s+/g, ' ') ?? '', selectedAuthor) === 0)) &&
      (minRating === 'all' || (item.rating !== undefined && item.rating >= Number(minRating))) &&
      matchesMediaSearch(item, search),
    );
    return result.sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title, 'pt-BR');
      if (sort === 'rating') return (b.rating ?? -1) - (a.rating ?? -1) || b.updatedAt.localeCompare(a.updatedAt);
      if (sort === 'completed') return (b.completedOn ?? '').localeCompare(a.completedOn ?? '') || b.updatedAt.localeCompare(a.updatedAt);
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [items, kind, status, selectedYear, selectedAuthor, search, sort, minRating]);

  const toggleFavorite = async (item: MediaRecord) => {
    setBusyId(item.id);
    try {
      await updateMedia(item.id, { ...item, favorite: !item.favorite });
      await refresh();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusyId(undefined);
    }
  };

  // Selecionar um ano significa necessariamente buscar entre os itens concluídos.
  const changeCompletionYear = (value: string) => {
    setCompletionYear(value);
    if (value !== 'all') setStatus('completed');
  };

  // Outro status (como Quero ler) não pode coexistir com um ano de conclusão.
  const changeStatus = (value: StatusFilter) => {
    setStatus(value);
    if (value !== 'completed') setCompletionYear('all');
  };

  const clearFilters = () => {
    setKind('all'); setStatus('all'); setAuthor('all'); setCompletionYear('all'); setSearch(''); setSort('recent'); setMinRating('all');
  };
  const hasFilters = kind !== 'all' || status !== 'all' || selectedAuthor !== 'all' || selectedYear !== 'all' || search.length > 0 || sort !== 'recent' || minRating !== 'all';
  const advancedFilterCount = [
    status !== 'all', selectedAuthor !== 'all', selectedYear !== 'all',
    sort !== 'recent', minRating !== 'all', groupSeasons,
  ].filter(Boolean).length;
  const grouped = useMemo(() => groupMediaSeasons(visible), [visible]);
  const activeFilters: SmartFilters = { ...EMPTY_SMART_FILTERS, kind, status, author: selectedAuthor,
    completionYear: selectedYear, search, sort, minRating };

  function applySavedView(view: SavedSmartView) {
    const f = view.filters;
    setKind(f.kind);
    setStatus(f.completionYear !== 'all' ? 'completed' : f.status);
    setCompletionYear(f.completionYear !== 'all' && f.status === 'completed' ? f.completionYear : 'all');
    setAuthor(f.author); setSearch(f.search); setSort(f.sort); setMinRating(f.minRating);
    setMobileFiltersOpen(false);
    window.requestAnimationFrame(() => mobileFilterButtonRef.current?.focus());
  }

  async function saveCurrentView() {
    const name = viewName.trim();
    if (!name) { setViewError('Informe o nome do filtro.'); return; }
    if (savedViews.length >= 12) { setViewError('Limite de 12 filtros salvos por conta.'); return; }
    setViewBusy(true); setViewError('');
    try {
      await createSavedView(name, activeFilters);
      setSavedViews(await listSavedViews()); setViewName('');
    } catch (reason) { setViewError(reason instanceof Error ? reason.message : 'Erro ao salvar o filtro.'); }
    finally { setViewBusy(false); }
  }

  async function deleteSavedView(view: SavedSmartView) {
    if (!window.confirm(`Excluir o filtro salvo “${view.name}”? Os títulos da coleção não serão excluídos.`)) return;
    setViewBusy(true); setViewError('');
    try { await removeSavedView(view.id); setSavedViews(current => current.filter(item => item.id !== view.id)); }
    catch (reason) { setViewError(reason instanceof Error ? reason.message : 'Erro ao remover o filtro.'); }
    finally { setViewBusy(false); }
  }

  function renderEntry(item: MediaRecord) {
    return <div className={`acervo-collection-entry ${viewMode === 'list' ? 'acervo-smart-list-entry' : ''}`} key={item.id}>
      {viewMode === 'list' ? (
        <MediaListRow item={item} busy={busyId === item.id} onFavorite={selected => void toggleFavorite(selected)} onStart={setStarting} />
      ) : <>
        <MediaCard item={item} busy={busyId === item.id} onFavorite={selected => void toggleFavorite(selected)} />
        {item.status === 'wishlist' && <button type="button" className="btn btn--outline acervo-collection-start" disabled={Boolean(busyId)}
          onClick={() => setStarting(item)}><Play size={15} aria-hidden="true" /> Iniciar</button>}
      </>}
    </div>;
  }

  const entriesClass = viewMode === 'list' ? 'acervo-media-list' : 'media-grid';

  return (
    <div className="collection-page page-enter">
      <div className="page-heading collection-heading">
        <div>
          <span className="eyebrow"><span className="eyebrow__line" /> SEU UNIVERSO DE HISTÓRIAS</span>
          <h1>Minha coleção<span className="heading-period">.</span></h1>
          <p>Um lugar para tudo o que você leu, assistiu ou ainda deseja conhecer.</p>
        </div>
        <Link className="btn btn--primary" to="/novo"><Plus size={17} /> Novo título</Link>
      </div>

      <div className={`collection-toolbar${mobileFiltersOpen ? ' acervo-mobile-filters-open' : ''}`}>
        <div className="collection-tabs" role="group" aria-label="Filtrar por categoria">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button key={key} type="button" className={`collection-tab ${kind === key ? 'collection-tab--active' : ''}`}
              aria-pressed={kind === key} onClick={() => {
                setKind(key);
                if (key === 'movie' || key === 'series') setAuthor('all');
              }}>
              <Icon size={17} /><span>{label}</span>
              <small>{key === 'all' ? items.length : items.filter((item) => item.kind === key).length}</small>
            </button>
          ))}
        </div>
        <div id="acervo-advanced-selects" className="collection-filters">
          <label className="collection-search">
            <Search size={18} aria-hidden="true" />
            <span className="sr-only">Buscar por título, autor, diretor ou gênero</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar na coleção..." />
          </label>
          <button ref={mobileFilterButtonRef} type="button" className="acervo-mobile-filter-toggle" aria-controls="acervo-advanced-selects acervo-advanced-filters"
            aria-expanded={mobileFiltersOpen} onClick={() => setMobileFiltersOpen(open => !open)}>
            <SlidersHorizontal size={17} aria-hidden="true" />
            <span>Filtros</span>
            {advancedFilterCount > 0 && <span className="acervo-mobile-filter-count">{advancedFilterCount}</span>}
          </button>
          {(kind === 'all' || kind === 'book') && authors.length > 0 && (
            <label className="collection-select collection-select--author">
              <UserRound size={16} aria-hidden="true" />
              <span className="sr-only">Filtrar livros por autor</span>
              <select value={selectedAuthor} onChange={(event) => setAuthor(event.target.value)}>
                <option value="all">Todos os autores</option>
                {authors.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
          )}
          <label className="collection-select">
            <SlidersHorizontal size={16} aria-hidden="true" />
            <span className="sr-only">Filtrar por status</span>
            <select value={status} onChange={(event) => changeStatus(event.target.value as StatusFilter)}>
              <option value="all">Todos os status</option>
              {(Object.keys(statusLabels) as MediaStatus[]).map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}
            </select>
          </label>
          {(status === 'all' || status === 'completed') && (
            <label className="collection-select collection-select--year">
              <CalendarDays size={16} aria-hidden="true" />
              <span className="sr-only">Filtrar por ano de conclusão</span>
              <select value={selectedYear} onChange={(event) => changeCompletionYear(event.target.value)}>
                <option value="all">Todos os anos</option>
                {completionYears.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          )}
          <label className="collection-select">
            <span className="sr-only">Ordenação</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}>
              <option value="recent">Mais recentes</option>
              <option value="title">Título A–Z</option>
              <option value="completed">Data de conclusão</option>
              <option value="rating">Maiores notas</option>
            </select>
          </label>
        </div>
      </div>

      <div id="acervo-advanced-filters" className={`acervo-mobile-advanced${mobileFiltersOpen ? ' acervo-mobile-advanced--open' : ''}`}>
      <div className="acervo-smart-options">
        <div className="acervo-smart-options__left">
          <label className="acervo-smart-rating">Avaliação
            <select value={minRating} onChange={e => setMinRating(e.target.value)} aria-label="Nota mínima">
              <option value="all">Todas as notas</option><option value="3">3,0 ou mais</option>
              <option value="4">4,0 ou mais</option><option value="4.5">4,5 ou mais</option><option value="5">Nota 5,0</option>
            </select>
          </label>
          <label className="acervo-smart-check"><input type="checkbox" checked={groupSeasons} onChange={e => setGroupSeasons(e.target.checked)} /> Agrupar temporadas</label>
        </div>
        <div className="acervo-smart-switch" role="group" aria-label="Modo de visualização">
          <button type="button" className={viewMode === 'grid' ? 'is-active' : ''} aria-pressed={viewMode === 'grid'} onClick={() => setViewMode('grid')}><LayoutGrid size={16}/> Cards</button>
          <button type="button" className={viewMode === 'list' ? 'is-active' : ''} aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')}><List size={16}/> Lista</button>
        </div>
      </div>
      <section className="acervo-saved-views" aria-label="Filtros favoritos">
        <div className="acervo-saved-views__heading">
          <span>FILTROS FAVORITOS {viewLoading ? '· carregando...' : `· ${savedViews.length}/12`}</span>
          <form className="acervo-saved-views__form" onSubmit={e => { e.preventDefault(); void saveCurrentView(); }}>
            <input value={viewName} maxLength={50} onChange={e => setViewName(e.target.value)} placeholder="Nome deste filtro" aria-label="Nome do filtro favorito" />
            <button type="submit" disabled={viewBusy || viewLoading || !viewName.trim()}><BookmarkPlus size={15}/> Salvar filtro atual</button>
          </form>
        </div>
        {savedViews.length > 0 && <div className="acervo-saved-views__chips">{savedViews.map(view =>
          <div className="acervo-saved-views__chip" key={view.id}>
            <button type="button" onClick={() => applySavedView(view)} title={`Aplicar ${view.name}`}>{view.name}</button>
            <button type="button" aria-label={`Excluir filtro ${view.name}`} disabled={viewBusy} onClick={() => void deleteSavedView(view)}><Trash2 size={13}/></button>
          </div>)}</div>}
        {viewError && <p className="acervo-saved-views__error" role="alert">{viewError}</p>}
        {!viewError && !viewLoading && !savedViews.length && <p className="acervo-saved-views__status">Escolha seus filtros e salve combinações para acessar rapidamente em qualquer dispositivo.</p>}
      </section>
      </div>

      <div className="collection-results">
        <div className="collection-results__description">
          <span className="section-kicker">{loading ? 'CARREGANDO...' : formatCount(visible.length).toLocaleUpperCase('pt-BR')}</span>
          {selectedYear !== 'all' && <span className="collection-year-note">Somente títulos concluídos com data registrada em {selectedYear}.</span>}
        </div>
        <div className="acervo-mobile-view-switch" role="group" aria-label="Visualização dos títulos">
          <button type="button" title="Exibir em cards" aria-label="Exibir em cards" aria-pressed={viewMode === 'grid'}
            className={viewMode === 'grid' ? 'is-active' : ''} onClick={() => setViewMode('grid')}>
            <LayoutGrid size={17} aria-hidden="true" />
          </button>
          <button type="button" title="Exibir em lista" aria-label="Exibir em lista" aria-pressed={viewMode === 'list'}
            className={viewMode === 'list' ? 'is-active' : ''} onClick={() => setViewMode('list')}>
            <List size={18} aria-hidden="true" />
          </button>
        </div>
        {hasFilters && <button className="collection-clear" type="button" onClick={clearFilters}>Limpar filtros <ArrowRight size={14} /></button>}
      </div>

      {error && <RetryNotice message={error} onRetry={() => { void refresh().catch(() => {}); }} />}
      {loading ? (
        <MediaGridSkeleton count={7} />
      ) : visible.length ? (
        groupSeasons && grouped.groups.length > 0 ? (
          <div className="acervo-season-results">
            {grouped.groups.map(group => <section className="acervo-season-group" key={group.key} aria-label={`Temporadas de ${group.name}`}>
              <div className="acervo-season-group__heading"><h2>{group.name}</h2><span>{group.items.length} temporadas nesta seleção</span></div>
              <div className={entriesClass}>{group.items.map(renderEntry)}</div>
            </section>)}
            {grouped.singles.length > 0 && <section className="acervo-season-group">
              <div className="acervo-season-group__heading"><h2>Demais títulos</h2><span>{grouped.singles.length} títulos</span></div>
              <div className={entriesClass}>{grouped.singles.map(renderEntry)}</div>
            </section>}
          </div>
        ) : <div className={entriesClass}>{visible.map(renderEntry)}</div>
      ) : error ? null : (
        <div className="collection-empty">
          <div className="collection-empty__icon"><LibraryBig size={31} strokeWidth={1.5} /></div>
          <h2>{items.length ? 'Nenhum título encontrado' : 'Sua coleção começa com uma história'}</h2>
          <p>{items.length ? 'Tente mudar os filtros ou a busca para encontrar outros registros.' : 'Cadastre um livro, filme ou série. Suas capas, notas e datas ficarão aqui, organizadas do seu jeito.'}</p>
          {items.length ? <button className="btn btn--outline" onClick={clearFilters} type="button">Limpar filtros</button>
            : <Link className="btn btn--primary" to="/novo"><Plus size={17} /> Adicionar primeiro título</Link>}
        </div>
      )}
      {starting && <StartMediaDialog key={starting.id} item={starting} onClose={() => setStarting(null)}
        onSave={async patch => {
          try { await updateMedia(starting.id, { ...starting, ...patch }); await refresh(); return null; }
          catch (reason) { return getMediaError(reason); }
        }} />}
    </div>
  );
}
