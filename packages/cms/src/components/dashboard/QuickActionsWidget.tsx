/**
 * QuickActionsWidget — accesos rápidos personalizados por rol (decisión 4-C)
 */

import { getQuickActionsForRole, type UserRole } from '@osalnes/shared/data/rbac';
import { DASHBOARD_COPY } from '../../pages/dashboard.copy';

const COPY = DASHBOARD_COPY.quickActions;

export interface QuickActionsWidgetProps {
  role: UserRole;
  onNavigate: (href: string) => void;
}

export default function QuickActionsWidget({ role, onNavigate }: QuickActionsWidgetProps) {
  const actions = getQuickActionsForRole(role);

  if (actions.length === 0) {
    return (
      <section className="dashboard-widget dashboard-widget-quick-actions">
        <h2 className="dashboard-widget-title">{COPY.title}</h2>
        <p className="muted">{COPY.emptyHint}</p>
      </section>
    );
  }

  return (
    <section className="dashboard-widget dashboard-widget-quick-actions">
      <h2 className="dashboard-widget-title">{COPY.title}</h2>
      <div className="quick-actions-grid">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            className={`quick-action quick-action-${action.variant}`}
            onClick={() => onNavigate(action.href)}
            title={action.description}
          >
            <span className="quick-action-icon" aria-hidden>{action.icon}</span>
            <span className="quick-action-label">{action.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
