import type { Metadata } from 'next';
import { locales, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { Header } from '@/components/ui/Header';
import { Footer } from '@/components/ui/Footer';
import './globals.css';

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: { lang: Locale };
}): Promise<Metadata> {
  const dict = await getDictionary(params.lang);
  return {
    title: {
      default: dict.site_name,
      template: `%s | ${dict.site_name}`,
    },
    description: dict.site_name,
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
        <Header lang={params.lang} dict={dict} />
        <main>{children}</main>
        <Footer dict={dict} />
      </body>
    </html>
  );
}
