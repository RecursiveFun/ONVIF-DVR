import { renderWithTheme as render, screen, waitFor } from '../test/renderWithTheme.jsx';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import DirectoryPicker from './DirectoryPicker.jsx';

vi.mock('../api.js', () => ({
  api: {
    listFsRoots: vi.fn(),
    listDirectory: vi.fn(),
  },
}));

describe('DirectoryPicker', () => {
  it('loads folders and selects the current directory', async () => {
    const user = userEvent.setup();
    const { api } = await import('../api.js');

    api.listFsRoots.mockResolvedValue({
      roots: [{ label: 'Data', path: 'C:\\data' }],
    });
    api.listDirectory.mockResolvedValue({
      path: 'C:\\data',
      parent: null,
      entries: [{ name: 'recordings', path: 'C:\\data\\recordings' }],
    });

    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <DirectoryPicker
        open
        initialPath="C:\\data"
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('recordings')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /select this folder/i }));
    expect(onSelect).toHaveBeenCalledWith('C:\\data');
    expect(onClose).toHaveBeenCalled();
  });
});
