import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  Bookmark, BookOpen, ChevronRight, Heart, History, LayoutDashboard,
  LibraryBig, Menu, Moon, Plus, Settings2, Sparkles, Sun, Target, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';

type Theme = 'dark' | 'light';
type NavigationItem = { to: string; label: string; shortLabel: string; icon: LucideIcon };

const navigation: NavigationItem[] = [
  { to: '/', label: 'Visão geral', shortLabel: 'Início', icon: LayoutDashboard },
  { to: '/colecao', label: 'Minha coleção', shortLabel: 'Coleção', icon: LibraryBig },
  { to: '/desejos', label: 'Lista de desejos', shortLabel: 'Desejos', icon: Bookmark },
  { to: '/historico', label: 'Histórico', shortLabel: 'Histórico', icon: History },
  { to: '/favoritos', label: 'Favoritos', shortLabel: 'Favoritos', icon: Heart },
  { to: '/metas', label: 'Metas e estatísticas', shortLabel: 'Metas', icon: Target },
  { to: '/configuracoes', label: 'Configurações', shortLabel: 'Ajustes', icon: Settings2 },
];

function readSavedTheme(): Theme {
  try {
    return window.localStorage.getItem('acervo:theme') === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function AppLayout() {
  const [theme, setTheme] = useState<Theme>(readSavedTheme);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const location = useLocation();

  const currentPage =
    location.pathname === '/novo' ? 'Adicionar título' :
    location.pathname.startsWith('/editar/') ? 'Editar título' :
    location.pathname.startsWith('/colecao/') ? 'Detalhes do título' :
    navigation.find((item) => item.to === location.pathname)?.label ?? 'Visão geral';

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#0d0f11' : '#f5f3ee');
    try { window.localStorage.setItem('acervo:theme', theme); } catch { /* Sem armazenamento, mantém o tema da sessão. */ }
  }, [theme]);

  useEffect(() => {
    document.title = `${currentPage} — Acervo`;
  }, [currentPage]);

  useEffect(() => {
    if (!menuOpen) return;
    // Trava o scroll do fundo, sem tocar nos dados da aplicação.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sidebarRef.current?.querySelector<HTMLElement>('.sidebar__close')?.focus();
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', closeWithEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeWithEscape);
    };
  }, [menuOpen]);

  useEffect(() => {
    // Se a janela voltar ao desktop, o menu deixa de ser modal e libera o scroll.
    const media = window.matchMedia('(max-width: 900px)');
    const onResize = () => { if (!media.matches) setMenuOpen(false); };
    media.addEventListener('change', onResize);
    return () => media.removeEventListener('change', onResize);
  }, []);

  function closeMenu(restoreFocus = false) {
    setMenuOpen(false);
    if (restoreFocus) menuButtonRef.current?.focus();
  }

  function keepFocusInSidebar(event: ReactKeyboardEvent<HTMLElement>) {
    if (!menuOpen || event.key !== 'Tab') return;
    const elements = sidebarRef.current?.querySelectorAll<HTMLElement>(
      'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"])',
    );
    if (!elements?.length) return;
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="shell">
      <a className="skip-link" href="#conteudo-principal">Pular para o conteúdo</a>

      {menuOpen && (
        <button type="button" className="sidebar-overlay" aria-label="Fechar menu" tabIndex={-1}
          onClick={() => closeMenu(true)} />
      )}

      <aside ref={sidebarRef} id="acervo-sidebar" className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`}
        aria-label="Menu do Acervo" onKeyDown={keepFocusInSidebar}>
        <div className="brand">
          <span className="brand__mark" aria-hidden="true"><BookOpen size={24} strokeWidth={1.75} /></span>
          <span className="brand__text">
            <strong>acervo<span className="brand__dot">.</span></strong>
            <small>SUA COLEÇÃO PESSOAL</small>
          </span>
          <button className="icon-button sidebar__close" type="button" onClick={() => closeMenu(true)}
            aria-label="Fechar menu lateral"><X size={20} /></button>
        </div>
        <div className="sidebar__body">
          <span className="sidebar__heading">EXPLORAR</span>
          <nav aria-label="Navegação principal" className="sidebar__links">
            {navigation.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} end={to === '/'} onClick={() => closeMenu()}
                className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}>
                <Icon size={19} strokeWidth={1.85} aria-hidden="true" /><span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="sidebar__footer">
          <div className="sidebar__message">
            <Sparkles size={18} strokeWidth={1.6} aria-hidden="true" />
            <p>Menos tempo rolando a tela. Mais tempo vivendo histórias.</p>
          </div>
          <span>ACERVO · SUA COLEÇÃO PESSOAL</span>
        </div>
      </aside>

      <div className="shell__right">
        <header className="topbar">
          <div className="topbar__left">
            <button ref={menuButtonRef} className="icon-button topbar__menu" type="button"
              aria-label="Abrir menu" aria-controls="acervo-sidebar" aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}><Menu size={22} /></button>
            <div className="breadcrumb" aria-label="Localização atual">
              <span>Meu espaço</span><ChevronRight size={15} aria-hidden="true" />
              <strong>{currentPage}</strong>
            </div>
          </div>
          <div className="topbar__right">
            <span className="topbar__tag">UM LUGAR PARA SUAS HISTÓRIAS</span>
            <Link className="icon-button" to="/novo" title="Adicionar título" aria-label="Adicionar título">
              <Plus size={20} />
            </Link>
            <button className="icon-button theme-button" type="button"
              onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
              aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
              title={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}>
              {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
            </button>
          </div>
        </header>
        <main id="conteudo-principal" className="main-content" tabIndex={-1}><Outlet /></main>
        <nav className="bottom-nav" aria-label="Navegação rápida">
          {navigation.slice(0, 5).map(({ to, shortLabel, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) => `bottom-nav__link ${isActive ? 'bottom-nav__link--active' : ''}`}>
              <Icon size={19} strokeWidth={1.9} aria-hidden="true" /><span>{shortLabel}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
