import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, ThemeColors } from '../constants/Colors';

type ThemeContextType = {
  theme: ThemeColors;
  colorScheme: 'light' | 'dark';
  setColorScheme: (scheme: 'light' | 'dark' | 'system') => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>(
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'
  );
  const [useSystemTheme, setUseSystemTheme] = useState(true);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('appTheme');
        if (savedTheme) {
          if (savedTheme === 'system') {
            setUseSystemTheme(true);
            setColorScheme(Appearance.getColorScheme() === 'dark' ? 'dark' : 'light');
          } else {
            setUseSystemTheme(false);
            setColorScheme(savedTheme as 'light' | 'dark');
          }
        }
      } catch (e) {
        console.warn('Failed to load theme from AsyncStorage:', e);
      }
    };
    loadTheme();
  }, []);

  useEffect(() => {
    // Listen for system theme changes if using system theme
    if (useSystemTheme) {
      const subscription = Appearance.addChangeListener(({ colorScheme: newScheme }) => {
        setColorScheme(newScheme === 'dark' ? 'dark' : 'light');
      });
      return () => subscription.remove();
    }
  }, [useSystemTheme]);

  const handleSetColorScheme = async (scheme: 'light' | 'dark' | 'system') => {
    try {
      if (scheme === 'system') {
        setUseSystemTheme(true);
        const systemScheme = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
        setColorScheme(systemScheme);
        await AsyncStorage.setItem('appTheme', 'system');
      } else {
        setUseSystemTheme(false);
        setColorScheme(scheme);
        await AsyncStorage.setItem('appTheme', scheme);
      }
    } catch (e) {
      console.warn('Failed to save theme to AsyncStorage:', e);
    }
  };

  const theme = Colors[colorScheme];

  return (
    <ThemeContext.Provider value={{ theme, colorScheme, setColorScheme: handleSetColorScheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};