/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        // MDC brand palette (see MDC_colourPalette.png) - light to dark blue, plus white
        mdc: {
          50: '#FCFEFF',
          100: '#F9FCFF',
          200: '#E7F1FF',
          300: '#D0E3FF',
          500: '#7096D1',
          700: '#334EAC',
          900: '#081F5C',
        },
      },
    },
  },
  plugins: [],
}