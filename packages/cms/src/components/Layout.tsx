import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';

type Role = 'admin' | 'editor' | 'validador' | 'tecnico' | 'analitica';

interface NavItem {
  path: string;
  label: string;
  roles: Role[]; // roles that can see this item
}

const allRoles: Role[] = ['admin', 'editor', 'validador', 'tecnico', 'analitica'];

const navItems: NavItem[] = [
  { path: '/', label: 'Dashboard', roles: allRoles },
  { path: '/resources', label: 'Recursos', roles: ['admin', 'editor', 'validador', 'tecnico'] },
  { path: '/categories', label: 'Categorias', roles: ['admin'] },
  { path: '/products', label: 'Productos', roles: ['admin', 'editor'] },
  { path: '/pages', label: 'Paginas', roles: ['admin', 'editor'] },
  { path: '/navigation', label: 'Navegacion', roles: ['admin'] },
  { path: '/exports', label: 'Exportaciones', roles: ['admin', 'tecnico'] },
  { path: '/users', label: 'Usuarios', roles: ['admin'] },
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
        <h2>DTI Salnes CMS</h2>
        <nav>
          {visibleItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="cms-sidebar-footer">
          <div className="cms-user-email">{user?.email}</div>
          {role && (
            <div className="cms-user-role">{ROLE_LABELS[role]}</div>
          )}
          <button onClick={handleLogout} className="cms-logout-btn">
            Cerrar sesion
          </button>
        </div>
      </aside>
      <div className="cms-content">
        <Outlet />
      </div>
    </div>
  );
}
