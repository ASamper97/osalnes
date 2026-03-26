import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { CmsAssistant } from './CmsAssistant';

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
  const navigate = useNavigate();

  async function handleLogout() {
    await signOut();
    navigate('/login');
  }

  const visibleItems = navItems.filter((item) => role && item.roles.includes(role));

  return (
    <div className="cms-layout">
      <aside className="cms-sidebar">
        <div className="cms-sidebar-brand">
          <img src="/logo-osalnes.png" alt="O Salnes" className="cms-sidebar-logo-img" />
          <div className="cms-sidebar-subtitle">DTI CMS</div>
        </div>
        <nav>
          {visibleItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => `cms-nav-link ${isActive ? 'active' : ''}`}
            >
              <span className="cms-nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="cms-sidebar-footer">
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
      <div className="cms-content">
        <Outlet />
      </div>
      <CmsAssistant />
    </div>
  );
}
