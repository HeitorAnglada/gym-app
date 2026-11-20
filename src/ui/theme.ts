/** Tokens de cor e fonte do kargo (identidade da Kairo, só tema escuro na v1). */
export const colors = {
  bg: '#0B0B0B',
  card: '#151515',
  card2: '#1E1E1E',
  line: '#2A2A2A',
  text: '#EDEDED',
  text2: '#B5B5B5',
  grey: '#8A8A8A',
  acai: '#5B2A86',
  acaiLight: '#9B55CC',
  lilac: '#D29BF5',
  acaiBg: '#2A1A3A',
  orange: '#FF8A3D',
  yellow: '#F2C94C',
  yellowBg: '#2F270C',
  green: '#5FD08A',
  greenBg: '#0F2A1A',
  white: '#FFFFFF',
} as const;

export const fonts = {
  brand: 'Unbounded_300Light',
  num: 'SpaceGrotesk_500Medium',
  text: 'Inter_400Regular',
  textSemi: 'Inter_600SemiBold',
  textBold: 'Inter_700Bold',
} as const;

export const radius = { sm: 10, md: 14, lg: 18, xl: 20 } as const;
