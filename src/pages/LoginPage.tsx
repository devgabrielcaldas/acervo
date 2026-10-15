import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, BookOpen, Eye, EyeOff, Film, LockKeyhole, ShieldCheck, Sparkles, Tv } from 'lucide-react';
import { isSupabaseConfigured, requireSupabase } from '../lib/supabase';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !password) return;
    setError(''); setBusy(true);
    try {
      const { error: authError } = await requireSupabase().auth.signInWithPassword({ email: email.trim(), password });
      if (authError) throw new Error('Não foi possível entrar. Confira seu e-mail e sua senha.');
      setPassword('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível autenticar.');
    } finally { setBusy(false); }
  }

  return (
    <main className="login-page">
      <section className="login-story" aria-label="Boas-vindas ao Acervo">
        <div className="login-story__top"><span className="login-logo"><BookOpen size={23} strokeWidth={1.65} /></span><span className="login-wordmark"><strong>acervo<span>.</span></strong><small>SUA COLEÇÃO PESSOAL</small></span></div>
        <div className="login-story__middle">
          <p className="login-overline"><Sparkles size={15} /> UMA BIBLIOTECA DE EXPERIÊNCIAS</p>
          <h1>As melhores histórias merecem <em>um lugar especial.</em></h1>
          <p>Seus livros, filmes e séries. Todas as descobertas, avaliações e metas reunidas em um espaço só seu.</p>
          <div className="login-art" aria-hidden="true">
            <div className="login-art__item login-art__item--film"><Film size={37} /><span>CINEMA</span></div>
            <div className="login-art__item login-art__item--book"><BookOpen size={43} /><span>ACERVO</span></div>
            <div className="login-art__item login-art__item--tv"><Tv size={36} /><span>SÉRIES</span></div>
          </div>
        </div>
        <p className="login-story__bottom">MENOS TEMPO ROLANDO A TELA. MAIS TEMPO VIVENDO HISTÓRIAS.</p>
      </section>
      <section className="login-form-area" aria-label="Entrar no Acervo">
        <div className="login-form-card">
          <span className="login-form-card__eyebrow">SEU ESPAÇO PESSOAL</span>
          <h2>Bem-vindo de volta.</h2>
          <p>Entre para continuar de onde suas histórias pararam.</p>
          {!isSupabaseConfigured ? (
            <div className="login-alert" role="alert">Supabase ainda não configurado. Adicione a URL e a chave pública nas variáveis de ambiente. Consulte o guia da etapa 9.</div>
          ) : (
            <form onSubmit={(event) => { void submit(event); }} className="login-form">
              <label htmlFor="login-email">E-mail</label>
              <input id="login-email" type="email" autoComplete="username" placeholder="seu@email.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
              <label htmlFor="login-password">Senha</label>
              <div className="login-password">
                <input id="login-password" type={visible ? 'text' : 'password'} autoComplete="current-password" placeholder="Sua senha" value={password} onChange={(event) => setPassword(event.target.value)} required />
                <button type="button" aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setVisible((v) => !v)}>{visible ? <EyeOff size={19} /> : <Eye size={19} />}</button>
              </div>
              {error && <p className="login-alert" role="alert">{error}</p>}
              <button className="login-submit" type="submit" disabled={busy}><span>{busy ? 'Entrando…' : 'Entrar no Acervo'}</span><ArrowRight size={19} /></button>
            </form>
          )}
          <div className="login-private"><LockKeyhole size={16} /><span>Seu acesso é protegido. Seus registros são privados.</span></div>
        </div>
        <div className="login-form-footer"><ShieldCheck size={15} /> UM UNIVERSO PARTICULAR DE HISTÓRIAS</div>
      </section>
    </main>
  );
}
