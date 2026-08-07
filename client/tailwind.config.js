/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Defaulting to dark mode, controllable via class
  theme: {
    extend: {
      colors: {
        darkBg: '#0f0f13',
        darkCard: 'rgba(23, 23, 33, 0.7)',
        accentCyan: '#06b6d4',
        accentBlue: '#3b82f6',
        accentPurple: '#8b5cf6',
        accentPink: '#ec4899',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
