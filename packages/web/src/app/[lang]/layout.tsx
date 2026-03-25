import type { Metadata, Viewport } from 'next';
import { locales, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { Header } from '@/components/ui/Header';
import { Footer } from '@/components/ui/Footer';
import { AssistantFAB } from '@/components/AssistantFAB';
import './globals.css';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://turismo.osalnes.gal';

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1a5276',
};

export async function generateMetadata({
  params,
}: {
  params: { lang: Locale };
}): Promise<Metadata> {
  const dict = await getDictionary(params.lang);
  const lang = params.lang;

  return {
    title: {
      default: dict.site_name,
      template: `%s | ${dict.site_name}`,
    },
    description: dict.hero_subtitle,
    metadataBase: new URL(BASE_URL),
    alternates: {
      canonical: `/${lang}`,
      languages: Object.fromEntries(
        locales.map((l) => [l, `/${l}`]),
      ),
    },
    openGraph: {
      type: 'website',
      locale: lang,
      siteName: dict.site_name,
      title: dict.site_name,
      description: dict.hero_subtitle,
      url: `${BASE_URL}/${lang}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: dict.site_name,
      description: dict.hero_subtitle,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { lang: Locale };
}) {
  const dict = await getDictionary(params.lang);

  return (
    <html lang={params.lang}>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <Header lang={params.lang} dict={dict} />
        <main id="main-content">{children}</main>
        <Footer lang={params.lang} dict={dict} />
        <AssistantFAB lang={params.lang} dict={dict} />
      </body>
    </html>
  );
}
