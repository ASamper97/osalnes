import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/auth-context';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ResourcesPage } from './pages/ResourcesPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { PagesPage } from './pages/PagesPage';
import { NavigationPage } from './pages/NavigationPage';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected — requires authentication */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/resources" element={<ResourcesPage />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/pages" element={<PagesPage />} />
              <Route path="/navigation" element={<NavigationPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
