import Link from 'next/link';
import type { Locale } from '@/i18n/config';

interface FooterProps {
  lang: Locale;
  dict: Record<string, string>;
}

export function Footer({ lang, dict }: FooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer" role="contentinfo">
      <div className="site-footer__inner">
        <div>
          <p style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.5rem' }}>
            {dict.site_name}
          </p>
          <p>&copy; {year} {dict.footer_copyright}</p>
        </div>

        <nav className="site-footer__links" aria-label="Footer">
          <Link href={`/${lang}/info`}>{dict.practical_info}</Link>
          <Link href={`/${lang}/directorio`}>{dict.directory}</Link>
          <Link href={`/${lang}/buscar`}>{dict.search}</Link>
          <Link href={`/${lang}/agenda`}>{dict.agenda}</Link>
        </nav>

        <nav className="site-footer__links" aria-label="Legal">
          <Link href={`/${lang}/legal`}>{dict.legal_notice}</Link>
          <Link href={`/${lang}/privacidad`}>{dict.privacy}</Link>
          <Link href={`/${lang}/cookies`}>{dict.cookies}</Link>
          <Link href={`/${lang}/accesibilidad`}>{dict.accessibility}</Link>
        </nav>
      </div>

      <div className="site-footer__funding" style={{ maxWidth: 'var(--max-width)', margin: '1.5rem auto 0' }}>
        <p>{dict.footer_funded}</p>
      </div>
    </footer>
  );
}
