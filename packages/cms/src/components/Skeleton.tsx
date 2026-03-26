/** Skeleton loading placeholders */

export function SkeletonDashboard() {
  return (
    <div>
      <div className="skeleton skeleton-text" style={{ width: '180px', height: '1.8rem', marginBottom: '0.5rem' }} />
      <div className="skeleton skeleton-text--short" style={{ width: '260px', height: '0.85rem', marginBottom: '1.5rem' }} />
      <div className="skeleton-row">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: '90px' }} />
        ))}
      </div>
      <div style={{ marginTop: '2rem' }}>
        <div className="skeleton skeleton-text" style={{ width: '200px', height: '1.2rem', marginBottom: '1rem' }} />
        <div className="skeleton-row">
          <div className="skeleton" style={{ height: '180px' }} />
          <div className="skeleton" style={{ height: '180px' }} />
        </div>
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div>
      <div className="skeleton skeleton-text" style={{ width: '220px', height: '1.8rem', marginBottom: '1.5rem' }} />
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div className="skeleton" style={{ width: '200px', height: '38px' }} />
        <div className="skeleton" style={{ width: '180px', height: '38px' }} />
        <div className="skeleton" style={{ width: '160px', height: '38px' }} />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-table-row">
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      ))}
    </div>
  );
}
