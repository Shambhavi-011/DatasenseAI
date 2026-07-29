/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        ds_bg: "#0b1020",
        ds_card: "#111827",
        ds_accent: "#22c55e",
        ds_accent_soft: "#14532d",
      },
    },
  },
  plugins: [],
};