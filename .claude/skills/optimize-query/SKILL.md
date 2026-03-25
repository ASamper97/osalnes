---
name: optimize-query
description: Analyze and optimize database queries in a service file. Fix N+1 problems, add batch queries, add caching.
argument-hint: [service file path, e.g. "resource.service.ts"]
disable-model-invocation: true
---

Optimize queries in "$ARGUMENTS".

## What to look for

### N+1 Queries
```typescript
// BAD: N+1
return Promise.all(items.map(async (r) => ({
  ...r,
  name: await getTranslatedField('entity', r.id, 'name'),
})));

// GOOD: Batch
const { data: translations } = await supabase
  .from('traduccion')
  .select('entidad_id, idioma, valor')
  .eq('entidad_tipo', 'entity')
  .eq('campo', 'name')
  .in('entidad_id', ids);
```

### Parallel queries
```typescript
// BAD: Sequential
const { count: a } = await supabase.from('x').select('*', { count: 'exact', head: true });
const { count: b } = await supabase.from('y').select('*', { count: 'exact', head: true });

// GOOD: Parallel
const [{ count: a }, { count: b }] = await Promise.all([
  supabase.from('x').select('*', { count: 'exact', head: true }),
  supabase.from('y').select('*', { count: 'exact', head: true }),
]);
```

### Caching
- Stats/dashboard endpoints: in-memory cache with TTL (60s)
- Auth headers: cache for 30s with invalidation on logout

## Output
For each issue found: before/after code, estimated query reduction (e.g. "21 queries -> 2").
