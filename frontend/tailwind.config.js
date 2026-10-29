/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        'surface-2': 'var(--color-surface-2)',
        line: 'var(--color-line)',
        text: 'var(--color-text)',
        muted: 'var(--color-muted)',
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          soft: 'var(--color-primary-soft)',
        },
        accent: 'var(--color-accent)',
        success: {
          DEFAULT: 'var(--color-success)',
          soft: 'var(--color-success-soft)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          soft: 'var(--color-warning-soft)',
        },
        danger: {
          DEFAULT: 'var(--color-danger)',
          soft: 'var(--color-danger-soft)',
        },

        // Semantic compatibility aliases
        border: 'var(--color-line)',
        elevated: 'var(--color-surface-2)',
        recommended: 'var(--color-success)',
        minimum: 'var(--color-warning)',
        'not-recommended': 'var(--color-danger)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        card: '16px',
        btn: '12px',
        pill: '999px',
      },
      boxShadow: {
        soft: '0 2px 10px rgba(15, 18, 38, 0.04), 0 1px 3px rgba(15, 18, 38, 0.06)',
        card: '0 4px 20px -2px rgba(15, 18, 38, 0.06), 0 2px 6px -1px rgba(15, 18, 38, 0.04)',
        hover: '0 10px 30px -4px rgba(15, 18, 38, 0.1), 0 4px 10px -2px rgba(15, 18, 38, 0.04)',
      },
      maxWidth: {
        content: '1200px',
      },
    },
  },
  plugins: [],
}
