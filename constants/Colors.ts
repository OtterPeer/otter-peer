/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */


export type ThemeColors = {
  text: string;
  text_75: string,
  textButton: string,
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
  swipeIcon: string,
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
    textButton: '#ffffff',
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
    swipeIcon: "#FFFFFF",
    tabIconDefault: '#323232',
    tabIconSelected: '#B97F4C',
    error: '#FF4444',
    deleteBorder: '#FF0000',
    deleteText: '#FF0000',
    deleteIcon: '#FF0000',
    deleteBackground: '#FF00001A',
  },
  light: {
    text: '#2c2c2c',
    text_75: '#2c2c2cBF',
    textButton: '#ffffff',
    text2: '#2b2b2b',
    text2_50: '#2b2b2b80',
    text3_blue: '#007AFF',
    inputPlaceholder: '#9B9B9B80',
    background1: '#F8F8F8',
    background1_50: '#F8F8F880',
    background2: '#EDEDED',
    background3: '#E0E0E0',
    background3_50: '#E0E0E0BF',
    background4_50: '#FFFFFFBF',
    border1: '#D1D1D1',
    border1_50: '#D1D1D180',
    border2: '#000000',
    accent: '#B97F4C',
    icon: '#2c2c2c',
    swipeIcon: "#ffffff",
    tabIconDefault: '#cecece',
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