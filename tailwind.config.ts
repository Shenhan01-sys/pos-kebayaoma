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
        // Semantic brand scale built from the palette above
        brand: {
          50: "#F2F5E2", // Beige
          100: "#E3DEA4", // Vanilla Custard
          200: "#D4954D", // Golden Apricot
          300: "#c5853f",
          400: "#a8702f",
          500: "#8a5a36",
          600: "#775533", // Olive Wood
          700: "#5e4329",
          800: "#461f1d",
          900: "#290024", // Midnight Violet
        },
        ink: "#290024",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
