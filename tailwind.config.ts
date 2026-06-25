import forms from "@tailwindcss/forms";
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#ecfdf3",
          100: "#d1fae2",
          600: "#138a4d",
          700: "#0f6b3d",
          900: "#064025"
        },
        ink: "#17201c"
      },
      boxShadow: {
        soft: "0 14px 40px rgba(15, 23, 42, 0.08)"
      }
    },
  },
  plugins: [forms],
};

export default config;
