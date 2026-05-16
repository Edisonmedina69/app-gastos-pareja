/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#646cff",
        secondary: "#28a745",
        danger: "#ff6b6b",
        glass: "rgba(255, 255, 255, 0.05)",
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
