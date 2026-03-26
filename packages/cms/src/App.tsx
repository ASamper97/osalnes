import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/auth-context';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ResourcesPage } from './pages/ResourcesPage';
import { ResourceFormPage } from './pages/ResourceFormPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { ProductsPage } from './pages/ProductsPage';
import { ZonesPage } from './pages/ZonesPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { PagesPage } from './pages/PagesPage';
import { NavigationPage } from './pages/NavigationPage';
import { UsersPage } from './pages/UsersPage';
import { ExportsPage } from './pages/ExportsPage';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected — requires authentication + DTI profile */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
              <Route path="/resources" element={<ErrorBoundary><ResourcesPage /></ErrorBoundary>} />
              <Route path="/resources/new" element={<ErrorBoundary><ResourceFormPage /></ErrorBoundary>} />
              <Route path="/resources/:id" element={<ErrorBoundary><ResourceFormPage /></ErrorBoundary>} />
              <Route path="/categories" element={<ErrorBoundary><CategoriesPage /></ErrorBoundary>} />
              <Route path="/products" element={<ErrorBoundary><ProductsPage /></ErrorBoundary>} />
              <Route path="/zones" element={<ErrorBoundary><ZonesPage /></ErrorBoundary>} />
              <Route path="/pages" element={<ErrorBoundary><PagesPage /></ErrorBoundary>} />
              <Route path="/navigation" element={<ErrorBoundary><NavigationPage /></ErrorBoundary>} />
              <Route path="/exports" element={<ErrorBoundary><ExportsPage /></ErrorBoundary>} />
              <Route path="/users" element={<ErrorBoundary><UsersPage /></ErrorBoundary>} />
              <Route path="/audit" element={<ErrorBoundary><AuditLogPage /></ErrorBoundary>} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
