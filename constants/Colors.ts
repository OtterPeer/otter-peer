/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */


export type ThemeColors = {
  text: string;
  text_75: string,
  text2: string;
  text2_50: string;
  text3_blue: string,
  inputPlaceholder: string,
  background1: string;
  background1_50: string,
  background2: string;
  background3: string;
  background3_50: string,
  background4_50: string;
  border1: string;
  border1_50: string;
  border2: string;
  accent: string;
  icon: string,
  tabIconDefault: string;
  tabIconSelected: string;
  error: string,
  deleteBorder: string,
  deleteText: string,
  deleteIcon: string,
  deleteBackground: string,
};

export const Colors: {
  light: ThemeColors;
  dark: ThemeColors;
} = {
  dark: {
    text: '#FFFFFF',
    text_75: '#FFFFFFBF',
    text2: '#DDDDDD',
    text2_50: '#DDDDDD80',
    text3_blue: '#007AFF',
    inputPlaceholder: '#DDDDDD40',
    background1: '#161616',
    background1_50: '#16161680',
    background2: '#242424',
    background3: '#323232',
    background3_50: '#323232BF',
    background4_50: '#000000BF',
    border1: '#323232',
    border1_50: '#32323280',
    border2: '#FFFFFF',
    accent: '#B97F4C',
    icon: '#FFFFFF',
    tabIconDefault: '#323232',
    tabIconSelected: '#B97F4C',
    error: '#FF4444',
    deleteBorder: '#FF0000',
    deleteText: '#FF0000',
    deleteIcon: '#FF0000',
    deleteBackground: '#FF00001A',
  },
  light: {
    text: '#11181C',
    text_75: '#FFFFFFBF',
    text2: '#DDDDDD',
    text2_50: '#DDDDDD80',
    text3_blue: '#007AFF',
    inputPlaceholder: '#DDDDDD40',
    background1: '#fff',
    background1_50: '#16161680',
    background2: '#fff',
    background3: '#fff',
    background3_50: '#323232BF',
    background4_50: '#000000BF',
    border1: '#323232',
    border1_50: '#32323280',
    border2: '#FFFFFF',
    accent: '#B97F4C',
    icon: '#FFFFFF',
    tabIconDefault: '#687076',
    tabIconSelected: '#B97F4C',
    error: '#FF4444',
    deleteBorder: '#FF0000',
    deleteText: '#FF0000',
    deleteIcon: '#FF0000',
    deleteBackground: '#FF00001A',
  },
};

export const isDarkMode = (scheme: 'light' | 'dark' | null): boolean => {
  return scheme === 'dark';
};