# Guía de diseño Fiori (Companion App)

Documento de referencia para **replicar la estética, composición y patrones de UX tipo SAP Fiori Horizon / Quartz Light** desarrollados en este proyecto. Incluye tokens CSS, tipografía, iconos, estructura de shell, componentes reutilizables y convenciones de accesibilidad.

**Tema por defecto de la aplicación:** Fiori (`appearance` distinto de `microsoft` → Fiori). Ver [`frontend/src/lib/appearance-cookie.ts`](../frontend/src/lib/appearance-cookie.ts).

---

## 1. Dos niveles de “tema”

| Mecanismo | Dónde | Qué controla |
|-----------|--------|--------------|
| `html[data-appearance="fiori"]` | [`frontend/src/app/(main)/layout.tsx`](../frontend/src/app/(main)/layout.tsx) | **Tokens de color Fiori Horizon** (sobrescribe variables en [`tokens-fiori.css`](../frontend/src/styles/tokens-fiori.css)). |
| `[data-theme="fiori"]` en el shell | [`AppShell`](../frontend/src/components/AppShell/AppShell.tsx) (`data-theme={theme}`) | **Layout y componentes** que bifurcan estilos con `:global([data-theme="fiori"])` (tabs horizontales, footer oscuro, tabla KPI, etc.). |

Convención: el **layout principal** fuerza `data-appearance` en `<html>`; el **contenedor raíz** de la UI autenticada usa `data-theme` en el mismo valor efectivo (`microsoft` | `fiori`).

---

## 2. Tokens de diseño (CSS)

### 2.1 Archivos

- [`frontend/src/styles/tokens.css`](../frontend/src/styles/tokens.css): valores base (estilo Fiori “clásico”, azul shell `#0a6ed1`).
- [`frontend/src/styles/tokens-fiori.css`](../frontend/src/styles/tokens-fiori.css): **Horizon / Morning** cuando `html[data-appearance='fiori']` (shell oscuro `#1d2d3e`, acentos `#0064d9`, fondos `#f5f6f7`).
- [`frontend/src/styles/global.css`](../frontend/src/styles/global.css): reset, `html`/`body`, enlaces, utilidad `.sr-only`; importa ambos tokens.

### 2.2 Variables principales (resumen)

**Marca / shell**

- `--fiori-shell-bg`, `--fiori-shell-text`, `--fiori-shell-hover`

**Navegación (lateral legacy + tabs)**

- `--fiori-nav-bg`, `--fiori-nav-item-hover`, `--fiori-nav-item-active-bg`
- `--fiori-nav-item-active-border` (barra vertical activa o acento)
- `--fiori-nav-text`, `--fiori-nav-text-active`

**Contenido**

- `--fiori-content-bg` (fondo página)
- `--fiori-surface` (tarjetas, modales)
- `--fiori-border`, `--fiori-border-light`

**Tipografía**

- `--fiori-font-family` (stack con `'72'`, `'72full'`, `'SAP-icons'`, system UI)
- `--fiori-text`, `--fiori-text-secondary`, `--fiori-text-inverse`
- `--fiori-link`, `--fiori-link-hover`

**Semántica**

- Éxito: `--fiori-success`, `--fiori-success-bg`
- Error: `--fiori-error`, `--fiori-error-bg`
- Aviso: `--fiori-warning`, `--fiori-warning-bg`
- Información: `--fiori-information`, `--fiori-information-bg`

**Espaciado (base 4px)**

- `--fiori-space-1` … `--fiori-space-8` (definidos en tokens)

**Layout**

- `--fiori-shell-height` (3rem): altura cabecera fija
- `--fiori-nav-width` (15rem): ancho nav lateral (cuando aplica)
- `--fiori-drawer-width` (28rem): drawer lateral

**Sombras**

- `--fiori-shadow-1`, `--fiori-shadow-2`

### 2.3 Notas para quien porte el sistema

- En varios módulos se usa **`var(--fiori-space-10)`** y **`var(--fiori-background)`** sin estar definidos en los ficheros de tokens actuales; al migrar, conviene **añadir** `--fiori-space-10` (p. ej. `2.5rem`) y `--fiori-background` (p. ej. mismo valor que `--fiori-nav-bg` o gris muy claro) en `:root` / `html[data-appearance='fiori']` para evitar estilos rotos en pies de diálogo y editores.

