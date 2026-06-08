import { renderWithTheme as render, screen } from '../test/renderWithTheme.jsx';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import MultiviewGridSizeToggle from './MultiviewGridSizeToggle.jsx';

describe('MultiviewGridSizeToggle', () => {
  it('switches between grid sizes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<MultiviewGridSizeToggle gridSize={2} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /4×4 grid/i }));
    expect(onChange).toHaveBeenCalledWith(4);
  });
});
