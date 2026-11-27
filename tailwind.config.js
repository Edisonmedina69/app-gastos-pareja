/** @type {import('tailwindcss').Config} */
const token = (nombre) => `oklch(var(--${nombre}) / <alpha-value>)`;

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // Tokens semánticos (valores en src/index.css). Los colores de Tailwind
      // (slate, indigo…) siguen disponibles para las pantallas aún no migradas.
      colors: {
        background: token("background"),
        foreground: token("foreground"),
        card: { DEFAULT: token("card"), foreground: token("card-foreground") },
        popover: { DEFAULT: token("popover"), foreground: token("popover-foreground") },
        primary: { DEFAULT: token("primary"), foreground: token("primary-foreground") },
        secondary: { DEFAULT: token("secondary"), foreground: token("secondary-foreground") },
        muted: { DEFAULT: token("muted"), foreground: token("muted-foreground") },
        accent: { DEFAULT: token("accent"), foreground: token("accent-foreground") },
        success: { DEFAULT: token("success"), foreground: token("success-foreground") },
        warning: { DEFAULT: token("warning"), foreground: token("warning-foreground") },
        destructive: { DEFAULT: token("destructive"), foreground: token("destructive-foreground") },
        border: token("border"),
        input: token("input"),
        ring: token("ring"),
      },
      borderRadius: {
        sm: "calc(var(--radius) - 6px)",
        md: "calc(var(--radius) - 4px)",
        lg: "var(--radius)",
        xl: "calc(var(--radius) + 4px)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "Avenir", "Helvetica", "Arial", "sans-serif"],
      },
      // Escala tipográfica Major Third (1.250) sobre 16 px.
      fontSize: {
        micro: ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.06em" }], // 11 px, etiquetas
        "title-sm": ["1.25rem", { lineHeight: "1.75rem", letterSpacing: "-0.01em" }], // 20
        "title-md": ["1.5625rem", { lineHeight: "2rem", letterSpacing: "-0.015em" }], // 25
        "title-lg": ["1.953rem", { lineHeight: "2.25rem", letterSpacing: "-0.02em" }], // 31
      },
      minHeight: { touch: "2.75rem" },
      minWidth: { touch: "2.75rem" },
      height: { touch: "2.75rem" },
      width: { touch: "2.75rem" },
      spacing: { "safe-b": "env(safe-area-inset-bottom)" },
      backdropBlur: { xs: "2px" },
    },
  },
  plugins: [],
};
