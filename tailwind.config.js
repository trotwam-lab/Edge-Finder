/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef9ff",
          100: "#d8f1ff",
          200: "#bae7ff",
          300: "#8adaff",
          400: "#53c3ff",
          500: "#2ba3ff",
          600: "#1484f5",
          700: "#0d6ce1",
          800: "#1157b6",
          900: "#144b8f",
          950: "#112e57",
        },
        edge: {
          hot: "#ef4444",
          warm: "#f59e0b",
          mild: "#22c55e",
          cold: "#6b7280",
        },
        profit: "#22c55e",
        loss: "#ef4444",
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "slide-in": "slide-in 0.3s ease-out",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 5px rgba(43, 163, 255, 0.3)" },
          "50%": { boxShadow: "0 0 20px rgba(43, 163, 255, 0.6)" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateY(-10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