---

## 3. Tipografía SAP 72

### 3.1 Carga de fuentes

[`frontend/src/styles/fonts-fiori.css`](../frontend/src/styles/fonts-fiori.css) define `@font-face` para:

- `72`, `72full`, `72Black`, `72Blackfull`, `72-Bold`, `72-Boldfull`  
  vía CDN `@sap-theming/theming-base-content` (jsDelivr).

### 3.2 Jerarquía usada en la UI

| Uso | Patrón |
|-----|--------|
| Título zona (barra “dónde estás”) | `font-family: "72Black"…`, ~`1.5rem`, color `--fiori-text` — [`AppShell.module.css`](../frontend/src/components/AppShell/AppShell.module.css) `.pageHeaderTitle` |
| H1 en bloque hero de página | `72Black`, `1.375rem`, peso 700 — [`page-hero.module.css`](../frontend/src/components/page-hero/page-hero.module.css) `.h1` |
| Subtítulo | `0.9375rem`, `--fiori-text-secondary`, line-height ~1.45 |
| Tabs horizontales | `72-Bold` / `72-Boldfull`, peso 700, borde inferior 2px activo — `.tabLink` |
| Cuerpo global | `font-size: 14px` en `html`, `line-height: 1.5` — [`global.css`](../frontend/src/styles/global.css) |

---

## 4. Iconos SAP (Fiori)

### 4.1 Fuente y clases

[`frontend/src/styles/icons-fiori.css`](../frontend/src/styles/icons-fiori.css):

- Fuente **SAP-icons** (OpenUI5 / ui5.sap.com).
- Fuente **SAP-icons-TNT** para iconos TNT (p. ej. intranet).
- Bajo `[data-theme="fiori"]`: clases `.sap-icon`, `.sap-icon--…` con `::before { content: "\eXXX" }`.

### 4.2 Componente React

[`frontend/src/components/Icon/Icon.tsx`](../frontend/src/components/Icon/Icon.tsx):

- Nombres semánticos (`home`, `activations`, `link`, `table`, KPIs, etc.).
- En Fiori, muchos iconos se renderizan como **clases SAP**; en Microsoft (Fluent) algunos pasan a **SVG inline** — el componente centraliza esa lógica.
- Tamaño por defecto distinto según tema (vía `useTheme()`).

### 4.3 Busy indicator (UI5 Web Components)

El layout principal importa `@ui5/webcomponents/dist/BusyIndicator.js` para coherencia con ecosistema SAP en pantallas de carga (junto con spinners CSS propios en [`LoadingScreen`](../frontend/src/components/LoadingScreen/LoadingScreen.module.css)).

---

## 5. Estructura de página (shell Fiori)

### 5.1 Cabecera fija (shell bar)

- Altura `--fiori-shell-height`, fondo `--fiori-shell-bg`, texto claro.
- Logo + nombre de app; zona derecha: acciones y **menú avatar** (popover con sombra, hover azul en Fiori).

**Botón en cabecera (Fiori):** estilo **ghost / outlined**, borde azul `#0064d9`, **border-radius tipo píldora** (`9999px`), hover con fondo azul muy suave — ver `.headerButton` con `:global([data-theme="fiori"])`.

### 5.2 Cuerpo sin nav lateral en Fiori

En Fiori, `.body` pasa a **columna**: no hay sidebar; el scroll vertical es el del `.body`; fondo contenido `#f5f6f7`.

### 5.3 Barra de contexto + tabs

1. **Page header** (`.pageHeader`): fondo blanco, título de sección (p. ej. “Activaciones”, “Análisis RFQs”).
2. **Tabs horizontales** (`.tabsNavWrap` + `.tabsNav`):
   - `position: sticky; top: 0` respecto al área de contenido, debajo del header fijo.
   - Scroll horizontal con **degradados** en los bordes (`.tabsNavWrap::before/::after`) para indicar más pestañas.
   - Tab activa: texto `--fiori-nav-text-active`, **borde inferior 2px** del mismo color.

### 5.4 Área main

