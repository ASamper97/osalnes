/**
 * ResourceWizardStep3Location — Paso 3 del wizard de recursos
 *
 * Secciones (verticales):
 *   1. Ubicación en el mapa (3 tabs: buscar / clic / pegar enlace)
 *   2. Dirección postal (auto-rellena al mover el pin, editable)
 *   3. Contacto (teléfono, email, web, redes sociales)
 *   4. Horarios y disponibilidad (7 plantillas + cierres)
 *
 * Sin IA — decisión de producto.
 * Accesibilidad: bloque de ayuda plegable, stepper navegable, mapa con
 * role="application" y aria-label descriptivo, alternativa textual
 * siempre visible (coordenadas como texto debajo del mapa).
 */

import { useEffect, useState } from 'react';
import HelpBlock from '../components/HelpBlock';
import LocationMap from '../components/LocationMap';
import OpeningHoursSelector from '../components/OpeningHoursSelector';
import SocialLinksEditor, { type SocialLink } from '../components/SocialLinksEditor';
import {
  geocodeSearch,
  reverseGeocode,
  parseMapUrl,
  type GeocodeResult,
} from '../lib/geocoding';
import { isInOSalnes } from '@osalnes/shared/data/osalnes-geo';
import type { OpeningHoursPlan } from '@osalnes/shared/data/opening-hours';
import { STEP3_COPY } from './step3-location.copy';

// ─── Forma del estado que el padre gestiona ────────────────────────────

export interface LocationData {
  lat: number | null;
  lng: number | null;
  streetAddress: string;
  postalCode: string;
  locality: string;
  parroquia: string;
}

export interface ContactData {
  phone: string;
  email: string;
  web: string;
  socialLinks: SocialLink[];
}

export interface ResourceWizardStep3LocationProps {
  location: LocationData;
  onChangeLocation: (next: LocationData) => void;

  contact: ContactData;
  onChangeContact: (next: ContactData) => void;

  hoursPlan: OpeningHoursPlan;
  onChangeHoursPlan: (next: OpeningHoursPlan) => void;

  /** Municipio del paso 1, para centrar el mapa inicial */
  municipioName?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────

type LocationTab = 'search' | 'click' | 'url';

export default function ResourceWizardStep3Location({
  location,
  onChangeLocation,
  contact,
  onChangeContact,
  hoursPlan,
  onChangeHoursPlan,
  municipioName,
}: ResourceWizardStep3LocationProps) {
  const [tab, setTab] = useState<LocationTab>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);

  const [manualOpen, setManualOpen] = useState(false);

  // ─── Geocoding search con debounce ────────────────────────────────

