import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';

export default async function HomePage({
  params,
}: {
  params: { lang: Locale };
}) {
  const dict = await getDictionary(params.lang);

  return (
    <section>
      <h1>{dict.site_name}</h1>
      <p>
        {params.lang === 'gl'
          ? 'Benvido ao portal turístico de O Salnés'
          : params.lang === 'en'
            ? 'Welcome to the O Salnés tourism portal'
            : 'Bienvenido al portal turístico de O Salnés'}
      </p>
      {/* E2: Hero, featured resources, category grid, events carousel */}
    </section>
  );
}
