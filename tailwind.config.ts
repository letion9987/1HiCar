import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#07C160",
        accent: "#FF9800",
        secondary: "#ec5b13",
        wechatGreen: "#07C160",
        // stitch/_13 uses #F7F7F7 while some sheets use #f8f6f6
        backgroundLight: "#F7F7F7",
        backgroundLightAlt: "#f8f6f6",
        backgroundDark: "#221610",
      },
      fontFamily: {
        display: ["Public Sans", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
        full: "9999px",
      },
      boxShadow: {
        iosCard: "0 4px 20px rgba(0, 0, 0, 0.05)",
        bottomBar: "0 -4px 20px rgba(0,0,0,0.05)",
        sheetUp: "0 -8px 30px rgba(0,0,0,0.12)",
      },
    },
  },
  plugins: [],
} satisfies Config;

