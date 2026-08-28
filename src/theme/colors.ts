export const colors = {
  background: '#0B0C0C',
  surface: '#151616',
  surfaceElevated: '#1D1E1E',
  surfaceSelected: '#272A20',
  glassFallback: 'rgba(21, 22, 22, 0.88)',
  border: '#2D2F2F',
  borderStrong: '#3A3D34',
  primary: '#CAFF00',
  primaryMuted: '#2C3708',
  onPrimary: '#111400',
  textPrimary: '#F4F5ED',
  textSecondary: '#C4C6BC',
  textMuted: '#85887E',
  success: '#A7E06F',
  warning: '#F1C66C',
  danger: '#FF8585',
  info: '#ABEDFF',
  transparent: 'transparent',
} as const;

export type ThemeColor = keyof typeof colors;
