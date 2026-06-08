import { createTheme } from '@mui/material/styles';

const shared = {
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          background: 'transparent',
          '&::before': {
            display: 'none',
          },
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          minHeight: 40,
          px: 0,
        },
        content: {
          alignItems: 'center',
          gap: 8,
          my: 0.5,
        },
      },
    },
    MuiAccordionDetails: {
      styleOverrides: {
        root: {
          px: 0,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 8,
        },
      },
    },
  },
};

const palettes = {
  dark: {
    mode: 'dark',
    primary: {
      main: '#3b82f6',
      dark: '#2563eb',
      contrastText: '#fff',
    },
    error: {
      main: '#ef4444',
    },
    success: {
      main: '#22c55e',
    },
    background: {
      default: '#0f1117',
      paper: '#1a1d27',
    },
    text: {
      primary: '#e8eaef',
      secondary: '#8b92a8',
    },
    divider: '#2e3344',
  },
  light: {
    mode: 'light',
    primary: {
      main: '#2563eb',
      dark: '#1d4ed8',
      contrastText: '#fff',
    },
    error: {
      main: '#dc2626',
    },
    success: {
      main: '#16a34a',
    },
    background: {
      default: '#eef1f6',
      paper: '#ffffff',
    },
    text: {
      primary: '#151823',
      secondary: '#5c6478',
    },
    divider: '#cdd3df',
  },
};

export function createAppTheme(mode = 'dark') {
  const palette = palettes[mode === 'light' ? 'light' : 'dark'];
  return createTheme({
    ...shared,
    palette,
  });
}
