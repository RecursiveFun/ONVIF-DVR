import { renderWithTheme as render, screen } from '../test/renderWithTheme.jsx';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CameraTabs from './CameraTabs.jsx';

vi.mock('./CameraPreview.jsx', () => ({
  default: () => <span data-testid="camera-preview" />,
}));

vi.mock('./SegmentPreview.jsx', () => ({
  default: ({ time }) => <span data-testid="segment-preview">{time}</span>,
}));

const cameras = [{ id: 'cam-1', name: 'C120', status: 'live', recording: true }];
const segment = { id: 'seg-1', startLocalDisplay: '2:30 PM' };

describe('CameraTabs', () => {
  it('renders camera and segment tab previews differently', () => {
    render(
      <CameraTabs
        tabs={[
          { id: 't1', type: 'camera', cameraId: 'cam-1', label: 'C120' },
          { id: 't2', type: 'segment', cameraId: 'cam-1', label: 'C120 · 2:30 PM', segment },
        ]}
        cameras={cameras}
        activeTabId="t2"
        playbackThumbTimes={{ 'seg-1': 42 }}
        dragging={false}
        onSelectTab={vi.fn()}
        onCloseTab={vi.fn()}
        onTabBarDrop={vi.fn()}
      />,
    );

    expect(screen.getByTestId('camera-preview')).toBeInTheDocument();
    expect(screen.getByTestId('segment-preview')).toHaveTextContent('42');
  });

  it('selects a tab when clicked', async () => {
    const user = userEvent.setup();
    const onSelectTab = vi.fn();

    render(
      <CameraTabs
        tabs={[{ id: 't1', type: 'camera', cameraId: 'cam-1', label: 'C120' }]}
        cameras={cameras}
        activeTabId="t1"
        dragging={false}
        onSelectTab={onSelectTab}
        onCloseTab={vi.fn()}
        onTabBarDrop={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { current: 'page' }));
    expect(onSelectTab).toHaveBeenCalledWith('t1');
  });

  it('closes a tab from the close button', async () => {
    const user = userEvent.setup();
    const onCloseTab = vi.fn();

    render(
      <CameraTabs
        tabs={[{ id: 't1', type: 'camera', cameraId: 'cam-1', label: 'C120' }]}
        cameras={cameras}
        activeTabId="t1"
        dragging={false}
        onSelectTab={vi.fn()}
        onCloseTab={onCloseTab}
        onTabBarDrop={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /close tab c120/i }));
    expect(onCloseTab).toHaveBeenCalledWith('t1');
  });
});