- `max-width: 90rem`, centrado, padding generoso (`--fiori-space-6` / `--fiori-space-8` abajo).
- En Fiori el `main` puede crecer con el contenido; el footer queda al final vía flex en `.mainFooterWrap`.

### 5.5 Footer

[`Footer.module.css`](../frontend/src/components/Footer/Footer.module.css): en Fiori, fondo oscuro `#1c2d3e`, borde superior sutil, texto copyright claro.

---

## 6. Patrones de contenido

### 6.1 Hero de página (título + acciones)

[`PageHero`](../frontend/src/components/page-hero/PageHero.tsx) + [`page-hero.module.css`](../frontend/src/components/page-hero/page-hero.module.css):

- Tarjeta blanca con borde ligero, **sombra muy sutil**, **barra vertical acento** a la izquierda (`::before`, color `--fiori-shell-bg`).
- Título + subtítulo + zona `actions` alineada a la derecha en desktop.

**Migas / volver:** `PageBackLink` + `ChevronBackIcon`; enlaces con `--fiori-link`.

### 6.2 Tablas de datos

[`DataTable.module.css`](../frontend/src/components/DataTable/DataTable.module.css):

- Contenedor con superficie blanca, borde, sombra token.
- Cabeceras: fondo `--fiori-nav-bg`, texto secundario; en Fiori: **mayúsculas**, `letter-spacing`.
- Filas: hover `--fiori-nav-item-hover`; enlaces con color link.

### 6.3 Barra de filtros

[`FilterBar.module.css`](../frontend/src/components/FilterBar/FilterBar.module.css):

- Labels en tono secundario, campos con borde `--fiori-border`, `border-radius` 0.25rem.
- **Móvil:** filtros colapsados con botón “mostrar”; **desktop:** fila horizontal con alineación inferior.

### 6.4 Tarjetas KPI (dashboard)

[`KpiCard.module.css`](../frontend/src/components/KpiCard/KpiCard.module.css):

- En Fiori: **aspect-ratio 1:1**, layout vertical: título arriba, bloque central icono SAP + valor grande, subtítulo abajo.
- Iconos SAP en color unificado (`#0164d9`), hover con elevación y ligero `translateY`.
- Variantes semánticas comparten **mismo acento de borde** en Fiori (`#1c2d3e`), frente a colores por variante en Microsoft.

### 6.5 Diálogos (confirmación / info)

[`ConfirmDialog.module.css`](../frontend/src/components/ConfirmDialog/ConfirmDialog.module.css), [`InfoDialog.module.css`](../frontend/src/components/InfoDialog/InfoDialog.module.css):

- Overlay semitransparente + `backdrop-filter`.
- Diálogo: `--fiori-surface`, radio ~0.75rem, sombra profunda.
- **Acciones:** cancelar = superficie + borde; confirmar = relleno `--fiori-shell-bg` y texto inverso; variante peligro con rojo mezclado.

Patrón UX: no usar `window.confirm`; usar estos componentes (coherente con reglas del proyecto).

### 6.6 Tags de estado

[`StatusTag.module.css`](../frontend/src/components/StatusTag/StatusTag.module.css):

- Chips pequeños con fondos semánticos (borrador, enviado, error, cola, procesando, etc.) alineados con tokens de aviso/éxito/error.

### 6.7 App Launcher (mosaicos)

[`launcher.module.css`](../frontend/src/app/(main)/launcher/launcher.module.css):

- Grid responsive (1 → 2 → 4 columnas).
- **Tile:** superficie blanca, borde, `border-radius` ~0.625rem, **acento superior** `border-top: 3px solid var(--fiori-shell-bg)`.
- Hover: sombra + `translateY` (respetando `prefers-reduced-motion`).
- Estado **bloqueado:** borde discontinuo, opacidad, CTA deshabilitado con enlace a perfil para credenciales.

**Banner de bienvenida:** imagen full-width, overlay oscuro con gradiente; CTAs primario/secundario con contraste alto.

---

## 7. Botones (resumen de estilos)

| Contexto | Estilo |
|----------|--------|
| Cabecera Fiori (ghost) | Borde azul, texto azul, píldora, hover fondo azul 6% |
| Banner launcher primario | Fondo `--fiori-shell-bg`, texto blanco, sombra, hover brillo + ligera elevación |
| Banner secundario | Blanco sobre overlay |
| Diálogo primario | Fondo shell, texto blanco, min-height ~2.25rem |
| Diálogo secundario | Blanco, borde `--fiori-border-light` |

