/**
 * LanguageChips — 5 letritas ES/GL/EN/FR/PT activadas según cobertura
 *
 * Las que tienen contenido: pill coloreada.
 * Las que no: pill gris claro.
 */

export default function LanguageChips({
  es,
  gl,
  en,
  fr,
  pt,
}: {
  es: boolean;
  gl: boolean;
  en: boolean;
  fr: boolean;
  pt: boolean;
}) {
  const langs = [
    { key: 'ES', active: es },
    { key: 'GL', active: gl },
    { key: 'EN', active: en },
    { key: 'FR', active: fr },
    { key: 'PT', active: pt },
  ];

  return (
    <div className="list-lang-chips" role="group" aria-label="Idiomas con contenido">
      {langs.map(({ key, active }) => (
        <span
          key={key}
          className={`list-lang-chip ${active ? 'is-active' : 'is-missing'}`}
          aria-label={`${key} ${active ? 'disponible' : 'sin traducir'}`}
        >
          {key}
        </span>
      ))}
    </div>
  );
}
