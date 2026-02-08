import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        midnight: {
          50: "#f0f1fe",
          100: "#dde0fc",
          200: "#c2c6fa",
          300: "#989ef6",
          400: "#6b6ef0",
          500: "#4d4ae9",
          600: "#3d2ede",
          700: "#3422c3",
          800: "#2c1e9f",
          900: "#271d7f",
          950: "#17104a",
        },
        echo: {
          bg: "#0a0b14",
          surface: "#12131f",
          border: "#1e2035",
          muted: "#8b8fa3",
          accent: "#6366f1",
          success: "#22c55e",
          warning: "#f59e0b",
          danger: "#ef4444",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
