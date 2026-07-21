import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import enTranslation from '../../locales/en/translation.json';
import arTranslation from '../../locales/ar/translation.json';

// Initialize i18next
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: enTranslation,
      },
      ar: {
        translation: arTranslation,
      },
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already safe from XSS
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },
  });

// Apply layout direction and document lang attribute dynamically on language change
i18n.on('languageChanged', (lng) => {
  const dir = lng === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.dir = dir;
  document.documentElement.lang = lng;
  
  // Custom font styling for Arabic if needed
  if (lng === 'ar') {
    document.documentElement.classList.add('rtl-arabic');
  } else {
    document.documentElement.classList.remove('rtl-arabic');
  }
});

// Run initial layout setup on module load
const initialLng = i18n.resolvedLanguage || 'en';
document.documentElement.dir = initialLng === 'ar' ? 'rtl' : 'ltr';
document.documentElement.lang = initialLng;
if (initialLng === 'ar') {
  document.documentElement.classList.add('rtl-arabic');
}

export default i18n;
