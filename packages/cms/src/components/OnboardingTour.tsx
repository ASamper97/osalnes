import { useEffect, useState, useCallback, useLayoutEffect } from 'react';

/**
 * OnboardingTour — Tour interactivo de bienvenida al CMS
 *
 * Se muestra automaticamente la primera vez que un usuario entra al CMS
 * (controlado via localStorage) y puede relanzarse desde el sidebar.
 *
 * Cada paso apunta a un elemento del DOM (via data-tour attribute) o se
 * muestra centrado en pantalla. Renderiza un backdrop oscuro con un
 * "agujero" alrededor del elemento highlighted y un tooltip explicativo.
 */

export interface TourStep {
  id: string;
  title: string;
  description: string;
  /** CSS selector of the element to highlight (optional — if absent, centered modal) */
  target?: string;
  /** Where to place the tooltip relative to the target */
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  icon?: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Bienvenido al CMS de O Salnes',
    description: 'Vamos a hacer un tour rapido de 1 minuto para que sepas donde esta cada cosa. Puedes saltarlo en cualquier momento y volver a verlo desde el menu lateral.',
    icon: '👋',
    placement: 'center',
  },
  {
    id: 'sidebar',
    title: 'Este es el menu principal',
    description: 'Aqui tienes todas las secciones del CMS: recursos turisticos, categorias, paginas, navegacion del portal, exportaciones y mas. Las opciones varian segun tu rol.',
    icon: '📋',
    target: '[data-tour="sidebar"]',
    placement: 'right',
  },
  {
    id: 'resources',
    title: 'Recursos turisticos',
    description: 'Aqui gestionas todos los recursos del catalogo: hoteles, playas, restaurantes, museos, eventos... Es la seccion que mas vas a usar.',
    icon: '🏖️',
    target: '[data-tour="nav-resources"]',
    placement: 'right',
  },
  {
    id: 'new-resource',
    title: 'Crear con asistente paso a paso',
    description: 'Pulsa el boton "Nuevo recurso" para abrir el asistente. Te guiara en 7 pasos: identificacion, contenido, ubicacion, clasificacion, multimedia, SEO y revision final. Podras incluso importar datos desde una URL externa con IA.',
    icon: '✨',
    placement: 'center',
  },
  {
    id: 'ai',
    title: 'IA disponible en cualquier momento',
    description: 'Este boton flotante en la esquina inferior derecha abre el asistente IA del CMS. Puedes hacerle cualquier pregunta: como rellenar un campo, traducir contenido, mejorar descripciones, generar SEO... Esta entrenado con conocimiento de O Salnes.',
    icon: '✦',
    target: '[data-tour="ai-fab"]',
    placement: 'left',
  },
  {
    id: 'help',
    title: 'Listo!',
    description: 'Ya conoces lo basico. Cada pantalla del CMS tiene tips contextuales y la IA esta siempre disponible. Si quieres ver este tour de nuevo, pulsa "Ver tour" en el menu lateral.',
    icon: '🚀',
    placement: 'center',
  },
];

const STORAGE_KEY = 'osalnes_tour_completed_v1';

interface OnboardingTourProps {
  open: boolean;
  onClose: () => void;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function OnboardingTour({ open, onClose }: OnboardingTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);

  const step = TOUR_STEPS[stepIndex];
  const isLast = stepIndex === TOUR_STEPS.length - 1;
  const isFirst = stepIndex === 0;

  // Reset to first step when opened
  useEffect(() => {
    if (open) setStepIndex(0);
  }, [open]);

  // Compute target position whenever the step changes or window resizes
  useLayoutEffect(() => {
    if (!open || !step) return;

    function updateTarget() {
      if (!step.target) {
        setTargetRect(null);
        return;
      }
      const el = document.querySelector(step.target);
      if (!el) {
        setTargetRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setTargetRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      // Scroll into view smoothly
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    updateTarget();
    window.addEventListener('resize', updateTarget);
    window.addEventListener('scroll', updateTarget, true);
    return () => {
      window.removeEventListener('resize', updateTarget);
      window.removeEventListener('scroll', updateTarget, true);
    };
  }, [open, step]);

  const handleNext = useCallback(() => {
    if (isLast) {
      finishTour();
    } else {
      setStepIndex((s) => s + 1);
    }
  }, [isLast]);

  const handlePrev = useCallback(() => {
    if (!isFirst) setStepIndex((s) => s - 1);
  }, [isFirst]);

  function finishTour() {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
    onClose();
  }

  function handleSkip() {
    finishTour();
  }

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleSkip();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') handleNext();
      else if (e.key === 'ArrowLeft') handlePrev();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stepIndex]);

