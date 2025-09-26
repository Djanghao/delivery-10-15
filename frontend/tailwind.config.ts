import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(214.3 31.8% 91.4%)",
        background: "#ffffff",
        foreground: "#0f1419",
        muted: "#f7f9f9",
      },
      borderRadius: {
        lg: "1rem",
      },
    },
  },
  plugins: [],
};

export default config;
