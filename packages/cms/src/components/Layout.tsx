import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';

const navItems = [
  { path: '/', label: 'Dashboard' },
  { path: '/resources', label: 'Recursos' },
  { path: '/categories', label: 'Categorias' },
  { path: '/pages', label: 'Paginas' },
  { path: '/navigation', label: 'Navegacion' },
];

export function Layout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="cms-layout">
      <aside className="cms-sidebar">
        <h2>DTI Salnes CMS</h2>
        <nav>
          {navItems.map((item) => (
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
