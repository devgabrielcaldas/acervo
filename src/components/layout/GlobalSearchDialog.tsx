import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ArrowUpRight, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import { MediaCover } from '../media/MediaCover';
import { listMedia } from '../../services/mediaRepository';
import { matchesMediaSearch } from '../../utils/searchMedia';
import { describeCategoryStatus } from '../../utils/mediaLabels';
import type { MediaRecord } from '../../types/media';

export function GlobalSearchDialog({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<MediaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    void listMedia().then(records => {
      if (active) { setItems(records); setLoading(false); setError(''); }
    }).catch((reason: unknown) => {
      if (active) { setError(reason instanceof Error ? reason.message : 'Não foi possível pesquisar sua coleção.'); setLoading(false); }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    inputRef.current?.focus();
    return () => { document.body.style.overflow = previous; };
  }, []);

  const results = useMemo(() => query.trim()
    ? items.filter(item => matchesMediaSearch(item, query)).slice(0, 12)
    : [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6), [items, query]);

  function openItem(item: MediaRecord) {
    onClose();
    navigate(`/colecao/${item.id}`);
  }

  function onKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
    if (event.key === 'ArrowDown' && results.length) { event.preventDefault(); setSelected(value => (value + 1) % results.length); }
    if (event.key === 'ArrowUp' && results.length) { event.preventDefault(); setSelected(value => (value + results.length - 1) % results.length); }
    if (event.key === 'Enter' && results.length && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault(); openItem(results[Math.min(selected, results.length - 1)]);
    }
    if (event.key === 'Tab') {
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('input:not([disabled]),button:not([disabled])');
      if (!focusable?.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }

  return (
    <div className="acervo-global-search-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Buscar na coleção" className="acervo-global-search" onKeyDown={onKeyboard}>
        <div className="acervo-global-search__top">
          <Search size={20} aria-hidden="true" />
          <input ref={inputRef} aria-label="Buscar em seus títulos" placeholder="Busque título, autor, diretor ou gênero..."
            value={query} onChange={e => { setQuery(e.target.value); setSelected(0); }} />
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar busca"><X size={19} /></button>
        </div>
        <div className="acervo-global-search__results" aria-live="polite" aria-busy={loading}>
          <span className="section-kicker">{query ? 'RESULTADOS NA SUA COLEÇÃO' : 'ALTERADOS RECENTEMENTE'}</span>
          {loading ? <p role="status">Carregando sua coleção...</p> : error ? (
            <div role="alert"><p>{error}</p><p>A coleção não foi alterada. Feche e tente novamente.</p></div>
          ) : results.length ? (
            <div className="acervo-global-search__list" role="list">
              {results.map((item, index) => (
                <div role="listitem" key={item.id}>
                  <button type="button" onMouseEnter={() => setSelected(index)} onClick={() => openItem(item)}
                    className={`acervo-global-search__item ${index === selected ? 'is-selected' : ''}`}>
                    <MediaCover kind={item.kind} title={item.title} mediaId={item.id} coverId={item.coverId} />
                    <span className="acervo-global-search__description"><strong>{item.title}</strong>
                      <small>{item.kind === 'book' ? item.author || 'Livro' : item.kind === 'movie' ? item.director || 'Filme' : item.seriesTitle || 'Série'} · {describeCategoryStatus(item.kind, item.status)}</small>
                    </span>
                    <ArrowUpRight size={17} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          ) : <p>{query ? 'Nenhum título encontrado. Tente outra palavra ou acentuação.' : 'Sua coleção está vazia.'}</p>}
        </div>
        <div className="acervo-global-search__footer"><span>Somente títulos já cadastrados na sua conta.</span><span>↑↓ navegar · Enter abrir · Esc fechar</span></div>
      </div>
    </div>
  );
}
