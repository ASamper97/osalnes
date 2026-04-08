# Ideas futuras — Plataforma DTI O Salnés

Documento vivo con ideas, especificaciones y propuestas que **no están implementadas** pero quedan registradas para futuras iteraciones.

Cuando alguien (yo mismo, otro desarrollador, otra sesión de IA) retome el proyecto, debería poder leer este documento y entender la motivación, el alcance y los detalles técnicos sin tener que repensar nada.

---

## Índice

1. [Setup Wizard del destino completo](#1-setup-wizard-del-destino-completo) — La más ambiciosa, killer feature comercial
2. [App móvil del CMS](#2-app-móvil-del-cms) — Editar desde móvil con voz
3. [Búsqueda global con Cmd+K](#3-búsqueda-global-con-cmdk) — Spotlight-like
4. [Notificaciones in-app](#4-notificaciones-in-app)
5. [Filtros guardados](#5-filtros-guardados-en-recursos)
6. [Modo oscuro completo](#6-modo-oscuro-completo)
7. [Dashboard personalizable por rol](#7-dashboard-personalizable-por-rol)
8. [Empty states + confirmaciones bonitas](#8-empty-states--confirmaciones-bonitas)
9. [Tour por roles](#9-tour-de-bienvenida-segmentado-por-rol)

---

## 1. Setup Wizard del destino completo

> **Estado**: No implementado
> **Prioridad**: Baja para O Salnés (BBDD ya poblada), Alta cuando se comercialice a otros destinos
> **Esfuerzo estimado**: 1.500-2.000 líneas, 6-8 archivos nuevos, ~2-3 días de desarrollo
> **Documentado el**: 8 de abril de 2026

### Contexto y motivación

La plataforma DTI O Salnés está construida sobre una arquitectura modular y reutilizable. El día que se quiera **replicar a otra mancomunidad** (Costa da Morte, Ría de Vigo, Pontevedra...) o **vender como producto SaaS** a otras administraciones, el problema actual es que la primera carga del CMS empieza con una BBDD vacía y un admin que tiene que crear todo a mano:

- Categorías (taxonomía de tipos de recurso)
- Zonas geográficas
- Páginas editoriales (información práctica, sobre nosotros, política de cookies)
- Menú principal del portal
- Recursos de ejemplo

Esto son **varias horas de trabajo tedioso** y para alguien no técnico es directamente desmotivador. El Setup Wizard convierte ese mismo proceso en **10 minutos guiados** que dejan la plataforma operativa.

**Es la "killer demo" para vender el producto a otras administraciones**: "Mira cómo en 10 minutos tu destino está operativo".

### Visión: First-run experience

Cuando un admin entra al CMS por primera vez **y la BBDD está vacía** (detectado automáticamente: 0 recursos + 0 categorías), en vez de ver el Dashboard normal con métricas a 0, ve una pantalla de bienvenida especial:

```
🎉 Bienvenido al CMS

Tu plataforma DTI está vacía. En menos de 10 minutos
podemos dejarla operativa con un catálogo base, páginas
informativas y el menú del portal.

[ Configuración rápida (10 min) ]   [ Empezar desde cero ]
```

Si pulsa "Configuración rápida", arranca el Setup Wizard de **7 pasos**.

### Detalle de los 7 pasos

#### Paso 1 — Sobre tu destino

Datos básicos del destino que se está configurando.

| Campo | Tipo | Detalle |
|---|---|---|
| Nombre del destino | text | Auto-detectado del subdominio o configurable |
| Región / país | text | Galicia, España |
| Logo | file | Subida de imagen (Supabase Storage) |
| Color principal | color picker | Para personalizar el portal |
| Idiomas activos | checkboxes | Por defecto los 5: ES, GL, EN, FR, PT |

Estos datos se guardan en una tabla nueva `destination_config` (single-row) o como key-value en una tabla `settings` existente.

#### Paso 2 — Municipios

- Si la plataforma viene seedeada con municipios (caso O Salnés), muestra "✓ 8 municipios ya configurados" y avanza
- Si está vacía, muestra un formulario para añadirlos en lote (uno por línea con código INE)
- Permite importar desde un CSV oficial del INE

#### Paso 3 — Categorías base (la más interesante)

Ofrece **paquetes predefinidos** según el tipo de destino:

| Paquete | Categorías que crea |
|---|---|
| 🏖️ Turismo costero | Alojamientos, Restauración, Playas, Náutica, Patrimonio marítimo, Festas marineras |
| 🍇 Turismo rural y enológico | Casas rurales, Bodegas, Senderismo, Agroturismo, Gastronomía, Mercados |
| 🏛️ Turismo cultural urbano | Hoteles, Museos, Patrimonio, Eventos, Vida nocturna, Compras |
| 🌳 Turismo de naturaleza | Alojamientos eco, Rutas, Avistamiento de aves, Deportes activos, Parques |
| 🎯 Mixto completo | Todas las anteriores combinadas (~25 categorías) |

**Flujo:**
1. El usuario elige uno o varios paquetes (multi-select de cards visuales)
2. Vista previa del árbol completo que se va a crear
3. Pulsa "Crear estas X categorías"
4. Las categorías se crean en batch en 2 segundos
5. **Las traducciones a los 5 idiomas se generan en paralelo con IA** (Gemini, similar al `aiBatch` que ya existe)
6. Se muestran como completadas en el resumen

**Datos del paquete (estructura):**
```typescript
interface CategoryPackage {
  id: string;
  icon: string;
  name: string;
  description: string;
  categories: Array<{
    slug: string;
    nameEs: string;
    children?: Array<{ slug: string; nameEs: string }>;
  }>;
}
```

#### Paso 4 — Páginas iniciales

Checkboxes con las páginas típicas que toda web turística necesita:

- ☑️ Información práctica (cómo llegar, mejor época, clima…)
- ☑️ Sobre el destino (historia, contexto)
- ☑️ Política de privacidad
- ☑️ Política de cookies
- ☑️ Aviso legal
- ☑️ Contacto

**Para cada página marcada, la IA genera un borrador inicial** basándose en:
- Los datos del paso 1 (nombre del destino, región, idiomas)
- El conocimiento general que la IA tiene del destino
- Plantillas legales reutilizables (privacidad, cookies, aviso legal)

Las páginas se crean en estado **borrador** para que el editor las revise antes de publicar.

**Reutiliza** la Edge Function `ai-writer` que ya existe.

#### Paso 5 — Menú principal del portal

Plantilla preconfigurada del menú típico:

```
Inicio · Qué ver · Qué hacer · Comer · Dormir · Eventos · Información
```

El wizard crea los items del menú **enlazándolos automáticamente** a las categorías y páginas creadas en los pasos 3 y 4. Por ejemplo:
- "Comer" → enlaza a la categoría "Restauración"
- "Dormir" → enlaza a la categoría "Alojamientos"
- "Información" → enlaza a la página "Información práctica"

Vista previa visual del menú real (no abstracta).

**Reutiliza** el endpoint `createNavItem` que ya existe.

#### Paso 6 — Recurso de ejemplo (opcional, killer feature)

> "¿Quieres que creemos un recurso de ejemplo para que veas cómo se ven en la web?"

- El usuario pega una URL pública conocida del destino (ej: la web del Pazo de Fefiñáns, un hotel destacado, una playa)
- **La IA usa el `import-from-url` que ya tenemos** para crear el recurso completo en segundos
- Queda en estado borrador para editarlo

**Reutiliza** la Edge Function `import-from-url` que ya existe.

#### Paso 7 — Resumen final

```
┌─────────────────────────────────────────────────┐
│  🎉 Tu plataforma está lista                    │
│                                                  │
│  Has creado en 8 minutos:                       │
│   ✓ 12 categorías (en 5 idiomas)                │
│   ✓ 6 páginas editoriales (borrador)            │
│   ✓ 7 elementos de menú                         │
│   ✓ 1 recurso de ejemplo                        │
│                                                  │
│  Próximos pasos sugeridos:                      │
│   → Crea tus primeros recursos turísticos       │
│   → Invita a tu equipo desde Usuarios           │
│   → Personaliza el dashboard                    │
│                                                  │
│  [ Empezar a crear contenido ]                  │
└─────────────────────────────────────────────────┘
```

### Lo que tendría que construirse

| Archivo | Descripción | LoC estimadas |
|---|---|---|
| `packages/cms/src/pages/SetupWizardPage.tsx` | Wizard principal — orquestador de los 7 pasos. Reutiliza el motor `Wizard.tsx` ya existente | ~700 |
| `packages/cms/src/data/setup-templates.ts` | Datos de los paquetes de categorías, páginas iniciales, plantillas de menú | ~400 |
| `packages/cms/src/components/SetupDetector.tsx` (hook) | Detecta si la BBDD está "vacía" (0 recursos + 0 categorías) llamando a `/admin/stats`. Si vacía, redirige a `/setup` | ~50 |
| Modificación del `Dashboard` o `Layout` | Si el detector dice "vacío", redirige a `/setup` la primera vez. Botón "Volver al setup" en sidebar | ~30 |
| `supabase/functions/setup-bulk/index.ts` | **Edge Function nueva** que recibe todo el batch (categorías + páginas + menú + traducciones) y los crea en una transacción. Optimiza para evitar latencia de muchas llamadas separadas | ~300 |
| Estilos CSS para wizard de setup, cards de paquetes, vista previa del árbol, resumen final | | ~250 |
| Modificación de `App.tsx` | Ruta `/setup` que renderiza `SetupWizardPage` | ~5 |

**Total estimado**: ~1.700 líneas, 7 archivos.

### Detección de "primera vez"

```typescript
// SetupDetector.tsx
async function isPlatformEmpty(): Promise<boolean> {
  const stats = await api.getStats();
  return (
    stats.resources.total === 0 &&
    stats.categories === 0 &&
    stats.recentChanges.length === 0
  );
}

// En Layout.tsx o un wrapper en App.tsx:
useEffect(() => {
  isPlatformEmpty().then((empty) => {
    if (empty && location.pathname !== '/setup') {
      navigate('/setup');
    }
  });
}, []);
```

### Esquema visual del flujo

```
[Usuario entra al CMS]
        ↓
   [Detector]
        ↓
  ¿BBDD vacía?
   ↙        ↘
  SÍ         NO
   ↓          ↓
[Setup     [Dashboard
 Wizard]    normal]
   ↓
[7 pasos]
   ↓
[Resumen]
   ↓
[Dashboard normal con datos creados]
```

### Por qué dejarla para más adelante

**No tiene valor inmediato para O Salnés** porque la BBDD ya está poblada con 15 recursos, categorías, zonas, etc. El wizard nunca se ejecutaría en producción.

**Su valor real es comercial**: cuando se vaya a presentar la plataforma como producto a otras mancomunidades. En ese momento, este wizard es la **demo killer** que demuestra el valor del producto en segundos.

### Cuándo activarla (triggers)

Construir el Setup Wizard cuando ocurra cualquiera de estas:

1. **Decisión de comercializar** la plataforma a otras administraciones
2. **Solicitud de demo** en una administración nueva donde haya que mostrar la implantación desde cero
3. **Necesidad de resetear** la BBDD para hacer pruebas limpias
4. **Auditoría externa** que requiera demostrar la facilidad de implantación

### Dependencias técnicas que YA están listas

Esta funcionalidad se beneficia de mucho código que ya existe en el proyecto, lo que reduce el esfuerzo real:

- ✅ Motor `Wizard.tsx` reutilizable (creado en C1)
- ✅ Edge Function `ai-writer` para generar contenido de páginas
- ✅ Edge Function `import-from-url` para el recurso de ejemplo
- ✅ Edge Function `ai-batch` para traducir categorías en paralelo
- ✅ API admin con endpoints para crear categorías, páginas, menús
- ✅ Sistema de plantillas (`resource-templates.ts`) como referencia para `setup-templates.ts`
- ✅ Estilos de cards visuales (template selector, navigation wizard)

**Estimación realista de esfuerzo aprovechando lo existente**: 2-3 días de desarrollo concentrado.

---

## 2. App móvil del CMS

> **Estado**: No implementado
> **Prioridad**: Baja
> **Esfuerzo**: Alto

### Visión

App móvil nativa (o PWA) que permite a los técnicos editar recursos desde el móvil cuando están **en el sitio físico**. Casos de uso:

- Estás en el Mirador de A Lanzada → sacas el móvil → creas el recurso con foto in situ + GPS automático
- Estás en un hotel → escaneas un QR del hotel → la IA importa los datos automáticamente
- Estás en un evento → grabas un audio describiendo el evento → la IA transcribe y crea el recurso

### Tecnología

- React Native + Expo (reutiliza React 18.3 del CMS)
- O PWA con Web Share Target API (más sencillo, sin app store)

### Funcionalidades clave

- Captura de fotos directamente desde la cámara
- Geolocalización automática
- **Voice-to-text con IA** para descripciones rápidas
- Modo offline con sincronización al volver a tener red
- Push notifications para revisores

---

## 3. Búsqueda global con Cmd+K

> **Estado**: No implementado
> **Prioridad**: Media
> **Esfuerzo**: Medio

### Visión

Barra de búsqueda tipo Spotlight / Linear / Notion que se abre con Cmd+K (Mac) o Ctrl+K (Windows) desde cualquier pantalla del CMS. Permite buscar:

- Recursos turísticos por nombre
- Categorías
- Páginas editoriales
- Productos
- Acciones rápidas ("Crear nuevo recurso", "Ver pendientes de revisión")
- Comandos del CMS ("Cambiar a modo oscuro", "Cerrar sesión")

### Implementación

- Componente `GlobalSearch.tsx` con modal centrado
- Atajo de teclado global registrado en `Layout.tsx`
- Búsqueda fuzzy (con biblioteca como `fuse.js` o custom)
- Resultados agrupados por categoría
- Navegación con flechas + Enter
- Acciones especiales prefijadas con `>` (estilo VS Code: `>nuevo recurso`)

---

## 4. Notificaciones in-app

> **Estado**: No implementado
> **Prioridad**: Media
> **Esfuerzo**: Medio

### Visión

Sistema de notificaciones dentro del CMS para avisar a los usuarios de eventos relevantes sin necesidad de email:

- "Tu recurso 'X' ha sido publicado por Y"
- "Hay 3 recursos pendientes de revisión"
- "La exportación a PID ha completado con 150 recursos"
- "Error en exportación: 5 recursos sin coordenadas"
- "@usuario te ha mencionado en un comentario"

### Implementación

- Tabla `notifications` en BBDD con `user_id`, `type`, `message`, `read`, `link`
- Polling cada 30s o WebSocket Realtime de Supabase
- Icono de campana en el header del Layout con badge de no leídas
- Panel desplegable con lista
- Endpoint `markAsRead`

---

## 5. Filtros guardados en recursos

> **Estado**: No implementado
> **Prioridad**: Baja
> **Esfuerzo**: Bajo

### Visión

En la página de Recursos, permitir guardar combinaciones de filtros como "vistas":

- "Mis borradores" (status=borrador, created_by=me)
- "Pendientes de revisión" (status=revision)
- "Sin imágenes" (has_media=false)
- "Sin coordenadas" (latitude=null)
- "Modificados esta semana"

Cada vista aparece como un tab encima de la tabla. Cada usuario tiene sus propias vistas.

### Implementación

- Tabla `saved_views` con `user_id`, `name`, `entity_type`, `filters_json`
- Component `SavedViews` en `ResourcesPage`
- Botón "Guardar vista actual" tras aplicar filtros

---

## 6. Modo oscuro completo

> **Estado**: No implementado
> **Prioridad**: Baja
> **Esfuerzo**: Medio (CSS extenso)

### Visión

Modo oscuro real (no solo el sidebar) con las siguientes características:

- Toggle en el footer del sidebar
- Detección automática `prefers-color-scheme: dark`
- Persistencia en localStorage
- Variables CSS duplicadas (`--cms-bg-dark`, `--cms-text-dark`...)
- Transición suave al cambiar

### Implementación

Refactorizar `styles.css` para usar dos sets de variables CSS y un atributo `data-theme="dark"` en `<html>`.

---

## 7. Dashboard personalizable por rol

> **Estado**: No implementado
> **Prioridad**: Media
> **Esfuerzo**: Alto

### Visión

Cada rol ve un dashboard distinto, optimizado para su trabajo:

- **Editor**: Mis borradores, mis recursos modificados esta semana, sugerencias de mejora
- **Validador**: Cola de revisión, recursos pendientes ordenados por prioridad
- **Técnico**: Estado del sistema, exportaciones recientes, errores
- **Admin**: Vista global con todo
- **Analítica**: Solo gráficos y métricas

### Implementación

- Componente `DashboardWidget` reutilizable
- Función `getWidgetsForRole(role)` que devuelve la composición
- Posibilidad de drag & drop para reordenar (con `react-grid-layout`)

---

## 8. Empty states + confirmaciones bonitas

> **Estado**: No implementado
> **Prioridad**: Baja
> **Esfuerzo**: Bajo

### Visión

Cuando una lista está vacía (productos, exportaciones, recursos…), en lugar de mostrar texto plano "Sin elementos", mostrar un empty state amistoso:

```
┌────────────────────────────────────┐
│                                    │
│           [icono grande]           │
│                                    │
│      Aún no hay productos          │
│  Los productos turísticos son      │
│  agrupaciones temáticas como       │
│  rutas o experiencias.             │
│                                    │
│      [+ Crear el primero]          │
│                                    │
└────────────────────────────────────┘
```

Reemplazar también todos los `confirm()` y `alert()` nativos por modales custom coherentes con el diseño del CMS.

### Implementación

- Componente `EmptyState.tsx` reutilizable
- Componente `ConfirmDialog.tsx` con hook `useConfirm()`
- Reemplazar progresivamente en todas las páginas

---

## 9. Tour de bienvenida segmentado por rol

> **Estado**: No implementado (existe el tour general)
> **Prioridad**: Baja
> **Esfuerzo**: Bajo

### Visión

Mejora del `OnboardingTour` que ya existe (creado en C3 del plan original). En lugar de un tour único de 6 pasos para todos, mostrar un tour específico según el rol del usuario:

- **Editor**: Tour de creación de recursos (8 pasos enfocados en wizards y AI)
- **Validador**: Tour de cola de revisión y publicación
- **Técnico**: Tour de exportaciones, audit log y backups
- **Admin**: Tour completo + gestión de usuarios

### Implementación

- Refactorizar `OnboardingTour.tsx` para aceptar diferentes arrays de pasos
- Crear constantes `TOUR_STEPS_EDITOR`, `TOUR_STEPS_VALIDADOR`, etc.
- Detectar el rol via `useAuth()` y elegir el tour correspondiente

---

## Plantilla para añadir nuevas ideas

```markdown
## N. [Título de la idea]

> **Estado**: No implementado
> **Prioridad**: [Alta / Media / Baja]
> **Esfuerzo**: [Alto / Medio / Bajo] — [estimación si la tienes]
> **Documentado el**: [fecha]

### Contexto y motivación
[Por qué hace falta esto, qué problema resuelve]

### Visión
[Cómo debería funcionar para el usuario final]

### Implementación
[Detalles técnicos: archivos, endpoints, dependencias]

### Cuándo construirlo
[Triggers que activarían la decisión de hacerlo]
```

---

**Última actualización**: 8 de abril de 2026
**Mantenido por**: Antonio Samper + asistente IA
