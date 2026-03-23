'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { Locale } from '@/i18n/config';
import { locales, localeNames } from '@/i18n/config';

interface HeaderProps {
  lang: Locale;
  dict: Record<string, string>;
}

const NAV_ITEMS: { key: string; href: string }[] = [
  { key: 'experiences', href: '/experiencias' },
  { key: 'what_to_see', href: '/que-ver' },
  { key: 'what_to_do', href: '/que-hacer' },
  { key: 'agenda', href: '/agenda' },
  { key: 'directory', href: '/directorio' },
  { key: 'news', href: '/noticias' },
  { key: 'map', href: '/mapa' },
  { key: 'practical_info', href: '/info' },
];

export function Header({ lang, dict }: HeaderProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href={`/${lang}`} className="site-header__logo">
          {dict.site_name}
        </Link>

        {/* Desktop nav */}
        <nav className="site-nav" aria-label={dict.site_name}>
          {NAV_ITEMS.map(({ key, href }) => {
            const fullHref = `/${lang}${href}`;
            const isCurrent = pathname === fullHref;
            return (
              <Link
                key={key}
                href={fullHref}
                aria-current={isCurrent ? 'page' : undefined}
              >
                {dict[key]}
              </Link>
            );
          })}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Search link */}
          <Link
            href={`/${lang}/buscar`}
            className="site-header__search"
            aria-label={dict.search}
            title={dict.search}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </Link>

          {/* Language switcher */}
          <div className="lang-switcher">
            {locales.map((l) => (
              <Link
                key={l}
                href={`/${l}${pathname.replace(`/${lang}`, '')}`}
                className={l === lang ? 'active' : ''}
                aria-label={localeNames[l]}
              >
                {l.toUpperCase()}
              </Link>
            ))}
          </div>

          {/* Mobile menu toggle */}
          <button
            className="site-header__burger"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-label="Menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              {menuOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile nav overlay */}
      {menuOpen && (
        <nav className="site-nav--mobile" aria-label={dict.site_name}>
          {NAV_ITEMS.map(({ key, href }) => {
            const fullHref = `/${lang}${href}`;
            const isCurrent = pathname === fullHref;
            return (
              <Link
                key={key}
                href={fullHref}
                aria-current={isCurrent ? 'page' : undefined}
                onClick={() => setMenuOpen(false)}
              >
                {dict[key]}
              </Link>
            );
          })}
          <Link href={`/${lang}/buscar`} onClick={() => setMenuOpen(false)}>
            {dict.search}
          </Link>
        </nav>
      )}
    </header>
  );
}
