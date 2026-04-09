import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/auth-context';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { ConfirmProvider } from './components/ConfirmDialog';
import { NotificationsProvider } from './lib/notifications';

// All page routes are code-split with React.lazy() so the initial bundle
// only contains the auth/layout shell. Heavy dependencies like Tiptap,
// Leaflet and qrcode only download when the user navigates to a page
// that actually uses them.
//
// Pages export named components, so we adapt them to default exports
// inline. The verbosity is intentional — keeping the route table flat
// makes it obvious which routes are split.
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const SetupPasswordPage = lazy(() => import('./pages/SetupPasswordPage').then(m => ({ default: m.SetupPasswordPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const ResourcesPage = lazy(() => import('./pages/ResourcesPage').then(m => ({ default: m.ResourcesPage })));
const ResourceFormPage = lazy(() => import('./pages/ResourceFormPage').then(m => ({ default: m.ResourceFormPage })));
const ResourceWizardPage = lazy(() => import('./pages/ResourceWizardPage').then(m => ({ default: m.ResourceWizardPage })));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage').then(m => ({ default: m.CategoriesPage })));
const CategoryWizardPage = lazy(() => import('./pages/CategoryWizardPage').then(m => ({ default: m.CategoryWizardPage })));
const ProductsPage = lazy(() => import('./pages/ProductsPage').then(m => ({ default: m.ProductsPage })));
const ProductWizardPage = lazy(() => import('./pages/ProductWizardPage').then(m => ({ default: m.ProductWizardPage })));
const ZonesPage = lazy(() => import('./pages/ZonesPage').then(m => ({ default: m.ZonesPage })));
const ZonesMapPage = lazy(() => import('./pages/ZonesMapPage').then(m => ({ default: m.ZonesMapPage })));
const AuditLogPage = lazy(() => import('./pages/AuditLogPage').then(m => ({ default: m.AuditLogPage })));
const PagesPage = lazy(() => import('./pages/PagesPage').then(m => ({ default: m.PagesPage })));
const PageWizardPage = lazy(() => import('./pages/PageWizardPage').then(m => ({ default: m.PageWizardPage })));
const NavigationPage = lazy(() => import('./pages/NavigationPage').then(m => ({ default: m.NavigationPage })));
const NavigationWizardPage = lazy(() => import('./pages/NavigationWizardPage').then(m => ({ default: m.NavigationWizardPage })));
const UsersPage = lazy(() => import('./pages/UsersPage').then(m => ({ default: m.UsersPage })));
const ExportsPage = lazy(() => import('./pages/ExportsPage').then(m => ({ default: m.ExportsPage })));

/** Suspense fallback shown while a lazy route chunk downloads. Intentionally
 *  minimal — the network usually beats the eye, so a heavy skeleton would
 *  flash and feel slower than a quiet placeholder. */
function RouteFallback() {
  return (
    <div className="route-fallback" role="status" aria-live="polite">
      <div className="route-fallback__spinner" />
      <span className="route-fallback__label">Cargando...</span>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <NotificationsProvider>
      <ConfirmProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/setup-password" element={<SetupPasswordPage />} />

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
        </Suspense>
      </BrowserRouter>
      </ConfirmProvider>
      </NotificationsProvider>
    </AuthProvider>
  );
}
