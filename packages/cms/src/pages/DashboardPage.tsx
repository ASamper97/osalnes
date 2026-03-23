export function DashboardPage() {
  return (
    <div>
      <h1>Dashboard</h1>
      <p>Panel de administracion DTI Salnes</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
        <StatCard label="Recursos" value="--" />
        <StatCard label="Publicados" value="--" />
        <StatCard label="Borradores" value="--" />
        <StatCard label="Municipios" value="9" />
      </div>

      <p style={{ marginTop: '2rem', color: 'var(--cms-border)' }}>
        Estadisticas y graficos se implementaran en fase E2
      </p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--cms-border)',
        borderRadius: 8,
        padding: '1.25rem',
      }}
    >
      <div style={{ fontSize: '0.8rem', color: 'var(--cms-border)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--cms-primary)' }}>{value}</div>
    </div>
  );
}
