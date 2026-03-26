'use client';

import { useEffect } from 'react';

export default function RootPage() {
  useEffect(() => {
    const lang = navigator.language?.slice(0, 2) || 'es';
    const supported = ['es', 'gl', 'en', 'fr', 'pt'];
    const target = supported.includes(lang) ? lang : 'es';
    window.location.replace(`/${target}/`);
  }, []);

  return (
    <html lang="es">
      <head>
        <meta httpEquiv="refresh" content="0;url=/es/" />
      </head>
      <body />
    </html>
  );
}
