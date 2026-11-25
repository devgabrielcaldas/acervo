import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { PlaybackTimeInput } from './PlaybackTimeInput';
import { BookOpen, Clock3, Film, Play, Tv, X } from 'lucide-react';
import type { MediaRecord } from '../../types/media';
import { mediaProgress } from '../../utils/progress';
import { startDraft, startPatch } from '../../utils/startMedia';
import type { StartDraft, StartPatch } from '../../utils/startMedia';
import './quickProgressDialog.css';
import './startMediaDialog.css';

interface Props {
  item: MediaRecord;
  onClose: () => void;
  onSave: (patch: StartPatch) => Promise<string | null>;
}

/** Inicia um registro existente e pergunta apenas o progresso relevante à categoria. */
export function StartMediaDialog({ item, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<StartDraft>(() => startDraft(item));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const Icon = item.kind === 'book' ? BookOpen : item.kind === 'movie' ? Film : Tv;

  useEffect(() => {
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector<HTMLInputElement | HTMLSelectElement>('select, input:not([disabled])')?.focus();
    return () => { document.body.style.overflow = previousOverflow; focused?.focus(); };
  }, []);

  const change = <K extends keyof StartDraft>(key: K, value: StartDraft[K]) => {
    setDraft(previous => ({ ...previous, [key]: value }));
    setError('');
  };

  const keyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && !saving) { event.preventDefault(); onClose(); return; }
    if (event.key !== 'Tab') return;
    const elements = Array.from(ref.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled])',
    ) ?? []).filter(el => el.getClientRects().length > 0);
    if (!elements.length) return;
    if (event.shiftKey && document.activeElement === elements[0]) { event.preventDefault(); elements[elements.length - 1].focus(); }
    else if (!event.shiftKey && document.activeElement === elements[elements.length - 1]) { event.preventDefault(); elements[0].focus(); }
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let patch: StartPatch;
    try { patch = startPatch(item, draft); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Revise o progresso.'); return; }
    setSaving(true); setError('');
    try {
      const failure = await onSave(patch);
      if (failure) setError(failure);
      else onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível iniciar o título.');
    } finally { setSaving(false); }
  }

  let preview: number | undefined;
  try { preview = mediaProgress({ ...item, ...startPatch(item, draft) } as MediaRecord)?.percent; }
  catch { /* Validação final acontece ao salvar. */ }

  return createPortal(
    <div className="acervo-dialog-backdrop acervo-quick-overlay" onMouseDown={event => {
      if (event.target === event.currentTarget && !saving) onClose();
    }}>
      <section ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}
        onKeyDown={keyDown} className="acervo-dialog acervo-quick-dialog acervo-start-dialog">
        <div className="acervo-dialog__top">
          <span className="acervo-dialog__symbol"><Icon size={22} aria-hidden="true" /></span>
          <button type="button" className="icon-button" disabled={saving} onClick={onClose} aria-label="Fechar"><X size={19}/></button>
        </div>
        <div className="acervo-quick-intro">
          <span className="eyebrow">COMEÇAR UMA HISTÓRIA</span>
          <h2 id={titleId}>Iniciar <span className="heading-period">agora.</span></h2>
          <p id={descriptionId}><strong>{item.title}</strong> — informe onde você está. Pode começar do zero.</p>
        </div>
        <form onSubmit={event => void submit(event)} noValidate>
          <fieldset className="acervo-quick-fields" disabled={saving}>
            {item.kind === 'book' && <>
              <label className="media-field"><span>Formato da leitura</span>
                <select value={draft.bookFormat} onChange={event => change('bookFormat', event.target.value as StartDraft['bookFormat'])}>
                  <option value="physical">Livro físico (páginas)</option>
                  <option value="ebook">E-book (percentual)</option>
                  <option value="audiobook">Audiolivro (percentual)</option>
                </select>
              </label>
              {draft.bookFormat === 'physical' ? <div className="acervo-quick-two">
                <label className="media-field"><span>Página atual</span>
                  <input type="number" inputMode="numeric" min="0" step="1" value={draft.currentPage}
                    onChange={event => change('currentPage', event.target.value)} placeholder="0" /></label>
                <label className="media-field"><span>Total de páginas</span>
                  <input type="number" inputMode="numeric" min="1" step="1" value={draft.totalPages}
                    onChange={event => change('totalPages', event.target.value)} placeholder="Ex.: 350" /></label>
              </div> : <label className="media-field"><span>Percentual atual (%)</span>
                <input type="number" inputMode="numeric" min="0" max="100" step="1" value={draft.percent}
                  onChange={event => change('percent', event.target.value)} placeholder="0" /></label>}
            </>}
            {item.kind === 'movie' && <>
              <label className="media-field"><span><Clock3 size={15} aria-hidden="true"/> Posição do filme (HH:MM:SS)</span>
                <PlaybackTimeInput value={draft.pausedAt} onChange={next => change('pausedAt', next)} disabled={saving} />
                <small>Digite somente números (011740 vira 01:17:40). Deixe em branco se ainda não começou.</small>
              </label>
              <label className="media-field"><span>Duração total (minutos)</span>
                <input type="number" min="1" step="1" inputMode="numeric" value={draft.durationMinutes}
                  onChange={event => change('durationMinutes', event.target.value)} placeholder="Ex.: 139" /></label>
            </>}
            {item.kind === 'series' && <>
              <div className="acervo-quick-two">
                <label className="media-field"><span>Episódios concluídos</span>
                  <input type="number" min="0" step="1" inputMode="numeric" value={draft.watchedEpisodes}
                    onChange={event => change('watchedEpisodes', event.target.value)} /></label>
                <label className="media-field"><span>Episódios da temporada</span>
                  <input type="number" min="1" step="1" inputMode="numeric" value={draft.totalEpisodes}
                    onChange={event => change('totalEpisodes', event.target.value)} placeholder="Ex.: 10" /></label>
              </div>
              <label className="media-field"><span><Clock3 size={15} aria-hidden="true"/> Posição no próximo episódio (opcional)</span>
                <PlaybackTimeInput value={draft.pausedAt} onChange={next => change('pausedAt', next)} disabled={saving} />
                <small>O percentual da série considera somente os episódios concluídos.</small>
              </label>
            </>}
            <label className="media-field"><span>Data de início (opcional)</span>
              <input type="date" value={draft.startedOn} onChange={event => change('startedOn', event.target.value)} />
              <small>Informe apenas se souber quando começou; não será criada uma data fictícia.</small>
            </label>
          </fieldset>
          {preview !== undefined && <div className="acervo-quick-preview" aria-live="polite">
            <div><span>Progresso inicial</span><strong>{preview.toLocaleString('pt-BR', {maximumFractionDigits:1})}%</strong></div>
            <div className="acervo-quick-preview__bar"><span style={{width:`${preview}%`}} /></div>
          </div>}
          {error && <p className="media-alert media-alert--error" role="alert">{error}</p>}
          <div className="acervo-dialog__actions acervo-quick-actions">
            <button type="button" className="btn btn--outline" disabled={saving} onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn--primary" disabled={saving}><Play size={16} /> {saving ? 'Salvando...' : 'Iniciar título'}</button>
          </div>
        </form>
      </section>
    </div>, document.body,
  );
}
