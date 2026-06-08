import { fireEvent, renderWithTheme as render, screen } from '../test/renderWithTheme.jsx';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import MultiviewGrid from './MultiviewGrid.jsx';
import { DRAG_MIME } from '../utils/dragPayload.js';

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

  it('renders empty slots for an unfilled grid', () => {
    render(
      <MultiviewGrid
        cameras={cameras}
        selectedIds={[]}
        gridSize={2}
        onOpenCamera={vi.fn()}
      />,
    );

    expect(screen.getAllByText(/empty slot/i)).toHaveLength(4);
  });

  it('adds a camera when dropped on the grid', () => {
    const onCameraDrop = vi.fn();
    const onDragEnd = vi.fn();

    render(
      <MultiviewGrid
        cameras={cameras}
        selectedIds={[]}
        dragging
        onCameraDrop={onCameraDrop}
        onDragEnd={onDragEnd}
        onOpenCamera={vi.fn()}
      />,
    );

    const dropZone = screen.getByLabelText(/camera multiview 2 by 2/i);
    const payload = JSON.stringify({ type: 'camera', cameraId: 'cam-2' });

    fireEvent.dragOver(dropZone, {
      dataTransfer: {
        types: [DRAG_MIME],
        dropEffect: 'copy',
      },
    });
    fireEvent.drop(dropZone, {
      dataTransfer: {
        getData: (type) => (type === DRAG_MIME ? payload : ''),
      },
    });

    expect(onCameraDrop).toHaveBeenCalledWith('cam-2');
    expect(onDragEnd).toHaveBeenCalled();
  });
});