---

## 8. Formularios e inputs

- Altura táctil mínima en filtros móviles (~2.75rem) donde aplica.
- Focus: en diálogos, `outline` 2px `--fiori-shell-bg` + offset.
- Selects/inputs alineados con bordes token y radios pequeños (Fiori Horizon suele preferir **0.25rem–0.375rem** según componente).

---

## 9. Listas

- Listas en contenido: tipografía y color de cuerpo; en **Rich Text** hay iconos propios para lista numerada/bullet (ver `Icon` y [`RichTextEditor.module.css`](../frontend/src/components/RichTextEditor/RichTextEditor.module.css)).
- Listas de navegación: tabs o nav lateral con estado activo claro (borde o fondo).

---

## 10. Accesibilidad y motion

- Utilidad **`.sr-only`** en [`global.css`](../frontend/src/styles/global.css) para texto solo lector de pantalla.
- Diálogos: `role="alertdialog"`, foco y overlay clicable.
- Animaciones en modales y skeletons; muchos bloques respetan **`prefers-reduced-motion`** (ej. [`ConfirmDialog`](../frontend/src/components/ConfirmDialog/ConfirmDialog.module.css), launcher).

---

## 11. Checklist para llevar esto a otro proyecto

1. Copiar/importar **`tokens.css`**, **`tokens-fiori.css`**, **`global.css`** (o fusionar en tu sistema de tokens).
2. Añadir **`fonts-fiori.css`** e **`icons-fiori.css`** (o equivalente con fuentes locales si no quieres CDN).
3. En el layout raíz, establecer **`document.documentElement.setAttribute('data-appearance', 'fiori')`** cuando corresponda.
4. Envolver la app en un contenedor con **`data-theme="fiori"`** para activar reglas `:global([data-theme="fiori"])`.
5. Definir **tokens faltantes** (`--fiori-space-10`, `--fiori-background`) si reutilizas componentes que los referencian.
6. Reproducir **shell**: header fijo + área scroll + tabs sticky + main acotado a `90rem`.
7. Usar **PageHero** + **DataTable** + **FilterBar** + **ConfirmDialog** como piezas base antes de crear vistas nuevas.

---

## 12. Índice de archivos clave

| Área | Archivos |
|------|----------|
| Tokens | [`tokens.css`](../frontend/src/styles/tokens.css), [`tokens-fiori.css`](../frontend/src/styles/tokens-fiori.css), [`global.css`](../frontend/src/styles/global.css) |
| Fuentes / iconos | [`fonts-fiori.css`](../frontend/src/styles/fonts-fiori.css), [`icons-fiori.css`](../frontend/src/styles/icons-fiori.css) |
| Shell | [`AppShell.tsx`](../frontend/src/components/AppShell/AppShell.tsx), [`AppShell.module.css`](../frontend/src/components/AppShell/AppShell.module.css) |
| Hero / migas | [`PageHero.tsx`](../frontend/src/components/page-hero/PageHero.tsx), [`page-hero.module.css`](../frontend/src/components/page-hero/page-hero.module.css) |
| Tablas / filtros / KPI | [`DataTable.module.css`](../frontend/src/components/DataTable/DataTable.module.css), [`FilterBar.module.css`](../frontend/src/components/FilterBar/FilterBar.module.css), [`KpiCard.module.css`](../frontend/src/components/KpiCard/KpiCard.module.css) |
| Diálogos | [`ConfirmDialog`](../frontend/src/components/ConfirmDialog/), [`InfoDialog`](../frontend/src/components/InfoDialog/) |
| Launcher | [`launcher.module.css`](../frontend/src/app/(main)/launcher/launcher.module.css) |
| Tema JS | [`appearance-cookie.ts`](../frontend/src/lib/appearance-cookie.ts), [`ThemeContext.tsx`](../frontend/src/contexts/ThemeContext.tsx) |

---

*Última referencia al código del repositorio Avvale Companion App. Ajusta valores de marca (logos, URLs CDN) según política del nuevo proyecto.*
