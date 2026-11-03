import { useEffect, useState } from 'react';
import { BookOpenCheck, PauseCircle, Pencil, Plus, PlayCircle } from 'lucide-react';
import { Link } from 'react-router';
import { MediaCard } from '../components/media/MediaCard';
import { CompleteMediaDialog } from '../components/media/CompleteMediaDialog';
import { listMedia, updateMedia } from '../services/mediaRepository';
import type { DateOnly, MediaRecord } from '../types/media';

export function InProgressPage() {
  const [items, setItems] = useState<MediaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string>();
  const [completing, setCompleting] = useState<MediaRecord | null>(null);

  async function refresh() { setItems(await listMedia()); }
  useEffect(() => {
    let alive = true;
    void listMedia().then(records => { if (alive) setItems(records); })
      .catch((reason: unknown) => { if (alive) setError(reason instanceof Error ? reason.message : 'Falha ao carregar a coleção.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  async function update(item: MediaRecord, change: Record<string, unknown>) {
    setBusyId(item.id);setError('');
    try { await updateMedia(item.id, { ...item, ...change }); await refresh();return null; }
    catch (reason) { const msg=reason instanceof Error?reason.message:'Erro ao salvar.';setError(msg);return msg; }
    finally { setBusyId(undefined); }
  }
  const active = items.filter(item => item.status === 'in_progress');
  const paused = items.filter(item => item.status === 'paused');
  const section = (records: MediaRecord[], title: string) => records.length ? (
    <section className="acervo-progress-section" aria-label={title}>
      <h2>{title}<span className="acervo-progress-count">{records.length}</span></h2>
      <div className="media-grid acervo-action-grid">
        {records.map(item => <div className="acervo-progress-item" key={item.id}>
          <MediaCard item={item} busy={busyId === item.id} onFavorite={record => { void update(record,{favorite:!record.favorite}); }} />
          <div className="acervo-progress-actions">
            <Link className="btn btn--outline" to={`/editar/${item.id}`}><Pencil size={14}/> Atualizar</Link>
            <button type="button" disabled={Boolean(busyId)} className="btn btn--outline"
              onClick={() => { void update(item,{status:item.status==='paused'?'in_progress':'paused'}); }}>
              {item.status === 'paused'?<PlayCircle size={14}/>:<PauseCircle size={14}/>} {item.status === 'paused'?'Retomar':'Pausar'}
            </button>
            <button type="button" disabled={Boolean(busyId)} className="btn btn--outline" onClick={() => setCompleting(item)}><BookOpenCheck size={14}/> Concluir</button>
          </div>
        </div>)}
      </div>
    </section>
  ) : null;

  return <div className="collection-page page-enter">
    <div className="page-heading collection-heading"><div>
      <span className="eyebrow"><span className="eyebrow__line"/> UM PASSO DE CADA VEZ</span>
      <h1>Em andamento<span className="heading-period">.</span></h1>
      <p>Continue de onde parou: páginas, percentuais, episódios e tempo de reprodução.</p>
    </div><Link className="btn btn--primary" to="/novo"><Plus size={16}/> Novo título</Link></div>
    {error && <p className="media-alert media-alert--error" role="alert">{error}</p>}
    {loading ? <p className="media-loading" role="status">Carregando seus progressos...</p>
      : active.length || paused.length ? <>{section(active,'Lendo e assistindo')}{section(paused,'Pausados')}</>
      : <div className="collection-empty"><BookOpenCheck size={35} /><h2>Nenhuma história em andamento</h2>
          <p>Comece um livro, filme ou uma temporada para acompanhar seu progresso aqui.</p>
          <Link className="btn btn--primary" to="/colecao">Ir para a coleção</Link></div>}
    {completing && <CompleteMediaDialog item={completing} onClose={() => setCompleting(null)}
      onComplete={async (date:DateOnly) => update(completing,{status:'completed',completedOn:date})} />}
  </div>;
}
