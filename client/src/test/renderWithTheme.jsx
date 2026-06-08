/** Test helper — wraps components in the app's MUI theme provider. */
import { render } from '@testing-library/react';
import { createElement } from 'react';
import AppThemeProvider from '../components/AppThemeProvider.jsx';

export function renderWithTheme(ui, options = {}) {
  const { mode = 'dark', ...renderOptions } = options;

  return render(
    createElement(AppThemeProvider, { mode: mode }, ui),
    renderOptions,
  );
}

export * from '@testing-library/react';
