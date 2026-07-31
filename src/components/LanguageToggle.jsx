import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';

export default function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div
      className="fixed right-3 top-3 z-[100] flex rounded-lg border border-gray-200 bg-white p-1 text-xs font-bold shadow-md"
      aria-label={t('语言选择', 'Language selector')}
    >
      <button
        type="button"
        onClick={() => setLanguage('en')}
        aria-pressed={language === 'en'}
        className={`rounded-md px-2.5 py-1.5 transition ${
          language === 'en'
            ? 'bg-gray-900 text-white'
            : 'text-gray-500 hover:bg-gray-100'
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLanguage('zh')}
        aria-pressed={language === 'zh'}
        className={`rounded-md px-2.5 py-1.5 transition ${
          language === 'zh'
            ? 'bg-gray-900 text-white'
            : 'text-gray-500 hover:bg-gray-100'
        }`}
      >
        CN
      </button>
    </div>
  );
}
