import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export function ResourcesPage() {
  const [resources, setResources] = useState<{ items: unknown[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getResources()
      .then((data) => setResources(data as { items: unknown[]; total: number }))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div>
      <h1>Recursos turisticos</h1>

      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {!resources && !error && <p>Cargando...</p>}

      {resources && (
        <>
          <p style={{ margin: '1rem 0', color: 'var(--cms-text)' }}>
            Total: {resources.total} recursos
          </p>
          {/* E2: full data table with filters, pagination, inline editing */}
          <p style={{ color: 'var(--cms-border)' }}>
            Tabla de recursos se implementara en fase E2
          </p>
        </>
      )}
    </div>
  );
}
