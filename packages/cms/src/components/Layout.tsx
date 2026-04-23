import { useEffect, useMemo, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { useDarkMode } from '../lib/dark-mode';
import { CmsAssistant } from './CmsAssistant';
import { OnboardingTour, shouldShowTour, resetTour } from './OnboardingTour';
import { GlobalSearch } from './GlobalSearch';
import { NotificationsBell } from './NotificationsBell';
import { parseUserRole, type UserRole as SharedUserRole } from '@osalnes/shared/data/rbac';

type Role = 'admin' | 'editor' | 'validador' | 'tecnico' | 'analitica';

/**
 * Un ítem del nav acepta DOS sistemas de roles en OR:
 *   · `roles` (legacy) — viene de `profile.role` (tabla usuario),
 *     5 valores: admin | editor | validador | tecnico | analitica.
 *   · `sharedRoles` (SCR-02+) — viene de `user_metadata.role` parseado
 *     por `parseUserRole` del shared/rbac, 5 valores del pliego:
 *     admin | platform | operator | agency | tourism_manager.
 * Si cualquiera de los dos sistemas autoriza al usuario, el item se
 * muestra. Así sobrevivimos al desdoble de RBAC hasta que SCR-14
 * unifique ambos.
 */
interface NavItem {
  path: string;
  label: string;
  icon: string;
  roles: Role[];
  sharedRoles?: SharedUserRole[];
}

const allRoles: Role[] = ['admin', 'editor', 'validador', 'tecnico', 'analitica'];

const navItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: '\u{1F4CA}', roles: allRoles },
  { path: '/resources', label: 'Recursos', icon: '\u{1F3D6}\uFE0F', roles: ['admin', 'editor', 'validador', 'tecnico'] },
  { path: '/categories', label: 'Categorias', icon: '\u{1F4C1}', roles: ['admin'] },
  { path: '/products', label: 'Productos', icon: '\u{1F3AF}', roles: ['admin', 'editor'] },
  { path: '/zones', label: 'Zonas', icon: '\u{1F4CD}', roles: ['admin', 'editor', 'tecnico'] },
  // SCR-10 v2 · Taxonomías. Visible para admin/platform/tourist_manager
  // (editable) y operator (solo lectura). RBAC granular lo aplica
  // TaxonomiesPage por catálogo: p.ej. tourist_manager NO edita tipologías.
  // Legacy: admin + editor + tecnico (técnicos sin user_metadata aún).
  { path: '/taxonomies', label: 'Taxonomías', icon: '\u{1F3F7}️',
    roles: ['admin', 'editor', 'tecnico'],
    sharedRoles: ['admin', 'platform', 'tourism_manager', 'operator'] },
  { path: '/pages', label: 'Paginas', icon: '\u{1F4C4}', roles: ['admin', 'editor'] },
  { path: '/navigation', label: 'Navegacion', icon: '\u2630\uFE0F', roles: ['admin'] },
  // SCR-13 · A5 — Exportaciones visible para admin/tecnico (legacy) y
  // para admin/platform (shared RBAC del pliego). El prompt A5 pide
  // admin+platform; `tecnico` se mantiene porque es el mapeo legacy
  // del "gestor de plataforma" del pliego y retirarlo sin migración
  // de user_metadata rompería acceso a técnicos existentes.
  { path: '/exports', label: 'Exportaciones', icon: '\u{1F4E4}', roles: ['admin', 'tecnico'], sharedRoles: ['admin', 'platform'] },
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

  // Dos sistemas de RBAC conviven (ver comentario en NavItem). Un item
  // es visible si el rol legacy O el rol shared autorizan al usuario.
  const sharedRole = useMemo(() => parseUserRole(user?.user_metadata), [user]);
  const visibleItems = navItems.filter((item) => {
    const legacyOk = !!role && item.roles.includes(role);
    const sharedOk = !!item.sharedRoles && item.sharedRoles.includes(sharedRole);
    return legacyOk || sharedOk;
  });

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
