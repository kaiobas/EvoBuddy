/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#F3F0FF",
          100: "#EEE9FF",
          200: "#D9D0FF",
          300: "#B8ABFF",
          400: "#9B8FE8",
          500: "#7C6FCD",
          600: "#6355B8",
          700: "#4E42A0",
          800: "#3B3082",
          900: "#2A2165",
        },
        peach: {
          50:  "#FEF0EB",
          100: "#FDDDD1",
          200: "#FBBBA3",
          300: "#F89A7A",
          500: "#F4845F",
          600: "#E06B47",
          700: "#C45539",
        },
        ink: "#1E1B2E",
        "surface-dark": "#16131F",
        "card-dark":    "#201C2E",
        "border-dark":  "#2E2840",
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
        sans:    ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
