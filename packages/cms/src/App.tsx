import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { ResourcesPage } from './pages/ResourcesPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { PagesPage } from './pages/PagesPage';
import { NavigationPage } from './pages/NavigationPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/pages" element={<PagesPage />} />
          <Route path="/navigation" element={<NavigationPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
