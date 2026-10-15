import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router';

type SectionPageProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  nextStep: string;
};

export function SectionPage({ icon: Icon, title, description, nextStep }: SectionPageProps) {
  return (
    <div className="section-page page-enter">
      <div className="page-heading">
        <div>
          <span className="eyebrow"><span className="eyebrow__line" /> SEU ESPAÇO PESSOAL</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>

      <section className="section-page__body" aria-label={`Status de ${title}`}>
        <span className="section-page__icon"><Icon size={36} strokeWidth={1.4} /></span>
        <span className="section-kicker">ESTRUTURA PREPARADA</span>
        <h2>Este espaço está tomando forma.</h2>
        <p>{nextStep}</p>
        <p className="section-page__disclaimer">Por enquanto, esta tela é apenas a estrutura visual. Nenhum cadastro ou dado foi criado.</p>
        <Link className="btn btn--outline" to="/">
          <ArrowLeft size={16} /> Voltar à visão geral
        </Link>
        <span className="section-page__corner" aria-hidden="true"><ArrowUpRight size={18} /></span>
      </section>
    </div>
  );
}
