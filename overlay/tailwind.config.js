export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'accent-blue':  '#3a6aaa',
        'accent-green': '#3cb080',
        'accent-amber': '#e0a040',
        'accent-red':   '#d06050',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Consolas', 'Monaco', 'monospace'],
      },
    },
  },
  plugins: [],
}
