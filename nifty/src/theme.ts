import { createTheme } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    orange: Palette['primary'];
  }
  interface PaletteOptions {
    orange?: PaletteOptions['primary'];
  }
}

export function createAppTheme(mode: 'light' | 'dark') {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: '#F97316',
        dark: '#EA580C',
        light: '#FFEDD5',
        contrastText: '#ffffff',
      },
      secondary: {
        main: '#22C55E',
        dark: '#16A34A',
        contrastText: '#ffffff',
      },
      error: {
        main: '#EF4444',
      },
      warning: {
        main: '#FACC15',
      },
      background: isDark
        ? { default: '#1C1917', paper: '#292524' }
        : { default: '#FFF7ED', paper: '#FFFFFF' },
      text: isDark
        ? { primary: '#FEF3C7', secondary: '#A8A29E' }
        : { primary: '#1C1A17', secondary: '#78716C' },
      divider: isDark ? '#44403C' : '#FED7AA',
      orange: {
        main: '#F97316',
        dark: '#EA580C',
        light: '#FFEDD5',
        contrastText: '#ffffff',
      },
    },
    typography: {
      fontFamily: "'Fredoka', sans-serif",
      h1: { fontFamily: "'Fredoka One', cursive", fontWeight: 400, letterSpacing: '0.01em' },
      h2: { fontFamily: "'Fredoka One', cursive", fontWeight: 400, letterSpacing: '0.01em' },
      h3: { fontFamily: "'Fredoka One', cursive", fontWeight: 400, letterSpacing: '0.01em' },
      h4: { fontFamily: "'Fredoka One', cursive", fontWeight: 400, letterSpacing: '0.01em' },
      h5: { fontFamily: "'Fredoka One', cursive", fontWeight: 400 },
      h6: { fontFamily: "'Fredoka One', cursive", fontWeight: 400 },
      button: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, letterSpacing: '0.02em' },
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 50,
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '1rem',
          },
          containedPrimary: {
            background: 'linear-gradient(135deg, #F97316, #EA580C)',
            boxShadow: '0 4px 14px rgba(249,115,22,0.35)',
            '&:hover': {
              background: 'linear-gradient(135deg, #EA580C, #C2410C)',
              boxShadow: '0 6px 20px rgba(249,115,22,0.45)',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            border: `2px solid ${isDark ? '#44403C' : '#FED7AA'}`,
            boxShadow: isDark
              ? '0 4px 24px rgba(0,0,0,0.35)'
              : '0 4px 24px rgba(249,115,22,0.10)',
            '&:hover': {
              borderColor: '#F97316',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: '#F97316',
            },
          },
          notchedOutline: {
            borderColor: isDark ? '#44403C' : '#FED7AA',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 50,
            fontWeight: 700,
          },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            '& .MuiTableCell-head': {
              background: isDark ? '#292524' : '#FFF7ED',
              fontWeight: 800,
              fontSize: '0.78rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: isDark ? '#A8A29E' : '#78716C',
            },
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            '&:hover': {
              backgroundColor: isDark ? 'rgba(249,115,22,0.07)' : '#FFFBEB',
            },
          },
        },
      },
    },
  });
}
