import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from './i18n/config';

/**
 * Middleware: redirect root to /{defaultLocale}, ensure valid locale prefix.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the pathname already has a locale prefix
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`,
  );

  if (pathnameHasLocale) return NextResponse.next();

  // Skip static files and api routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Detect preferred locale from Accept-Language header
  const acceptLang = request.headers.get('accept-language') || '';
  const preferred = locales.find((l) => acceptLang.includes(l)) || defaultLocale;

  // Redirect to locale-prefixed path
  const url = request.nextUrl.clone();
  url.pathname = `/${preferred}${pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico|.*\\..*).*)'],
};
