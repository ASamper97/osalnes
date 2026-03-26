import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { getPage } from '@/lib/api-client';

export const runtime = 'edge';

export async function generateMetadata({ params }: { params: { lang: Locale } }): Promise<Metadata> {
  const dict = await getDictionary(params.lang);
  return { title: dict.practical_info };
}

export default async function InfoPage({
  params,
}: {
  params: { lang: Locale };
}) {
  const lang = params.lang;
  const dict = await getDictionary(lang);

  const page = await getPage('info-practica').catch(() => null);

  return (
    <div className="page-content">
      <h1>{page?.title?.[lang] || page?.title?.es || dict.practical_info}</h1>
      {page?.body?.[lang] || page?.body?.es ? (
        <div dangerouslySetInnerHTML={{ __html: page.body[lang] || page.body.es || '' }} />
      ) : (
        <p style={{ color: 'var(--color-muted)' }}>{dict.no_results}</p>
      )}
    </div>
  );
}
