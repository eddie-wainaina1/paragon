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
        main: '#F97316',     // orange-500 (brand)
        dark: '#EA580C',     // orange-600
        light: '#FFEDD5',    // orange-50, backgrounds only
        contrastText: '#1C1A17',  // dark text: 6.0:1 on #F97316
      },
      secondary: {
        main: '#15803D',     // green-700: 4.57:1 on white
        dark: '#166534',     // green-800
        contrastText: '#ffffff',
      },
      error: {
        main: '#DC2626',     // red-600: 4.67:1 on white
      },
      info: {
        main: '#1D4ED8',          // blue-700: 6.65:1 with white, 6.2:1 on cream (outlined text)
        contrastText: '#ffffff',
      },
      warning: {
        main: '#FACC15',
        contrastText: '#1C1A17',  // dark text on yellow: 10.6:1
      },
      background: isDark
        ? { default: '#1C1917', paper: '#292524' }
        : { default: '#FFF7ED', paper: '#FFFFFF' },
      text: isDark
        ? { primary: '#FEF3C7', secondary: '#A8A29E' }   // dark mode: 6.6:1 on #292524
        : { primary: '#1C1A17', secondary: '#57534E' },  // light mode secondary: 6.3:1 on white
      divider: isDark ? '#44403C' : '#FED7AA',
      orange: {
        main: '#F97316',     // brand orange for decorative use (borders, accents)
        dark: '#EA580C',
        light: '#FFEDD5',
        contrastText: '#1C1A17',  // dark text if ever used as button bg: 6.0:1
      },
    },
    typography: {
      fontFamily: "'Inter', sans-serif",
      h1: { fontWeight: 700, letterSpacing: '-0.01em' },
      h2: { fontWeight: 700, letterSpacing: '-0.01em' },
      h3: { fontWeight: 700, letterSpacing: '-0.01em' },
      h4: { fontWeight: 700 },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
      button: { fontFamily: "'Inter', sans-serif", fontWeight: 600, letterSpacing: '0.01em' },
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.95rem',
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
            borderRadius: 6,
            fontWeight: 600,
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
