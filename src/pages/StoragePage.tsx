import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  ArrowDownToLine, ArrowRight, CheckCircle2, Database, FileCheck2, FileJson,
  HardDrive, RefreshCw, RotateCcw, ShieldAlert, ShieldCheck, TriangleAlert, Upload,
} from 'lucide-react';
import { createBackupFile, prepareBackup, restoreBackup } from '../services/backupService';
import type { PreparedBackup } from '../services/backupService';
import { getStorageSummary, runStorageSelfTest } from '../services/storageDiagnostics';
import type { StorageSummary } from '../types/media';

type Result = { kind: 'success' | 'error'; message: string } | null;

const labels: { key: keyof StorageSummary; label: string }[] = [
  { key: 'books', label: 'Livros' },
  { key: 'movies', label: 'Filmes' },
  { key: 'series', label: 'Séries' },
  { key: 'covers', label: 'Capas' },
  { key: 'goals', label: 'Metas anuais' },
];

function messageFromError(error: unknown): string {
  if (error instanceof Error && error.name === 'QuotaExceededError') {
    return 'Não há espaço suficiente no navegador. Os dados anteriores foram preservados. Libere espaço e tente novamente.';
  }
  return error instanceof Error ? error.message : 'Não foi possível realizar a operação.';
}

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SummaryCards({ summary }: { summary: StorageSummary }) {
  return (
    <div className="storage-counts" aria-label="Quantidade de registros">
      {labels.map(({ key, label }) => (
        <div className="storage-count" key={key}>
          <strong>{summary[key]}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

export function StoragePage() {
  const [summary, setSummary] = useState<StorageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [reading, setReading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [backupResult, setBackupResult] = useState<Result>(null);
  const [prepared, setPrepared] = useState<PreparedBackup | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [needsReload, setNeedsReload] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const selectionVersion = useRef(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setSummary(await getStorageSummary());
    } catch (error) {
      setResult({ kind: 'error', message: messageFromError(error) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void getStorageSummary()
      .then((data) => { if (active) setSummary(data); })
      .catch((error: unknown) => {
        if (active) setResult({ kind: 'error', message: messageFromError(error) });
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const testDatabase = async () => {
    setTesting(true);
    setResult(null);
    try {
      await runStorageSelfTest();
      setResult({ kind: 'success', message: 'Teste concluído! O registro temporário e a capa de teste foram removidos.' });
    } catch (error) {
      setResult({ kind: 'error', message: `O teste falhou: ${messageFromError(error)}` });
    } finally {
      await refresh();
      setTesting(false);
    }
  };

  const downloadBackup = async () => {
    setExporting(true);
    setBackupResult(null);
    try {
      const { blob, fileName } = await createBackupFile();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      // Atraso curto evita cancelar o download em alguns navegadores.
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setBackupResult({ kind: 'success', message: `Arquivo ${fileName} preparado para download. Guarde-o em um local seguro.` });
    } catch (error) {
      setBackupResult({ kind: 'error', message: messageFromError(error) });
    } finally {
      setExporting(false);
    }
  };

  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const version = ++selectionVersion.current;
    setBackupResult(null);
    setPrepared(null);
    setConfirmation('');
    const file = event.target.files?.[0];
    // Permite selecionar novamente o mesmo arquivo após um erro de validação.
    event.target.value = '';
    if (!file) return;
    setReading(true);
    try {
      const candidate = await prepareBackup(file);
      if (selectionVersion.current === version) setPrepared(candidate);
    } catch (error) {
      if (selectionVersion.current === version) {
        setBackupResult({ kind: 'error', message: `${messageFromError(error)} Seus dados atuais não foram modificados.` });
      }
    } finally {
      if (selectionVersion.current === version) setReading(false);
    }
  };

  const cancelImport = () => {
    selectionVersion.current += 1;
    setPrepared(null);
    setConfirmation('');
    setReading(false);
    setBackupResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const restore = async () => {
    if (!prepared || confirmation.trim() !== 'RESTAURAR') return;
    setRestoring(true);
    setBackupResult(null);
    try {
      await restoreBackup(prepared);
      selectionVersion.current += 1;
      setPrepared(null);
      setConfirmation('');
      if (fileRef.current) fileRef.current.value = '';
      setNeedsReload(true);
      setBackupResult({ kind: 'success', message: 'Backup restaurado com sucesso, incluindo capas e metas. Recarregue o Acervo para atualizar todas as páginas e aplicar o tema salvo.' });
      await refresh();
    } catch (error) {
      setBackupResult({ kind: 'error', message: `Não foi possível restaurar: ${messageFromError(error)}. A transação foi cancelada.` });
    } finally {
      setRestoring(false);
    }
  };

  const busy = loading || testing || exporting || reading || restoring || needsReload;

  return (
    <div className="storage-page page-enter">
      <div className="page-heading">
        <div>
          <span className="eyebrow"><span className="eyebrow__line" /> SEU ESPAÇO PESSOAL</span>
          <h1>Configurações</h1>
          <p>Gerencie seus backups e acompanhe o armazenamento deste navegador.</p>
        </div>
      </div>

      <section className="storage-panel" aria-labelledby="storage-heading">
        <div className="storage-panel__heading">
          <span className="storage-panel__icon"><Database size={24} strokeWidth={1.6} /></span>
          <div>
            <span className="section-kicker">SEUS DADOS</span>
            <h2 id="storage-heading">Armazenamento local</h2>
            <p>IndexedDB · acervo-local · versão 1</p>
          </div>
          <button className="btn btn--outline storage-panel__refresh" type="button" onClick={() => void refresh()} disabled={busy}>
            <RefreshCw size={16} /> Atualizar
          </button>
        </div>

        {summary ? <SummaryCards summary={summary} /> : (
          <p className="storage-panel__empty">{loading ? 'Conectando ao banco local...' : 'Não foi possível carregar a contagem.'}</p>
        )}
        <div className="storage-panel__test">
          <div>
            <h3>Verificação de leitura e escrita</h3>
            <p>Cria, altera, consulta e exclui um registro temporário com capa. Seus títulos existentes não são alterados.</p>
          </div>
          <button className="btn btn--primary" type="button" disabled={busy || !summary} onClick={() => void testDatabase()}>
            <ShieldCheck size={17} /> {testing ? 'Verificando...' : 'Testar banco local'}
          </button>
        </div>
        {result && (
          <div className={`storage-result storage-result--${result.kind}`} role="status" aria-live="polite">
            {result.kind === 'success' ? <CheckCircle2 size={19} /> : <TriangleAlert size={19} />}
            <span>{result.message}</span>
          </div>
        )}
      </section>

      <section className="storage-panel acervo-backup" aria-labelledby="backup-heading">
        <div className="storage-panel__heading">
          <span className="storage-panel__icon"><FileJson size={24} strokeWidth={1.6} /></span>
          <div>
            <span className="section-kicker">CÓPIA DE SEGURANÇA</span>
            <h2 id="backup-heading">Backup completo</h2>
            <p>Registros, capas, notas, datas, metas e preferência de tema.</p>
          </div>
        </div>

        <div className="acervo-backup__actions">
          <div className="acervo-backup__action">
            <span className="acervo-backup__symbol"><ArrowDownToLine size={20} /></span>
            <h3>Exportar seus dados</h3>
            <p>Baixe um arquivo JSON que contém sua coleção completa, incluindo as imagens. Guarde-o fora do navegador.</p>
            <button className="btn btn--primary" type="button" disabled={busy || !summary} onClick={() => void downloadBackup()}>
              <ArrowDownToLine size={17} /> {exporting ? 'Preparando backup...' : 'Exportar backup JSON'}
            </button>
          </div>
          <div className="acervo-backup__action">
            <span className="acervo-backup__symbol"><Upload size={20} /></span>
            <h3>Restaurar um backup</h3>
            <p>Escolha um backup do Acervo. O arquivo será analisado integralmente antes de pedir confirmação.</p>
            <label className="acervo-backup__picker" htmlFor="acervo-backup-file">
              <FileJson size={17} /> {reading ? 'Lendo e validando...' : 'Selecionar arquivo JSON'}
            </label>
            <input
              ref={fileRef} id="acervo-backup-file" type="file" accept=".json,application/json"
              className="acervo-backup__file" disabled={busy} onChange={(event) => { void chooseFile(event); }}
            />
          </div>
        </div>

        {prepared && !needsReload && (
          <div className="acervo-backup__preview" aria-labelledby="acervo-backup-preview-heading">
            <div className="acervo-backup__preview-title">
              <FileCheck2 size={21} aria-hidden="true" />
              <div>
                <h3 id="acervo-backup-preview-heading">Backup validado — pronto para restaurar</h3>
                <p>{prepared.preview.fileName} · {formatBytes(prepared.preview.sizeBytes)} · {new Date(prepared.preview.exportedAt).toLocaleString('pt-BR')}</p>
              </div>
            </div>
            <SummaryCards summary={prepared.preview} />
            <div className="acervo-backup__comparison">
              <div><span>Atualmente neste navegador</span><strong>{summary ? summary.books + summary.movies + summary.series : '—'} títulos</strong></div>
              <ArrowRight size={18} aria-hidden="true" />
              <div><span>Após a restauração</span><strong>{prepared.records.length} títulos</strong></div>
            </div>
            <div className="acervo-backup__warning" role="note">
              <ShieldAlert size={20} aria-hidden="true" />
              <p><strong>Atenção:</strong> esta operação substitui todos os livros, filmes, séries, capas e metas deste navegador pelos dados do arquivo. Não combina registros nem permite desfazer. Exporte o estado atual antes de continuar.</p>
            </div>
            <label className="acervo-backup__confirm-label" htmlFor="acervo-backup-confirm">
              Para confirmar a substituição, digite <strong>RESTAURAR</strong>:
            </label>
            <input
              id="acervo-backup-confirm" className="acervo-backup__confirm" type="text"
              autoComplete="off" spellCheck={false} disabled={restoring}
              value={confirmation} onChange={(event) => setConfirmation(event.target.value)}
              placeholder="RESTAURAR"
            />
            <div className="acervo-backup__confirm-actions">
              <button type="button" className="btn btn--outline" disabled={restoring} onClick={cancelImport}>Cancelar</button>
              <button type="button" className="btn btn--primary" disabled={busy || confirmation.trim() !== 'RESTAURAR'} onClick={() => void restore()}>
                <RotateCcw size={17} /> {restoring ? 'Restaurando...' : 'Substituir dados e restaurar'}
              </button>
            </div>
          </div>
        )}

        {backupResult && (
          <div className={`storage-result storage-result--${backupResult.kind} acervo-backup__result`} role={backupResult.kind === 'error' ? 'alert' : 'status'} aria-live="polite">
            {backupResult.kind === 'success' ? <CheckCircle2 size={19} /> : <TriangleAlert size={19} />}
            <span>{backupResult.message}</span>
          </div>
        )}
        {needsReload && (
          <div className="acervo-backup__reload">
            <button className="btn btn--primary" type="button" onClick={() => window.location.reload()}>
              <RefreshCw size={17} /> Recarregar Acervo
            </button>
          </div>
        )}
      </section>

      <div className="storage-footnote">
        <HardDrive size={20} />
        <p><strong>Privacidade e armazenamento:</strong> seus dados continuam neste navegador, sem sincronização automática entre dispositivos. A exportação cria uma cópia portátil, mas não faz backup automático. Exporte novamente após alterações importantes e armazene o JSON em um local seguro.</p>
      </div>
    </div>
  );
}
