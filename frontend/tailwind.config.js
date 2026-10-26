/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Instrument panel tokens
        bg: '#0a0b0d',
        surface: '#101216',
        elevated: '#151820',
        border: '#1f232b',
        text: '#e8eaed',
        muted: '#8b929c',
        accent: '#38bdf8', // cyan
        recommended: '#34d399',
        minimum: '#fbbf24',
        'not-recommended': '#f87171',

        // Backward-compatible aliases
        'bg-primary': '#0a0b0d',
        'bg-card': '#101216',
        'bg-hover': '#151820',
        'border-dark': '#1f232b',
        'text-primary': '#e8eaed',
        'text-secondary': '#8b929c',
        'accent-blue': '#38bdf8',
        'accent-green': '#34d399',
        'accent-amber': '#fbbf24',
        'accent-red': '#f87171',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
