/**
 * TranslationProgressWidget — % traducción por idioma con bars clicables
 *
 * Cada barra clickable navega al listado filtrado por recursos
 * SIN traducir a ese idioma (languagesMissing=[code]).
 */

import type { TranslationProgressRow } from '@osalnes/shared/data/dashboard';
import { DASHBOARD_COPY } from '../../pages/dashboard.copy';

const COPY = DASHBOARD_COPY.translationProgress;

const LANG_LABELS: Record<string, string> = {
  es: 'Español',
  gl: 'Galego',
  en: 'English',
  fr: 'Français',
  pt: 'Português',
};

export interface TranslationProgressWidgetProps {
  rows: TranslationProgressRow[];
  loading: boolean;
  onNavigate: (href: string) => void;
}

export default function TranslationProgressWidget({
  rows,
  loading,
  onNavigate,
}: TranslationProgressWidgetProps) {
  return (
    <section className="dashboard-widget dashboard-widget-translation">
      <header className="dashboard-widget-header">
        <div>
          <h2 className="dashboard-widget-title">{COPY.title}</h2>
          <p className="dashboard-widget-subtitle">{COPY.subtitle}</p>
        </div>
      </header>

      {loading && rows.length === 0 ? (
        <div className="dashboard-widget-loading">
          {['es', 'gl', 'en', 'fr', 'pt'].map((l) => (
            <div key={l} className="dashboard-skeleton-row">
              <div className="dashboard-skeleton-bar" style={{ width: '100%' }} />
            </div>
          ))}
        </div>
      ) : rows.length === 0 || rows.every((r) => r.totalResources === 0) ? (
        <div className="dashboard-widget-empty">
          <p className="muted">{COPY.emptyHint}</p>
        </div>
      ) : (
        <ul className="translation-list" role="list">
          {rows.map((row) => {
            const missing = row.totalResources - row.translatedCount;
            const isClickable = missing > 0 && row.languageCode !== 'es';
            return (
              <li key={row.languageCode} className="translation-item">
                <button
                  type="button"
                  className="translation-item-body"
                  onClick={() => {
                    if (isClickable) {
                      onNavigate(`/resources?langs_missing=${row.languageCode}&status=published`);
                    }
                  }}
                  disabled={!isClickable}
                  aria-label={
                    isClickable
                      ? `Ver los ${missing} recursos sin traducir a ${LANG_LABELS[row.languageCode]}`
                      : `${LANG_LABELS[row.languageCode]}: ${row.progressPercent}% traducido`
                  }
                >
                  <div className="translation-item-header">
                    <span className="translation-item-label">
                      {LANG_LABELS[row.languageCode] ?? row.languageCode}
                      <span className="translation-item-code">({row.languageCode.toUpperCase()})</span>
                    </span>
                    <span className="translation-item-count">
                      {row.translatedCount} / {row.totalResources}
                      <span className="translation-item-percent">{row.progressPercent}%</span>
                    </span>
                  </div>
                  <div className="translation-item-bar" aria-hidden>
                    <div
                      className={`translation-item-bar-fill translation-item-bar-${bandForPercent(row.progressPercent)}`}
                      style={{ width: `${row.progressPercent}%` }}
                    />
                  </div>
                  {isClickable && (
                    <div className="translation-item-cta">
                      Ver los {missing} pendiente{missing === 1 ? '' : 's'} →
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function bandForPercent(p: number): 'low' | 'mid' | 'high' {
  if (p < 40) return 'low';
  if (p < 80) return 'mid';
  return 'high';
}
