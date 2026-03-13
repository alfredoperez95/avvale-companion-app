# Prototipo SAP Fiori Launchpad

Prototipo en HTML y CSS vanilla que refleja la estética base de SAP Fiori (Horizon / Quartz Light) para verificación visual.

## Verificación manual

1. Con el frontend en marcha (`npm run dev`), abre en el navegador:
   - **http://localhost:3000/fiori-launchpad-prototype/**
   - o **http://localhost:3000/fiori-launchpad-prototype/index.html**

2. Comprueba:
   - **Shell Header**: barra superior oscura (#1d2d3e), logo, búsqueda, avatar.
   - **Tiles**: tarjetas con sombra suave, bordes redondeados, hover con elevación sutil.
   - **Variables CSS** en `styles.css` (`:root`) para reutilizar la paleta en otros componentes.

## Uso de las variables en el proyecto

Las variables definidas en `styles.css` (prefijo `--fiori-h-*`) son la referencia. La app Next.js usa `src/styles/tokens-fiori.css`, que aplica variables equivalentes cuando el usuario elige "Fiori Like" en Mi perfil (`html[data-appearance="fiori"]`).
