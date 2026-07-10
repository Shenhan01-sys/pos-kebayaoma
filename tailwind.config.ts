import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        beige: "#F2F5E2",
        custard: "#E3DEA4",
        apricot: "#D4954D",
        olive: "#775533",
        violet: "#290024",
        // Monotonic brand scale (light -> dark) built from the palette
        brand: {
          50: "#F2F5E2", // Beige
          100: "#E9E6BF",
          200: "#E3DEA4", // Vanilla Custard
          300: "#D4954D", // Golden Apricot
          400: "#c5853f",
          500: "#a8702f",
          600: "#8a5a36",
          700: "#775533", // Olive Wood
          800: "#4a0e3f",
          900: "#290024", // Midnight Violet
        },
        ink: "#3a1430",
        success: "#2f9e57",
        warning: "#d98a2b",
        danger: "#d6455b",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "Inter",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        // Soft, diffused iOS-style elevation
        soft: "0 1px 2px rgba(41,0,36,0.04), 0 8px 24px -8px rgba(41,0,36,0.12)",
        "soft-lg": "0 2px 4px rgba(41,0,36,0.05), 0 18px 40px -12px rgba(41,0,36,0.22)",
        "soft-xl": "0 4px 8px rgba(41,0,36,0.06), 0 30px 60px -16px rgba(41,0,36,0.28)",
        glow: "0 8px 24px -6px rgba(212,149,77,0.55)",
        "glow-violet": "0 10px 30px -8px rgba(74,14,63,0.55)",
        inset: "inset 0 1px 3px rgba(41,0,36,0.10)",
      },
      backgroundImage: {
        // Palette is SOLID — these aliases keep the markup stable but render flat brand colors.
        "grad-cta": "#D4954D",
        "grad-violet": "#290024",
        "grad-plum": "#4a0e3f",
        "grad-apricot": "#D4954D",
        "grad-olive": "#775533",
        "grad-success": "#2f9e57",
        "grad-hero": "#290024",
        "grad-page": "#F2F5E2",
      },
    },
  },
  plugins: [],
};

export default config;
