import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../store/chatStore';
import i18n from '../../i18n/config';

export function LanguageSwitcher() {
  const { i18n: i18nHook } = useTranslation();
  const { setLanguage } = useChatStore();
  const currentLang = i18nHook.language === 'pl' ? 'pl' : 'en';

  const toggle = () => {
    const next = currentLang === 'pl' ? 'en' : 'pl';
    i18n.changeLanguage(next);
    setLanguage(next); // also persists to localStorage via store
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-200 
                 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700 
                 px-3 py-1.5 rounded-lg transition-all duration-150"
      title={currentLang === 'pl' ? 'Switch to English' : 'Przełącz na polski'}
    >
      <span>🌍</span>
      <span>{currentLang.toUpperCase()}</span>
    </button>
  );
}
