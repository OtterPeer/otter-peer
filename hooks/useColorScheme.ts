// export { useColorScheme } from 'react-native';

import { useEffect, useState } from 'react';
import { Appearance } from 'react-native';

export function useColorScheme() {
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>(
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'
  );

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setColorScheme(colorScheme === 'dark' ? 'dark' : 'light');
    });
    return () => subscription.remove();
  }, []);

  return colorScheme;
}
