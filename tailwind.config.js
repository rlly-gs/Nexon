/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter Variable", "Inter", "ui-sans-serif", "system-ui", "Segoe UI", "sans-serif"],
      },
      // Theme colors: CSS variables swapped at runtime (see src/theme.ts).
      colors: {
        canvas: token("canvas"),
        panel: token("panel"),
        "panel-2": token("panel-2"),
        line: token("line"),
        fg: token("fg"),
        muted: token("muted"),
        subtle: token("subtle"),
        accent: {
          DEFAULT: token("accent"),
          hover: token("accent-hover"),
          text: token("accent-text"),
          on: token("on-accent"),
        },
      },
      keyframes: {
        "fade-in": { from: { opacity: "0", transform: "scale(.98)" } },
        "slide-in": { from: { opacity: "0", transform: "translateX(24px)" } },
        "bg-in": { from: { opacity: "0" } },
        rise: { from: { opacity: "0", transform: "translateY(8px)" } },
      },
      animation: {
        "fade-in": "fade-in .18s ease-out",
        "slide-in": "slide-in .22s ease-out",
        "bg-in": "bg-in .45s ease",
        rise: "rise .18s ease-out",
      },
    },
  },
  plugins: [],
};