  if (!open || !step) return null;

  // Compute tooltip position based on target rect and placement
  const placement = step.placement || (targetRect ? 'bottom' : 'center');
  let tooltipStyle: React.CSSProperties = {};

  if (targetRect && placement !== 'center') {
    const PADDING = 18;
    const TOOLTIP_W = 380;
    const TOOLTIP_H = 240;

    switch (placement) {
      case 'right':
        tooltipStyle = {
          top: Math.max(20, targetRect.top + targetRect.height / 2 - TOOLTIP_H / 2),
          left: targetRect.left + targetRect.width + PADDING,
        };
        break;
      case 'left':
        tooltipStyle = {
          top: Math.max(20, targetRect.top + targetRect.height / 2 - TOOLTIP_H / 2),
          left: Math.max(20, targetRect.left - TOOLTIP_W - PADDING),
        };
        break;
      case 'top':
        tooltipStyle = {
          top: Math.max(20, targetRect.top - TOOLTIP_H - PADDING),
          left: Math.max(20, targetRect.left + targetRect.width / 2 - TOOLTIP_W / 2),
        };
        break;
      case 'bottom':
      default:
        tooltipStyle = {
          top: targetRect.top + targetRect.height + PADDING,
          left: Math.max(20, targetRect.left + targetRect.width / 2 - TOOLTIP_W / 2),
        };
    }

    // Clamp to viewport
    if (typeof window !== 'undefined') {
      const maxLeft = window.innerWidth - TOOLTIP_W - 20;
      const maxTop = window.innerHeight - TOOLTIP_H - 20;
      if (typeof tooltipStyle.left === 'number' && tooltipStyle.left > maxLeft) tooltipStyle.left = maxLeft;
      if (typeof tooltipStyle.top === 'number' && tooltipStyle.top > maxTop) tooltipStyle.top = maxTop;
    }
  } else {
    // Centered
    tooltipStyle = {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }

  // Spotlight (the "hole" in the backdrop)
  const HOLE_PADDING = 8;
  const spotlight = targetRect && placement !== 'center' ? {
    top: targetRect.top - HOLE_PADDING,
    left: targetRect.left - HOLE_PADDING,
    width: targetRect.width + HOLE_PADDING * 2,
    height: targetRect.height + HOLE_PADDING * 2,
  } : null;

  return (
    <div className="onboarding-tour" role="dialog" aria-label="Tour de bienvenida">
      {/* Backdrop with spotlight */}
      <div className="onboarding-tour__backdrop" onClick={handleSkip}>
        {spotlight && (
          <div
            className="onboarding-tour__spotlight"
            style={{
              top: `${spotlight.top}px`,
              left: `${spotlight.left}px`,
              width: `${spotlight.width}px`,
              height: `${spotlight.height}px`,
            }}
          />
        )}
      </div>

      {/* Tooltip */}
      <div
        className={`onboarding-tour__tooltip onboarding-tour__tooltip--${placement}`}
        style={tooltipStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="onboarding-tour__progress">
          {TOUR_STEPS.map((_, i) => (
            <span
              key={i}
              className={`onboarding-tour__progress-dot ${i === stepIndex ? 'onboarding-tour__progress-dot--active' : ''} ${i < stepIndex ? 'onboarding-tour__progress-dot--done' : ''}`}
            />
          ))}
        </div>

        <div className="onboarding-tour__icon">{step.icon}</div>
        <h2 className="onboarding-tour__title">{step.title}</h2>
        <p className="onboarding-tour__desc">{step.description}</p>

        <div className="onboarding-tour__nav">
          <button type="button" className="onboarding-tour__skip" onClick={handleSkip}>
            Saltar tour
          </button>
          <div className="onboarding-tour__nav-right">
            {!isFirst && (
              <button type="button" className="btn btn-sm" onClick={handlePrev}>← Anterior</button>
            )}
            <button type="button" className="btn btn-sm btn-primary" onClick={handleNext}>
              {isLast ? 'Empezar a usar el CMS' : 'Siguiente →'}
            </button>
          </div>
        </div>

        <div className="onboarding-tour__step-counter">
          {stepIndex + 1} / {TOUR_STEPS.length}
        </div>
      </div>
    </div>
  );
}

/** Returns true if the user has not yet completed the tour */
export function shouldShowTour(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== '1';
  } catch {
    return false;
  }
}

/** Manually reset the tour (so it shows again next time) */
export function resetTour(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
