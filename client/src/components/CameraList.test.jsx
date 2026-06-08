import { renderWithTheme as render, screen } from '../test/renderWithTheme.jsx';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CameraList from './CameraList.jsx';

vi.mock('./CameraPreview.jsx', () => ({
  default: () => <span data-testid="camera-preview" />,
}));

const cameras = [
  {
    id: 'cam-1',
    name: 'Front Door',
    status: 'live',
    recording: true,
  },
  {
    id: 'cam-2',
    name: 'Garage',
    status: 'idle',
    recording: false,
  },
];

describe('CameraList', () => {
  it('shows an empty state when there are no cameras', () => {
    render(<CameraList cameras={[]} activeId={null} onSelect={vi.fn()} />);
    expect(screen.getByText(/no cameras configured/i)).toBeInTheDocument();
  });

  it('shows a recording dot beside live cameras that are recording', () => {
    render(<CameraList cameras={cameras} activeId="cam-1" onSelect={vi.fn()} />);
    expect(screen.getByLabelText('Recording')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Recording')).toHaveLength(1);
  });

  it('calls onSelect when a camera row is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<CameraList cameras={cameras} activeId={null} onSelect={onSelect} />);

    await user.click(screen.getByRole('button', { name: /garage/i }));
    expect(onSelect).toHaveBeenCalledWith('cam-2');
  });

  it('marks multiview selections with aria-pressed', () => {
    render(
      <CameraList
        cameras={cameras}
        activeId={null}
        selectedIds={['cam-2']}
        multiviewMode
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /garage/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /front door/i })).toHaveAttribute('aria-pressed', 'false');
  });
});
