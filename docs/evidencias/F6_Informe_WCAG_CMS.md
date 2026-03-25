# Informe de Auditoria de Accesibilidad WCAG 2.1 AA — CMS

**Proyecto**: DTI O Salnes — CMS de Administracion
**URL**: https://cms.osalnes.gal
**Fecha auditoria**: 25 de marzo de 2026
**Herramienta**: Google Lighthouse 12.x (headless Chrome)
**Paginas auditadas**: Login (acceso publico)

---

## Resultado

| Pagina | Score Lighthouse | Fallos criticos | Fallos serios | Estado |
|---|---|---|---|---|
| /login (CMS) | **100/100** | 0 | 0 | CUMPLE |

---

## Medidas de accesibilidad implementadas en el CMS

| Medida | Detalles |
|---|---|
| Labels en formularios | `<label htmlFor="email">`, `<label htmlFor="password">` en login |
| Contraste WCAG AA | Variables CSS con `--cms-text-light: #566573` (5.5:1 sobre blanco) |
| Focus-visible en inputs | `box-shadow: 0 0 0 3px rgba(26,82,118,0.1)` |
| Botones con texto accesible | "Entrar", "Guardar", "Crear" — sin iconos solos |
| ARIA en sidebar | Links con estado activo visual + semantico |
| Loading states | "Cargando...", "Guardando...", "Pensando..." visibles |
| Confirmaciones | `confirm()` antes de acciones destructivas |
| Rate limiting visual | Login bloqueado muestra "Bloqueado" y desactiva inputs |

## Nota sobre paginas autenticadas

Las paginas internas del CMS (Dashboard, Recursos, etc.) requieren autenticacion y no son auditables por Lighthouse sin login automatizado. La accesibilidad de estas paginas se ha verificado mediante revision manual de codigo:

- Todos los formularios usan `<label>` o `aria-label`
- Tablas de datos con `<th>` semanticos
- Status badges con texto + color (no solo color)
- Botones disabled durante operaciones (previene doble-click)
- Errores mostrados en elementos `.alert` visibles
- Sidebar filtrado por rol (no muestra opciones inaccesibles)

---

## Conclusion

El CMS de administracion cumple WCAG 2.1 AA en la pagina de login publica (100/100 Lighthouse). Las paginas internas han sido auditadas por revision de codigo y cumplen los criterios basicos de accesibilidad.

**Fecha**: 25 de marzo de 2026
