import { Outlet, NavLink } from 'react-router-dom';

const navItems = [
  { path: '/', label: 'Dashboard' },
  { path: '/resources', label: 'Recursos' },
  { path: '/categories', label: 'Categorias' },
  { path: '/pages', label: 'Paginas' },
  { path: '/navigation', label: 'Navegacion' },
];

export function Layout() {
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
      </aside>
      <div className="cms-content">
        <Outlet />
      </div>
    </div>
  );
}
