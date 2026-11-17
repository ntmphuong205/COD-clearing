import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: { colors: { brand: { DEFAULT: "#e84142", dark: "#c92f30" } } } },
  plugins: [],
} satisfies Config;
