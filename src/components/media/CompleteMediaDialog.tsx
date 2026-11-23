import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { CalendarCheck2, CheckCircle2, X } from 'lucide-react';
import { RatingStars } from './RatingStars';
import type { MediaRecord } from '../../types/media';
import { completeDraft, completePatch } from '../../utils/completeMedia';
import type { CompleteDraft, CompletePatch } from '../../utils/completeMedia';
import { describeCategoryStatus } from '../../utils/mediaLabels';
import './completeMediaDialog.css';

interface Props {
  item: MediaRecord;
  onClose: () => void;
  /** Retorna null no sucesso; mensagem de erro quando falhar. */
  onComplete: (patch: CompletePatch) => Promise<string | null>;
}

/** Conclusão para livros, filmes e temporadas, com data real e nota opcional. */
export function CompleteMediaDialog({ item, onClose, onComplete }: Props) {
  const [draft, setDraft] = useState<CompleteDraft>(() => completeDraft(item));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dateRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dateRef.current?.focus();
    return () => { document.body.style.overflow = oldOverflow; focused?.focus(); };
  }, []);

  const change = <K extends keyof CompleteDraft>(key: K, value: CompleteDraft[K]) => {
    setDraft(previous => ({ ...previous, [key]: value }));
    setError('');
  };

  function onKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape' && !saving) { event.preventDefault(); onClose(); return; }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
    ) ?? []).filter(el => el.getClientRects().length > 0);
    if (!focusable.length) return;
    if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable[focusable.length - 1].focus(); }
    else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) { event.preventDefault(); focusable[0].focus(); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let patch: CompletePatch;
    try { patch = completePatch(item, draft); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Revise a conclusão.'); return; }
    setSaving(true); setError('');
    try {
      const failure = await onComplete(patch);
      if (failure) setError(failure);
      else onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível concluir este título.');
    } finally { setSaving(false); }
  }

  return createPortal(
    <div className="acervo-dialog-backdrop acervo-complete-overlay" onMouseDown={event => {
      if (event.target === event.currentTarget && !saving) onClose();
    }}>
      <section ref={dialogRef} onKeyDown={onKeyDown} className="acervo-dialog acervo-complete-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descId}>
        <div className="acervo-dialog__top">
          <span className="acervo-dialog__symbol"><CalendarCheck2 size={22} aria-hidden="true" /></span>
          <button className="icon-button" type="button" onClick={onClose} disabled={saving} aria-label="Fechar conclusão"><X size={19}/></button>
        </div>
        <div className="acervo-complete-intro">
          <span className="eyebrow">FINALIZANDO UMA HISTÓRIA</span>
          <h2 id={titleId}>Concluir e avaliar<span className="heading-period">.</span></h2>
          <p id={descId}><strong>{item.title}</strong> — registre quando terminou e, se quiser, a sua nota e impressão.</p>
        </div>
        <form onSubmit={event => void submit(event)} noValidate>
          <fieldset disabled={saving} className="acervo-complete-fields">
            <label className="media-field"><span>Data real de conclusão <b>*</b></span>
              <input ref={dateRef} type="date" required min={item.startedOn || undefined}
                value={draft.completedOn} onChange={event => change('completedOn', event.target.value)} />
              <small>Usada no histórico e nas metas; não preenchemos uma data fictícia.</small>
            </label>
            <label className="media-field"><span>Minha nota (opcional)</span>
              <select value={draft.rating} onChange={event => change('rating', event.target.value)}>
                <option value="">Sem avaliação</option>
                {Array.from({ length: 11 }, (_, i) => i / 2).map(n => (
                  <option key={n} value={String(n)}>{n.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} / 5</option>
                ))}
              </select>
              <span className="media-form-rating"><RatingStars rating={draft.rating === '' ? undefined : Number(draft.rating)} /></span>
            </label>
            <label className="media-field"><span>Minha impressão (opcional)</span>
              <textarea rows={3} maxLength={5000} value={draft.notes} onChange={event => change('notes', event.target.value)}
                placeholder="O que você achou?" />
            </label>
            <label className="acervo-complete-favorite">
              <input type="checkbox" checked={draft.favorite} onChange={event => change('favorite', event.target.checked)} />
              <span>Adicionar aos favoritos</span>
            </label>
          </fieldset>
          {error && <p role="alert" className="media-alert media-alert--error">{error}</p>}
          <div className="acervo-dialog__actions">
            <button type="button" className="btn btn--outline" disabled={saving} onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              <CheckCircle2 size={16} aria-hidden="true" /> {saving ? 'Salvando...' : `Marcar como ${describeCategoryStatus(item.kind, 'completed').toLowerCase()}`}
            </button>
          </div>
        </form>
      </section>
    </div>, document.body,
  );
}
