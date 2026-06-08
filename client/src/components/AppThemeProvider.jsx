import { useMemo } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { createAppTheme } from '../theme/muiTheme.js';

export default function AppThemeProvider({ mode = 'dark', children }) {
  const theme = useMemo(() => createAppTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      {children}
    </ThemeProvider>
  );
}
