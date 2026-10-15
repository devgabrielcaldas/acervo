import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props { children: ReactNode }
interface State { hasError: boolean }

/** Uma falha de renderização não deve oferecer apagar ou reiniciar o IndexedDB. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State { return { hasError: true }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Acervo: erro de interface.', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="acervo-fatal" role="alert">
        <div className="acervo-fatal__icon"><AlertTriangle size={27} aria-hidden="true" /></div>
        <span className="eyebrow">NÃO FOI POSSÍVEL EXIBIR ESTA TELA</span>
        <h1>Não conseguimos carregar o Acervo.</h1>
        <p>Ocorreu um problema inesperado na interface. Tente recarregar a página. Recarregar não apaga os registros armazenados no navegador.</p>
        <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
          <RefreshCw size={17} aria-hidden="true" /> Recarregar página
        </button>
        <p className="acervo-fatal__hint">Se o problema continuar, abra o console do navegador (F12) e copie a mensagem de erro. Não limpe os dados do site.</p>
      </main>
    );
  }
}
