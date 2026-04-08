import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/auth-context';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ResourcesPage } from './pages/ResourcesPage';
import { ResourceFormPage } from './pages/ResourceFormPage';
import { ResourceWizardPage } from './pages/ResourceWizardPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { CategoryWizardPage } from './pages/CategoryWizardPage';
import { ProductsPage } from './pages/ProductsPage';
import { ProductWizardPage } from './pages/ProductWizardPage';
import { ZonesPage } from './pages/ZonesPage';
import { ZonesMapPage } from './pages/ZonesMapPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { PagesPage } from './pages/PagesPage';
import { PageWizardPage } from './pages/PageWizardPage';
import { NavigationPage } from './pages/NavigationPage';
import { NavigationWizardPage } from './pages/NavigationWizardPage';
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
              <Route path="/resources/new" element={<ErrorBoundary><ResourceWizardPage /></ErrorBoundary>} />
              <Route path="/resources/:id" element={<ErrorBoundary><ResourceWizardPage /></ErrorBoundary>} />
              {/* Formulario clasico disponible como fallback */}
              <Route path="/resources/:id/classic" element={<ErrorBoundary><ResourceFormPage /></ErrorBoundary>} />
              <Route path="/categories" element={<ErrorBoundary><CategoriesPage /></ErrorBoundary>} />
              <Route path="/categories/new" element={<ErrorBoundary><CategoryWizardPage /></ErrorBoundary>} />
              <Route path="/categories/:id/edit" element={<ErrorBoundary><CategoryWizardPage /></ErrorBoundary>} />
              <Route path="/products" element={<ErrorBoundary><ProductsPage /></ErrorBoundary>} />
              <Route path="/products/new" element={<ErrorBoundary><ProductWizardPage /></ErrorBoundary>} />
              <Route path="/products/:id/edit" element={<ErrorBoundary><ProductWizardPage /></ErrorBoundary>} />
              <Route path="/zones" element={<ErrorBoundary><ZonesMapPage /></ErrorBoundary>} />
              {/* Formulario clasico disponible como fallback */}
              <Route path="/zones/classic" element={<ErrorBoundary><ZonesPage /></ErrorBoundary>} />
              <Route path="/pages" element={<ErrorBoundary><PagesPage /></ErrorBoundary>} />
              <Route path="/pages/new" element={<ErrorBoundary><PageWizardPage /></ErrorBoundary>} />
              <Route path="/pages/:id/edit" element={<ErrorBoundary><PageWizardPage /></ErrorBoundary>} />
              <Route path="/navigation" element={<ErrorBoundary><NavigationPage /></ErrorBoundary>} />
              <Route path="/navigation/new" element={<ErrorBoundary><NavigationWizardPage /></ErrorBoundary>} />
              <Route path="/navigation/:id/edit" element={<ErrorBoundary><NavigationWizardPage /></ErrorBoundary>} />
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
