import { create } from 'zustand';

type Theme = 'dark' | 'light';

function applyTheme(theme: Theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  localStorage.setItem('buyer-dashboard_theme', theme);
}

const initialTheme = (localStorage.getItem('buyer-dashboard_theme') as Theme) || 'dark';
// Apply immediately to avoid flash of wrong theme
applyTheme(initialTheme);

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initialTheme,
  toggleTheme: () =>
    set((state) => {
      const next = state.theme === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      return { theme: next };
    }),
}));
