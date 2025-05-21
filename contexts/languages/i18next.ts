import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

const requireContext = require.context('./jsons', false, /\.json$/);
const languageResources: { [key: string]: { translation: any } } = {};

requireContext.keys().forEach((fileName: string) => {
  const langCode = fileName.replace('./', '').replace('.json', '');
  languageResources[langCode] = { translation: requireContext(fileName) };
});

export const getAvailableLanguages = () => {
  return Object.keys(languageResources);
};

export const getLanguageName = (langCode: string) => {
  return languageResources[langCode]?.translation?.languageName || langCode;
};

i18next
  .use(initReactI18next)
  .init({
    resources: languageResources,
    fallbackLng: 'en', // Default language
    interpolation: {
      escapeValue: false,
    },
  });

export const loadLanguage = async () => {
  try {
    const savedLanguage = await AsyncStorage.getItem('language');
    if (savedLanguage && languageResources[savedLanguage]) {
      await i18next.changeLanguage(savedLanguage);
    } else {
      await i18next.changeLanguage('en'); // Default language
    }
  } catch (error) {
    console.error('Error loading language:', error);
  }
};

export const saveLanguage = async (language: string) => {
  try {
    await AsyncStorage.setItem('language', language);
    await i18next.changeLanguage(language);
  } catch (error) {
    console.error('Error saving language:', error);
  }
};

export default i18next;