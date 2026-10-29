import { create } from 'zustand'

export const useThemeStore = create((set) => {
  const getInitialTheme = () => {
    if (typeof window === 'undefined') return 'light'
    const saved = localStorage.getItem('llmbench_theme')
    if (saved === 'dark' || saved === 'light') return saved
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark'
    }
    return 'light' // Light by default
  }

  const initial = getInitialTheme()
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', initial)
  }

  return {
    theme: initial,
    toggleTheme: () =>
      set((state) => {
        const next = state.theme === 'dark' ? 'light' : 'dark'
        localStorage.setItem('llmbench_theme', next)
        document.documentElement.setAttribute('data-theme', next)
        return { theme: next }
      }),
    setTheme: (theme) => {
      localStorage.setItem('llmbench_theme', theme)
      document.documentElement.setAttribute('data-theme', theme)
      set({ theme })
    },
  }
})
