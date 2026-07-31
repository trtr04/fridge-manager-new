import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';

const LANGUAGE_KEY = 'fm_language_v1';
const LanguageContext = createContext(null);

function getInitialLanguage() {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    return saved === 'en' ? 'en' : 'zh';
  } catch {
    return 'zh';
  }
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(getInitialLanguage);

  useEffect(() => {
    document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
    document.title =
      language === 'en'
        ? 'Fridge Manager - Smart Ingredient Management'
        : '冰箱托管 - 智能食材管理';
    try {
      localStorage.setItem(LANGUAGE_KEY, language);
    } catch {
      // The language still works for the current session.
    }
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      isEnglish: language === 'en',
      t: (chinese, english) => (language === 'en' ? english : chinese)
    }),
    [language]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used inside LanguageProvider');
  }
  return context;
}
