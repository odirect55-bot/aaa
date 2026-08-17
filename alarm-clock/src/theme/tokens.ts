/**
 * Design tokens. Both palettes are defined in full (rather than one derived
 * from the other) so dark mode is designed, not inverted.
 */

export interface Palette {
  /** App background. */
  background: string;
  /** Cards and sheets sitting on the background. */
  surface: string;
  /** Raised surface: pressed states, inputs, segmented controls. */
  surfaceRaised: string;
  /** Subtle fill for chips and inactive day pills. */
  surfaceSubtle: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  /** Brand colour, used for primary actions and the active state. */
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  /** Tint behind primary elements. */
  primarySoft: string;
  danger: string;
  dangerSoft: string;
  success: string;
  warning: string;
  /** Full-bleed ringing screen. */
  ringingBackgroundTop: string;
  ringingBackgroundBottom: string;
  overlay: string;
  switchTrackOff: string;
  switchThumb: string;
}

export const lightPalette: Palette = {
  background: '#F4F5FB',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfaceSubtle: '#ECEDF6',
  border: '#E1E3F0',
  textPrimary: '#14142B',
  textSecondary: '#565785',
  textMuted: '#8A8BA8',
  primary: '#5B4CE0',
  primaryPressed: '#4A3CC4',
  onPrimary: '#FFFFFF',
  primarySoft: '#E9E6FC',
  danger: '#D93A4B',
  dangerSoft: '#FBE7E9',
  success: '#1E9E6A',
  warning: '#C77700',
  ringingBackgroundTop: '#5B4CE0',
  ringingBackgroundBottom: '#2E2470',
  overlay: 'rgba(20, 20, 43, 0.45)',
  switchTrackOff: '#D3D5E4',
  switchThumb: '#FFFFFF',
};

export const darkPalette: Palette = {
  background: '#0B0B12',
  surface: '#16161F',
  surfaceRaised: '#1E1E2B',
  surfaceSubtle: '#22222F',
  border: '#2A2A3A',
  textPrimary: '#F5F5FA',
  textSecondary: '#A8A9C0',
  textMuted: '#6E6F87',
  primary: '#8B7BFF',
  primaryPressed: '#7768F0',
  onPrimary: '#0B0B12',
  primarySoft: '#241F45',
  danger: '#FF6B7A',
  dangerSoft: '#3A1D22',
  success: '#35C48B',
  warning: '#F0A93B',
  ringingBackgroundTop: '#2A2160',
  ringingBackgroundBottom: '#0B0B12',
  overlay: 'rgba(0, 0, 0, 0.6)',
  switchTrackOff: '#3A3A4C',
  switchThumb: '#F5F5FA',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 64, fontWeight: '200' as const, letterSpacing: -2 },
  title: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  heading: { fontSize: 20, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  bodyStrong: { fontSize: 16, fontWeight: '600' as const },
  caption: { fontSize: 13, fontWeight: '500' as const },
  overline: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.2 },
} as const;

/** Minimum touch target, per the platform accessibility guidelines. */
export const MIN_TOUCH_TARGET = 48;
