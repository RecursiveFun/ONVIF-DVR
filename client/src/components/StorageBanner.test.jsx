import { renderWithTheme as render, screen } from '../test/renderWithTheme.jsx';
import { describe, expect, it } from 'vitest';
import StorageBanner from './StorageBanner.jsx';

describe('StorageBanner', () => {
  it('renders nothing when storage is healthy', () => {
    const { container } = render(
      <StorageBanner storage={{ status: 'ok', freeBytes: 50 * 1024 ** 3 }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a low-space warning', () => {
    render(
      <StorageBanner
        storage={{
          status: 'low',
          freeBytes: 2 * 1024 ** 3,
          recordingsBytes: 10 * 1024 ** 3,
          criticalFreeBytes: 1024 ** 3,
        }}
      />,
    );
    expect(screen.getByText(/disk space running low/i)).toBeInTheDocument();
  });

  it('shows a critical warning', () => {
    render(
      <StorageBanner
        storage={{
          status: 'critical',
          freeBytes: 500 * 1024 ** 2,
          criticalFreeBytes: 1024 ** 3,
        }}
      />,
    );
    expect(screen.getByText(/disk space critically low/i)).toBeInTheDocument();
  });
});
