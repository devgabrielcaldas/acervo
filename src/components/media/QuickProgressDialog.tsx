import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, CheckCircle2, Clock3, Film, Pencil, Save, Tv, X } from 'lucide-react';
import { Link } from 'react-router';
import { RatingStars } from './RatingStars';
import type { MediaRecord } from '../../types/media';
import { mediaProgress } from '../../utils/progress';
import { quickProgressDraft, quickProgressPatch } from '../../utils/quickProgress';
import type { QuickProgressDraft, QuickProgressPatch } from '../../utils/quickProgress';
import './quickProgressDialog.css';

interface Props {
  item: MediaRecord;
  onClose: () => void;
  /** Retorna null em caso de sucesso ou a mensagem de erro ao falhar. */
  onSave: (patch: QuickProgressPatch) => Promise<string | null>;
}

/** Janela de edição rápida sem tocar em avaliações, datas, status ou capas. */
export function QuickProgressDialog({ item, onClose, onSave }: Props) {
  const [values, setValues] = useState<QuickProgressDraft>(() => quickProgressDraft(item));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector<HTMLInputElement | HTMLSelectElement>('input:not([disabled]), select:not([disabled])')?.focus();
    return () => { document.body.style.overflow = oldOverflow; previous?.focus(); };
  }, []);

  const change = <K extends keyof QuickProgressDraft>(key: K, value: QuickProgressDraft[K]) => {
    setValues(current => ({ ...current, [key]: value }));
    setError('');
  };

  function keyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape' && !saving) { event.preventDefault(); onClose(); return; }
    if (event.key !== 'Tab') return;
    const elements = Array.from(ref.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]'
    ) ?? []).filter(el => el.getClientRects().length > 0);
    if (!elements.length) return;
    const first = elements[0], last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    let patch: QuickProgressPatch;
    try { patch = quickProgressPatch(item, values); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Confira os campos.'); return; }
    setSaving(true);
    try {
      const failure = await onSave(patch);
      if (failure) setError(failure);
      else onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar o progresso.');
    } finally { setSaving(false); }
  }

  const Icon = item.kind === 'book' ? BookOpen : item.kind === 'series' ? Tv : Film;
  let preview: number | undefined;
  try {
    const patch = quickProgressPatch(item, values);
    const candidate = { ...item, ...patch } as MediaRecord;
    preview = mediaProgress(candidate)?.percent;
  } catch { /* Só valida na submissão. */ }

  return createPortal(
    <div className="acervo-dialog-backdrop acervo-quick-overlay" onMouseDown={event => {
      if (event.target === event.currentTarget && !saving) onClose();
    }}>
      <section ref={ref} onKeyDown={keyDown} role="dialog" aria-modal="true"
        aria-labelledby={titleId} aria-describedby={descriptionId}
        className="acervo-dialog acervo-quick-dialog">
        <div className="acervo-dialog__top">
          <span className="acervo-dialog__symbol"><Icon size={22} aria-hidden="true"/></span>
          <button type="button" className="icon-button" disabled={saving} onClick={onClose} aria-label="Fechar atualização"><X size={19}/></button>
        </div>
        <div className="acervo-quick-intro">
          <span className="eyebrow">ATUALIZAÇÃO RÁPIDA</span>
          <h2 id={titleId}>Atualizar progresso<span className="heading-period">.</span></h2>
          <p id={descriptionId}><strong>{item.title}</strong> — informe somente onde você parou.</p>
        </div>

        <form onSubmit={event => void submit(event)} noValidate>
          <fieldset disabled={saving} className="acervo-quick-fields">
            {item.kind === 'book' && <>
              <label className="media-field"><span>Formato da leitura</span>
                <select value={values.bookFormat} onChange={e => change('bookFormat', e.target.value as QuickProgressDraft['bookFormat'])}>
                  <option value="physical">Livro físico</option><option value="ebook">E-book</option><option value="audiobook">Audiolivro</option>
                </select>
              </label>
              {values.bookFormat === 'physical' ? <div className="acervo-quick-two">
                <label className="media-field"><span>Página atual <b>*</b></span>
                  <input type="number" min="0" step="1" inputMode="numeric" value={values.currentPage}
                    onChange={e => change('currentPage', e.target.value)} placeholder="Ex.: 145"/>
                </label>
                <label className="media-field"><span>Total de páginas</span>
                  <input type="number" min="1" step="1" inputMode="numeric" value={values.totalPages}
                    onChange={e => change('totalPages', e.target.value)} placeholder="Ex.: 350"/>
                </label>
              </div> : <label className="media-field"><span>Percentual concluído <b>*</b></span>
                  <div className="acervo-quick-percent"><input type="number" min="0" max="100" step="1" inputMode="numeric"
                    value={values.percent} onChange={e => change('percent', e.target.value)} placeholder="Ex.: 60"/><span>%</span></div>
                </label>}
              <p className="acervo-quick-note">O progresso será atualizado também em “Editar registro”.</p>
            </>}

            {item.kind === 'series' && <>
              <div className="acervo-quick-two">
                <label className="media-field"><span>Episódios concluídos <b>*</b></span>
                  <input type="number" min="0" step="1" inputMode="numeric" value={values.watchedEpisodes}
                    onChange={e => change('watchedEpisodes',e.target.value)} placeholder="Ex.: 3"/>
                </label>
                <label className="media-field"><span>Episódios da temporada</span>
                  <input type="number" min="1" step="1" inputMode="numeric" value={values.totalEpisodes}
                    onChange={e => change('totalEpisodes',e.target.value)} placeholder="Ex.: 10"/>
                </label>
              </div>
              <label className="media-field"><span><Clock3 size={15} aria-hidden="true"/> Posição no episódio em andamento (opcional)</span>
                <input type="text" inputMode="numeric" autoComplete="off" placeholder="00:48:40"
                  value={values.pausedAt} onChange={e => change('pausedAt',e.target.value)}/>
                <small>Marque quantos episódios terminou. Se parou no seguinte, informe o tempo em HH:MM:SS. Deixe vazio para remover a pausa.</small>
              </label>
              <p className="acervo-quick-note">Ex.: concluiu 2 de 10 episódios e parou em 00:18:00 do episódio 3? Informe 2 e 00:18:00.</p>
            </>}

            {item.kind === 'movie' && <>
              <label className="media-field"><span><Clock3 size={15} aria-hidden="true"/> Posição em que parou (HH:MM:SS)</span>
                <input type="text" inputMode="numeric"
                  autoComplete="off" placeholder="00:48:40" value={values.pausedAt}
                  onChange={e => change('pausedAt',e.target.value)}/>
                <small>Deixe vazio para remover a posição registrada.</small>
              </label>
              <label className="media-field"><span>Duração total (minutos)</span>
                <input type="number" min="1" step="1" inputMode="numeric" placeholder="Ex.: 139"
                  value={values.durationMinutes} onChange={e => change('durationMinutes',e.target.value)}/>
                <small>A duração permite calcular o percentual assistido.</small>
              </label>
            </>}
          </fieldset>

          {(item.kind === 'book' || item.kind === 'movie') && (
            <div className="acervo-quick-finish">
              <label className="acervo-quick-finish__toggle">
                <input type="checkbox" checked={values.finish} disabled={saving}
                  onChange={e => change('finish', e.target.checked)}/>
                <span><CheckCircle2 size={18} aria-hidden="true"/>
                  <strong>{item.kind === 'book' ? 'Concluí este livro' : 'Terminei este filme'}</strong>
                  <small>Marcar como concluído e registrar minha avaliação</small>
                </span>
              </label>
              {values.finish && <div className="acervo-quick-finish__details">
                <label className="media-field"><span>Data real de conclusão <b>*</b></span>
                  <input type="date" required min={item.startedOn || undefined} max={(() => { const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()}
                    value={values.completedOn} disabled={saving}
                    onChange={e => change('completedOn', e.target.value)}/>
                  <small>Informe o dia em que terminou. Ele será usado no histórico e nas metas anuais.</small>
                </label>
                <label className="media-field"><span>Minha nota (opcional)</span>
                  <select value={values.rating} disabled={saving} onChange={e => change('rating',e.target.value)}>
                    <option value="">Sem avaliação</option>
                    {Array.from({length:11}, (_,index) => index / 2).map(n => (
                      <option key={n} value={String(n)}>{n.toLocaleString('pt-BR',{minimumFractionDigits:1})} / 5</option>
                    ))}
                  </select>
                  <span className="media-form-rating"><RatingStars rating={values.rating === '' ? undefined : Number(values.rating)} /></span>
                  <small>Pode avaliar agora ou deixar a nota para depois.</small>
                </label>
                <p className="acervo-quick-note">Ao salvar, o título sairá de “Em andamento” e aparecerá como concluído. Não será criado outro registro.</p>
              </div>}
            </div>
          )}

          {!values.finish && preview !== undefined && <div className="acervo-quick-preview" aria-live="polite">
            <div><span>Progresso após salvar</span><strong>{preview.toLocaleString('pt-BR', {maximumFractionDigits:1})}%</strong></div>
            <div className="acervo-quick-preview__bar"><span style={{width:`${preview}%`}}/></div>
          </div>}
          {error && <p className="media-alert media-alert--error" role="alert">{error}</p>}
          <div className="acervo-dialog__actions acervo-quick-actions">
            {!saving && <Link to={`/editar/${item.id}`} className="acervo-quick-full-link" onClick={onClose}><Pencil size={14} aria-hidden="true"/> Edição completa</Link>}
            <button type="button" className="btn btn--outline" disabled={saving} onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              <Save size={15} aria-hidden="true"/>{saving?'Salvando...':values.finish?'Concluir e salvar':'Salvar avanço'}
            </button>
          </div>
        </form>
      </section>
    </div>, document.body
  );
}
