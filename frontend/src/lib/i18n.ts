import i18n from 'i18next';
import { initReactI18next, useTranslation as useI18nextTranslation } from 'react-i18next';
import he from '@/locales/he.json';

// The app currently ships Hebrew only. To add another language later:
//   1. add `src/locales/<lang>.json` (mirror of he.json)
//   2. import it here and add it to `resources` below
//   3. add its code to RTL_LANGS if it is right-to-left
//   4. (optional) re-add a language switcher that calls changeLanguage()
export const RTL_LANGS = ['he', 'ar'];
export const isRtlLang = (lng: string) => RTL_LANGS.includes(lng);

const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('lang') : null;

i18n
  .use(initReactI18next)
  .init({
    resources: {
      he: { translation: he },
    },
    lng: stored || 'he',        // default language
    fallbackLng: 'he',          // fallback for missing keys
    interpolation: { escapeValue: false }, // React already escapes
  });

// Keep the document direction / lang attributes in sync with the active locale.
const applyDocumentDir = (lng: string) => {
  if (typeof document === 'undefined') return;
  document.documentElement.dir = isRtlLang(lng) ? 'rtl' : 'ltr';
  document.documentElement.lang = lng;
};

applyDocumentDir(i18n.language);
i18n.on('languageChanged', (lng) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem('lang', lng);
  applyDocumentDir(lng);
});

/**
 * App translation hook. Exposes:
 *   t(key)            — dot-notation translation macro
 *   isRTL             — true when the active locale is RTL (he/ar)
 *   changeLanguage()  — switch the active locale
 */
export function useTranslation() {
  const { t, i18n: instance } = useI18nextTranslation();
  return {
    t,
    i18n: instance,
    isRTL: isRtlLang(instance.language),
    changeLanguage: (lng: string) => instance.changeLanguage(lng),
  };
}

export default i18n;
