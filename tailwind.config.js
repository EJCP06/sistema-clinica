/**
 * Configuración de Tailwind CSS.
 *
 * - darkMode: 'class' -> el tema oscuro se activa/desactiva con la clase
 *   'dark' en <html>, gestionada por ThemeService (core/services/theme.service.ts).
 * - content: escanea plantillas HTML y TypeScript de src/ para generar solo
 *   las clases utilitarias realmente usadas.
 * - theme/plugins: se dejan vacíos a propósito; el diseño usa solo las
 *   clases utilitarias de Tailwind.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
