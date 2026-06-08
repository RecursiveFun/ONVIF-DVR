import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithTheme, screen } from '../test/renderWithTheme.jsx';
import ViewModeToggle from './ViewModeToggle.jsx';
import { VIEW_MODE_MULTIVIEW, VIEW_MODE_TABS } from '../utils/viewMode.js';

describe('ViewModeToggle', () => {
  it('switches between tabs and multiview', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    renderWithTheme(<ViewModeToggle viewMode={VIEW_MODE_TABS} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Multiview' }));
    expect(onChange).toHaveBeenCalledWith(VIEW_MODE_MULTIVIEW);
  });
});
