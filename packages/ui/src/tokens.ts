export const tokens = {
  color: {
    bg: '#f4f8f7',
    surface: '#ffffff',
    surfaceMuted: '#edf4f2',
    text: '#102124',
    textMuted: '#4a6469',
    border: '#c7d7d4',
    primary: '#006d5b',
    primaryHover: '#005748',
    danger: '#b42318',
    focus: '#1e8f75',
  },
  spacing: {
    xxs: '0.25rem',
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    xxl: '3rem',
  },
  radius: {
    sm: '8px',
    md: '12px',
    lg: '18px',
    pill: '999px',
  },
  shadow: {
    sm: '0 4px 12px rgba(6, 35, 36, 0.06)',
    md: '0 12px 24px rgba(6, 35, 36, 0.08)',
  },
  breakpoints: {
    mobile: 480,
    tablet: 768,
    desktop: 1200,
  },
  font: {
    familySans: "'Source Sans 3', 'Segoe UI', sans-serif",
    familyMono: "'JetBrains Mono', monospace",
  },
} as const;

export type DesignTokens = typeof tokens;
