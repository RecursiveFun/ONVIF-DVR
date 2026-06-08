import { renderWithTheme as render, screen } from '../test/renderWithTheme.jsx';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import MultiviewGrid from './MultiviewGrid.jsx';

vi.mock('../api.js', () => ({
  api: {
    liveUrl: (id) => `/live/${id}/index.m3u8`,
  },
}));

vi.mock('./LivePlayer.jsx', () => ({
  default: () => <div data-testid="live-player" />,
}));

const cameras = [
  { id: 'cam-1', name: 'Front Door', status: 'live', recording: true },
  { id: 'cam-2', name: 'Garage', status: 'idle', recording: false },
];

describe('MultiviewGrid', () => {
  it('renders selected cameras and opens a tile in tab view', async () => {
    const user = userEvent.setup();
    const onOpenCamera = vi.fn();

    render(
      <MultiviewGrid
        cameras={cameras}
        selectedIds={['cam-1', 'cam-2']}
        onOpenCamera={onOpenCamera}
        onRemoveCamera={vi.fn()}
      />,
    );

    expect(screen.getByText('Front Door')).toBeInTheDocument();
    expect(screen.getByText('Garage')).toBeInTheDocument();
    expect(screen.getByTestId('live-player')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /open front door in tab view/i }));
    expect(onOpenCamera).toHaveBeenCalledWith('cam-1');
  });

  it('removes a tile from multiview when the close button is clicked', async () => {
    const user = userEvent.setup();
    const onRemoveCamera = vi.fn();

    render(
      <MultiviewGrid
        cameras={cameras}
        selectedIds={['cam-1', 'cam-2']}
        onOpenCamera={vi.fn()}
        onRemoveCamera={onRemoveCamera}
      />,
    );

    await user.click(screen.getByRole('button', { name: /remove garage from multiview/i }));
    expect(onRemoveCamera).toHaveBeenCalledWith('cam-2');
  });

  it('shows a hint when no cameras are selected', () => {
    render(
      <MultiviewGrid
        cameras={cameras}
        selectedIds={[]}
        onOpenCamera={vi.fn()}
      />,
    );

    expect(screen.getByText(/no cameras selected for multiview/i)).toBeInTheDocument();
  });
});
