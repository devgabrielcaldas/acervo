import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { CalendarCheck2, X } from 'lucide-react';
import type { DateOnly, MediaRecord } from '../../types/media';
import { describeCategoryStatus } from '../../utils/mediaLabels';

interface Props {
  item: MediaRecord;
  onClose: () => void;
  onComplete: (date: DateOnly) => Promise<string | null>;
}

/** Pergunta a data real. Nunca preenche automaticamente com a data atual. */
export function CompleteMediaDialog({ item, onClose, onComplete }: Props) {
  const [date, setDate] = useState<string>(item.completedOn ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const dateRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dateRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, []);

  const onDialogKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && !saving) { event.preventDefault(); onClose(); }
    if (event.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('input:not([disabled]), button:not([disabled])');
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!date) { setError('Selecione a data em que você realmente concluiu o título.'); return; }
    setSaving(true);
    try {
      const failure = await onComplete(date as DateOnly);
      if (failure) setError(failure);
      else onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="acervo-dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose();
    }}>
      <section ref={dialogRef} onKeyDown={onDialogKeyDown} className="acervo-dialog" role="dialog" aria-modal="true" aria-labelledby="complete-title" aria-describedby="complete-description">
        <div className="acervo-dialog__top">
          <span className="acervo-dialog__symbol"><CalendarCheck2 size={22} /></span>
          <button className="icon-button" type="button" onClick={onClose} disabled={saving} aria-label="Fechar"><X size={19} /></button>
        </div>
        <h2 id="complete-title">Registrar conclusão</h2>
        <p id="complete-description">Quando você terminou <strong>{item.title}</strong>? Esse dia será usado no histórico e nas estatísticas.</p>
        <form onSubmit={(event) => void submit(event)}>
          <label className="media-field">
            <span>Data real de conclusão <b>*</b></span>
            <input ref={dateRef} type="date" required value={date} onChange={(event) => { setDate(event.target.value); setError(''); }} />
            <small>Não vamos usar automaticamente a data de hoje.</small>
          </label>
          {error && <p role="alert" className="media-alert media-alert--error">{error}</p>}
          <div className="acervo-dialog__actions">
            <button type="button" className="btn btn--outline" disabled={saving} onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Salvando...' : `Marcar como ${describeCategoryStatus(item.kind, 'completed').toLowerCase()}`}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
