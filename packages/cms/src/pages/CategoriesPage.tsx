import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export function CategoriesPage() {
  const [categories, setCategories] = useState<unknown[] | null>(null);

  useEffect(() => {
    api.getCategories().then((data) => setCategories(data as unknown[]));
  }, []);

  return (
    <div>
      <h1>Categorias</h1>
      {!categories ? (
        <p>Cargando...</p>
      ) : (
        <ul style={{ listStyle: 'none', marginTop: '1rem' }}>
          {categories.map((cat: any) => (
            <li
              key={cat.id}
              style={{
                padding: '0.5rem 0',
                borderBottom: '1px solid var(--cms-border)',
                paddingLeft: cat.parentId ? '2rem' : 0,
              }}
            >
              <strong>{cat.slug}</strong>
              {cat.name?.es && <span style={{ marginLeft: '0.5rem', color: 'var(--cms-text)' }}>({cat.name.es})</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