  useEffect(() => {
    if (tab !== 'search') return;
    const q = searchQuery.trim();
    if (q.length < 3) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      setSearchError(null);
      try {
        const results = await geocodeSearch(q);
        setSearchResults(results);
      } catch {
        setSearchError(STEP3_COPY.location.searchError);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, tab]);

  // ─── Handlers ──────────────────────────────────────────────────────

  const applyGeocodeResult = (r: GeocodeResult) => {
    onChangeLocation({
      lat: r.lat,
      lng: r.lng,
      streetAddress: r.address.streetAddress ?? '',
      postalCode: r.address.postalCode ?? '',
      locality: r.address.locality ?? '',
      parroquia: r.address.parroquia ?? '',
    });
    setSearchResults([]);
    setSearchQuery('');
  };

  const handleMapChange = async (lat: number, lng: number) => {
    // Optimistic: actualizamos lat/lng inmediatamente
    onChangeLocation({ ...location, lat, lng });

    // Reverse geocode en segundo plano para auto-rellenar dirección
    try {
      const reverse = await reverseGeocode(lat, lng);
      if (reverse) {
        onChangeLocation({
          lat,
          lng,
          // Si el usuario ya tenía algo escrito manualmente, respetarlo
          streetAddress: location.streetAddress || reverse.address.streetAddress || '',
          postalCode:    location.postalCode    || reverse.address.postalCode    || '',
          locality:      location.locality      || reverse.address.locality      || '',
          parroquia:     location.parroquia     || reverse.address.parroquia     || '',
        });
      }
    } catch {
      // reverse geocode silencioso: mantener solo lat/lng
    }
  };

  const handleUrlPaste = () => {
    setUrlError(null);
    const coords = parseMapUrl(urlInput);
    if (!coords) {
      setUrlError(STEP3_COPY.location.urlError);
      return;
    }
    handleMapChange(coords.lat, coords.lng);
    setUrlInput('');
  };

  // ─── Render ────────────────────────────────────────────────────────

  const COPY = STEP3_COPY;
  const showOutsideWarning =
    location.lat != null && location.lng != null && !isInOSalnes(location.lat, location.lng);

  return (
    <div className="step3-content">
      <header className="step3-header">
        <h2>{COPY.header.title}</h2>
        <p>{COPY.header.subtitle}</p>
      </header>

      <HelpBlock
        storageKey="resource-wizard-step3"
        title={COPY.helpBlock.title}
        toggleHideLabel={COPY.helpBlock.toggleHide}
        toggleShowLabel={COPY.helpBlock.toggleShow}
      >
        <ul>
          {COPY.helpBlock.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <p className="help-block-note">{COPY.helpBlock.note}</p>
      </HelpBlock>

      {/* ═══════════ 1. UBICACIÓN EN EL MAPA ═══════════ */}
      <section className="step3-section">
        <header>
          <h3>{COPY.location.sectionTitle}</h3>
          <p className="muted">{COPY.location.sectionDesc}</p>
        </header>

        <div className="step3-location-layout">
          {/* Columna izquierda: tabs + mapa */}
          <div className="step3-location-map-col">
            <div role="tablist" className="step3-tabs">
              <button
                role="tab"
                aria-selected={tab === 'search'}
                className={`step3-tab ${tab === 'search' ? 'active' : ''}`}
                onClick={() => setTab('search')}
                type="button"
              >
                🔍 {COPY.location.tabs.search}
              </button>
              <button
                role="tab"
                aria-selected={tab === 'click'}
                className={`step3-tab ${tab === 'click' ? 'active' : ''}`}
                onClick={() => setTab('click')}
                type="button"
              >
                📍 {COPY.location.tabs.click}
              </button>
              <button
                role="tab"
                aria-selected={tab === 'url'}
                className={`step3-tab ${tab === 'url' ? 'active' : ''}`}
                onClick={() => setTab('url')}
                type="button"
              >
                🔗 {COPY.location.tabs.url}
              </button>
            </div>

            <div className="step3-tab-panel">
              {tab === 'search' && (
                <div className="step3-search">
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={COPY.location.searchPlaceholder}
                    aria-label={COPY.location.tabs.search}
                  />
                  {searchLoading && <p className="muted">Buscando…</p>}
                  {searchError && <p className="step3-error">{searchError}</p>}
                  {!searchLoading && searchResults.length > 0 && (
                    <ul className="step3-search-results" role="listbox">
                      {searchResults.map((r, i) => (
                        <li key={`${r.lat}-${r.lng}-${i}`}>
                          <button
                            type="button"
                            className="step3-search-result"
                            onClick={() => applyGeocodeResult(r)}
                          >
                            {r.displayName}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!searchLoading &&
                    searchQuery.trim().length >= 3 &&
                    searchResults.length === 0 &&
                    !searchError && <p className="muted">{COPY.location.searchEmpty}</p>}
                  {searchQuery.trim().length < 3 && (
                    <p className="muted">{COPY.location.searchHint}</p>
                  )}
                </div>
              )}

              {tab === 'click' && (
                <p className="muted step3-tab-hint">{COPY.location.clickHint}</p>
              )}

              {tab === 'url' && (
                <div className="step3-url">
                  <div className="step3-url-input-row">
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder={COPY.location.urlPlaceholder}
                      aria-label={COPY.location.tabs.url}
                    />
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleUrlPaste}
                      disabled={!urlInput.trim()}
                    >
                      Extraer
                    </button>
                  </div>
                  <p className="muted">{COPY.location.urlHint}</p>
                  {urlError && <p className="step3-error">{urlError}</p>}
                </div>
              )}
            </div>

            <LocationMap
              lat={location.lat}
              lng={location.lng}
              onLocationChange={handleMapChange}
              municipioName={municipioName}
            />

            {/* Coordenadas como texto (accesible, siempre visible) */}
            <div className="step3-coords">
              <span>
                {location.lat != null && location.lng != null
                  ? `${COPY.location.coordsLabelPrefix} ${location.lat.toFixed(5)}°, ${location.lng.toFixed(5)}°`
                  : COPY.location.coordsPendingLabel}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setManualOpen((v) => !v)}
              >
                {COPY.location.editManuallyLabel}
              </button>
            </div>

            {manualOpen && (
              <ManualCoords
                lat={location.lat}
                lng={location.lng}
                onApply={(lat, lng) => {
                  handleMapChange(lat, lng);
                  setManualOpen(false);
                }}
                onCancel={() => setManualOpen(false)}
              />
            )}

            {showOutsideWarning && (
              <p className="step3-warning">⚠️ {COPY.location.outsideOSalnesWarning}</p>
            )}
          </div>

          {/* Columna derecha: dirección postal */}
          <div className="step3-address-col">
            <h4>{COPY.address.sectionTitle}</h4>
            <p className="muted">{COPY.address.sectionDesc}</p>

            <label>
              {COPY.address.streetLabel}
              <input
                type="text"
                value={location.streetAddress}
                onChange={(e) =>
                  onChangeLocation({ ...location, streetAddress: e.target.value })
                }
                placeholder={COPY.address.streetPlaceholder}
              />
            </label>

            <label>
              {COPY.address.postalCodeLabel}
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{5}"
                value={location.postalCode}
                onChange={(e) =>
                  onChangeLocation({ ...location, postalCode: e.target.value })
                }
                placeholder={COPY.address.postalCodePlaceholder}
              />
            </label>

            <label>
              {COPY.address.localityLabel}
              <input
                type="text"
                value={location.locality}
                onChange={(e) => onChangeLocation({ ...location, locality: e.target.value })}
                placeholder={COPY.address.localityPlaceholder}
              />
            </label>

            <label>
              {COPY.address.parroquiaLabel}
              <input
                type="text"
                value={location.parroquia}
                onChange={(e) => onChangeLocation({ ...location, parroquia: e.target.value })}
                placeholder={COPY.address.parroquiaPlaceholder}
              />
            </label>
          </div>
        </div>
      </section>

      {/* ═══════════ 2. CONTACTO ═══════════ */}
      <section className="step3-section">
        <header>
          <h3>{COPY.contact.sectionTitle}</h3>
          <p className="muted">{COPY.contact.sectionDesc}</p>
        </header>

        <div className="step3-contact-grid">
          <label>
            {COPY.contact.phoneLabel}
            <input
              type="tel"
              value={contact.phone}
              onChange={(e) => onChangeContact({ ...contact, phone: e.target.value })}
              placeholder={COPY.contact.phonePlaceholder}
            />
            <small className="field-hint">{COPY.contact.phoneHint}</small>
          </label>

          <label>
            {COPY.contact.emailLabel}
            <input
              type="email"
              value={contact.email}
              onChange={(e) => onChangeContact({ ...contact, email: e.target.value })}
              placeholder={COPY.contact.emailPlaceholder}
            />
          </label>

          <label>
            {COPY.contact.webLabel}
            <input
              type="url"
              value={contact.web}
              onChange={(e) => onChangeContact({ ...contact, web: e.target.value })}
              placeholder={COPY.contact.webPlaceholder}
            />
          </label>
        </div>

        <div className="step3-social">
          <h4>{COPY.contact.socialSectionTitle}</h4>
          <SocialLinksEditor
            links={contact.socialLinks}
            onChange={(next) => onChangeContact({ ...contact, socialLinks: next })}
          />
        </div>
      </section>

      {/* ═══════════ 3. HORARIOS ═══════════ */}
      <section className="step3-section">
        <header>
          <h3>{COPY.hours.sectionTitle}</h3>
          <p className="muted">{COPY.hours.sectionDesc}</p>
        </header>

        <OpeningHoursSelector
          plan={hoursPlan}
          onChange={onChangeHoursPlan}
          contactPhone={contact.phone}
          contactWeb={contact.web}
        />
      </section>
    </div>
  );
}

// ─── Editor manual de coordenadas ──────────────────────────────────────

function ManualCoords({
  lat,
  lng,
  onApply,
  onCancel,
}: {
  lat: number | null;
  lng: number | null;
  onApply: (lat: number, lng: number) => void;
  onCancel: () => void;
}) {
  const [latStr, setLatStr] = useState(lat != null ? lat.toString() : '');
  const [lngStr, setLngStr] = useState(lng != null ? lng.toString() : '');
  const [error, setError] = useState<string | null>(null);

  const handleApply = () => {
    const nLat = Number(latStr.replace(',', '.'));
    const nLng = Number(lngStr.replace(',', '.'));
    if (
      !Number.isFinite(nLat) ||
      !Number.isFinite(nLng) ||
      nLat < -90 ||
      nLat > 90 ||
      nLng < -180 ||
      nLng > 180
    ) {
      setError('Coordenadas no válidas. Latitud entre -90 y 90, longitud entre -180 y 180.');
      return;
    }
    onApply(nLat, nLng);
  };

  return (
    <div className="step3-manual-coords">
      <div>
        <label>
          {STEP3_COPY.location.editManualLatLabel}
          <input
            type="text"
            inputMode="decimal"
            value={latStr}
            onChange={(e) => setLatStr(e.target.value)}
          />
        </label>
        <label>
          {STEP3_COPY.location.editManualLngLabel}
          <input
            type="text"
            inputMode="decimal"
            value={lngStr}
            onChange={(e) => setLngStr(e.target.value)}
          />
        </label>
      </div>
      {error && <p className="step3-error">{error}</p>}
      <div className="step3-manual-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          {STEP3_COPY.location.editManualCancelLabel}
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={handleApply}>
          {STEP3_COPY.location.editManualApplyLabel}
        </button>
      </div>
    </div>
  );
}
