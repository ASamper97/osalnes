import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import { locales, localeNames } from '@/i18n/config';

interface HeaderProps {
  lang: Locale;
  dict: Record<string, string>;
}

export function Header({ lang, dict }: HeaderProps) {
  return (
    <header
      style={{
        borderBottom: '1px solid var(--color-border)',
        padding: '1rem',
        maxWidth: 'var(--max-width)',
        margin: '0 auto',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <Link href={`/${lang}`} style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--color-primary)' }}>
        {dict.site_name}
      </Link>

      {/* Navigation placeholder — will be populated from API in E2 */}
      <nav style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        {/* Language switcher */}
        <span style={{ fontSize: '0.875rem', color: 'var(--color-muted)' }}>
          {locales.map((l) => (
            <Link
              key={l}
              href={`/${l}`}
              style={{
                marginLeft: '0.5rem',
                fontWeight: l === lang ? 700 : 400,
                color: l === lang ? 'var(--color-primary)' : 'var(--color-muted)',
              }}
            >
              {localeNames[l]}
            </Link>
          ))}
        </span>
      </nav>
    </header>
  );
}
