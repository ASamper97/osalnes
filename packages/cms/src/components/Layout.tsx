import { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { useDarkMode } from '../lib/dark-mode';
import { CmsAssistant } from './CmsAssistant';
import { OnboardingTour, shouldShowTour, resetTour } from './OnboardingTour';
import { GlobalSearch } from './GlobalSearch';
import { NotificationsBell } from './NotificationsBell';

type Role = 'admin' | 'editor' | 'validador' | 'tecnico' | 'analitica';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  roles: Role[];
}

const allRoles: Role[] = ['admin', 'editor', 'validador', 'tecnico', 'analitica'];

const navItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: '\u{1F4CA}', roles: allRoles },
  { path: '/resources', label: 'Recursos', icon: '\u{1F3D6}\uFE0F', roles: ['admin', 'editor', 'validador', 'tecnico'] },
  { path: '/categories', label: 'Categorias', icon: '\u{1F4C1}', roles: ['admin'] },
  { path: '/products', label: 'Productos', icon: '\u{1F3AF}', roles: ['admin', 'editor'] },
  { path: '/zones', label: 'Zonas', icon: '\u{1F4CD}', roles: ['admin', 'editor', 'tecnico'] },
  { path: '/pages', label: 'Paginas', icon: '\u{1F4C4}', roles: ['admin', 'editor'] },
  { path: '/navigation', label: 'Navegacion', icon: '\u2630\uFE0F', roles: ['admin'] },
  { path: '/exports', label: 'Exportaciones', icon: '\u{1F4E4}', roles: ['admin', 'tecnico'] },
  { path: '/audit', label: 'Actividad', icon: '\u{1F4CB}', roles: ['admin', 'tecnico'] },
  { path: '/users', label: 'Usuarios', icon: '\u{1F465}', roles: ['admin'] },
];

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrador',
  editor: 'Editor',
  validador: 'Validador',
  tecnico: 'Tecnico',
  analitica: 'Analitica',
};

export function Layout() {
  const { user, role, signOut } = useAuth();
  const { theme, toggle: toggleTheme } = useDarkMode();
  const navigate = useNavigate();
  const [tourOpen, setTourOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Cmd+K / Ctrl+K opens global search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Auto-show tour the first time the user lands on the CMS
  useEffect(() => {
    if (user && shouldShowTour()) {
      // Small delay so the layout has time to render before opening
      const t = setTimeout(() => setTourOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, [user]);

  async function handleLogout() {
    await signOut();
    navigate('/login');
  }

  function handleReplayTour() {
    resetTour();
    setTourOpen(true);
  }

  const visibleItems = navItems.filter((item) => role && item.roles.includes(role));

  return (
    <div className="cms-layout">
      <a href="#main-content" className="skip-to-main">Saltar al contenido principal</a>
      <aside className="cms-sidebar" data-tour="sidebar">
        <div className="cms-sidebar-brand">
          <img src="/logo-osalnes.png" alt="O Salnes" className="cms-sidebar-logo-img" />
          <div className="cms-sidebar-subtitle">DTI CMS</div>
        </div>
        <button
          type="button"
          className="cms-search-trigger"
          onClick={() => setSearchOpen(true)}
          aria-label="Abrir busqueda global"
        >
          <span className="cms-search-trigger__icon">🔍</span>
          <span className="cms-search-trigger__label">Buscar...</span>
          <kbd className="cms-search-trigger__kbd">Ctrl K</kbd>
        </button>
        <nav>
          {visibleItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => `cms-nav-link ${isActive ? 'active' : ''}`}
              data-tour={item.path === '/resources' ? 'nav-resources' : undefined}
            >
              <span className="cms-nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="cms-sidebar-footer">
          <div className="cms-sidebar-tools">
            <button type="button" className="cms-tour-btn" onClick={handleReplayTour} title="Ver tour de bienvenida">
              ✨ Ver tour
            </button>
            <NotificationsBell />
            <button
              type="button"
              className="cms-theme-btn"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
          <div className="cms-user-info">
            <div className="cms-user-avatar">{user?.email?.charAt(0).toUpperCase()}</div>
            <div>
              <div className="cms-user-email">{user?.email}</div>
              {role && <div className="cms-user-role">{ROLE_LABELS[role]}</div>}
            </div>
          </div>
          <button onClick={handleLogout} className="cms-logout-btn">
            Cerrar sesion
          </button>
        </div>
      </aside>
      <main id="main-content" className="cms-content" tabIndex={-1}>
        <Outlet />
      </main>
      <CmsAssistant />
      <OnboardingTour open={tourOpen} onClose={() => setTourOpen(false)} />
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
