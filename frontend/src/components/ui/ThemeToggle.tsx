import { useThemeStore } from '../../store/themeStore';

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center justify-center w-8 h-8 rounded-lg
                 text-slate-500 dark:text-slate-400
                 hover:text-slate-900 dark:hover:text-slate-100
                 hover:bg-slate-100 dark:hover:bg-slate-800
                 border border-slate-200 dark:border-slate-700
                 transition-all duration-150"
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span className="text-base leading-none">{theme === 'dark' ? '☀️' : '🌙'}</span>
    </button>
  );
}

