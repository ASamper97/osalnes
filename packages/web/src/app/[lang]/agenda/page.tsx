import type { Metadata } from 'next';
import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { getEvents } from '@/lib/api-client';

export const runtime = 'edge';

export async function generateMetadata({ params }: { params: { lang: Locale } }): Promise<Metadata> {
  const dict = await getDictionary(params.lang);
  return { title: dict.agenda };
}

export default async function AgendaPage({
  params,
}: {
  params: { lang: Locale };
}) {
  const lang = params.lang;
  const dict = await getDictionary(lang);
  const today = new Date().toISOString().slice(0, 10);

  const [upcoming, past] = await Promise.all([
    getEvents({ from: today }).catch(() => []),
    getEvents({ to: today }).catch(() => []),
  ]);

  return (
    <>
      <h1 style={{ fontSize: '2rem', color: 'var(--color-primary)', marginBottom: '1.5rem' }}>
        {dict.agenda}
      </h1>

      {/* Upcoming */}
      <section className="section">
        <div className="section__header">
          <h2>{dict.events_upcoming}</h2>
        </div>
        {upcoming.length > 0 ? (
          <div className="card-grid">
            {upcoming.map((evt: any) => (
              <article key={evt.id} className="card">
                <div className="card__body">
                  <span className="card__meta">{evt.startDate}{evt.endDate && evt.endDate !== evt.startDate ? ` — ${evt.endDate}` : ''}</span>
                  <h3 className="card__title">{evt.name?.[lang] || evt.name?.es || 'Evento'}</h3>
                  {evt.description?.[lang] && (
                    <p className="card__desc">{evt.description[lang].slice(0, 150)}</p>
                  )}
                  {evt.location && <p className="card__desc" style={{ marginTop: '0.5rem', fontStyle: 'italic' }}>{evt.location}</p>}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--color-muted)' }}>{dict.no_results}</p>
        )}
      </section>

      {/* Past */}
      {past.length > 0 && (
        <section className="section">
          <div className="section__header">
            <h2>{dict.events_past}</h2>
          </div>
          <div className="card-grid">
            {past.slice(0, 8).map((evt: any) => (
              <article key={evt.id} className="card" style={{ opacity: 0.7 }}>
                <div className="card__body">
                  <span className="card__meta">{evt.startDate}</span>
                  <h3 className="card__title">{evt.name?.[lang] || evt.name?.es || 'Evento'}</h3>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
