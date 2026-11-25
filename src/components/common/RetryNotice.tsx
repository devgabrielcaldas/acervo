import { RefreshCcw } from 'lucide-react';
import '../../styles/quality.css';

interface Props {
  message: string;
  onRetry: () => void;
  label?: string;
}

export function RetryNotice({ message, onRetry, label = 'Tentar novamente' }: Props) {
  return <div className="acervo-retry-notice" role="alert">
    <span>{message}</span>
    <button type="button" onClick={onRetry} className="btn btn--outline">
      <RefreshCcw size={15} aria-hidden="true" /> {label}
    </button>
  </div>;
}
