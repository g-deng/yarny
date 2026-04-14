/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const YarnyColors = {
  background: '#AEC9D7',
  card: '#457C99',
  button: '#0F374E',
  white: '#FFFFFF',
  textPrimary: '#0F374E',
  textSecondary: '#FFFFFF',
  border: '#8AAFBF',
};

export const YarnyFonts = {
  header: 'Montserrat-SemiBold',
  body: 'Montserrat-Regular',
  bodySemiBold: 'Montserrat-SemiBold',
  bodyBold: 'Montserrat-Bold',
};

export const YarnySizes = {
  title: 36,
  subtitle: 24,
  body: 18,
  caption: 14,
};

export const BrutalColors = {
  background: '#FEF6E4',
  surface: '#FFFFFF',
  outline: '#0D0D0D',
  shadow: '#0D0D0D',
  textPrimary: '#0D0D0D',
  textOnAccent: '#0D0D0D',
  yellow: '#FFDB4D',
  pink: '#FF6B9D',
  cyan: '#7DD3F2',
  lime: '#A8E05F',
  red: '#FF5A5F',
};

export const BrutalTokens = {
  borderWidth: 3,
  borderWidthThick: 4,
  radius: 10,
  shadowOffset: { x: 5, y: 5 },
  shadowOffsetSm: { x: 3, y: 3 },
};

export const BrutalFonts = {
  body: 'Montserrat-Regular',
  semibold: 'Montserrat-SemiBold',
  bold: 'Montserrat-Bold',
  black: 'Montserrat-ExtraBold',
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
