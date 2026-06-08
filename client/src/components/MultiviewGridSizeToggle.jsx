/**
 * N×N multiview layout picker (2×2 through 6×6).
 */
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import {
  MULTIVIEW_GRID_SIZES,
  multiviewGridLabel,
} from '../utils/multiviewGrid.js';

export default function MultiviewGridSizeToggle({ gridSize, onChange }) {
  return (
    <ToggleButtonGroup
      className="multiview-grid-size-toggle"
      exclusive
      size="small"
      value={gridSize}
      onChange={(_event, value) => {
        if (value) onChange(value);
      }}
      aria-label="Multiview grid size"
    >
      {MULTIVIEW_GRID_SIZES.map((size) => (
        <ToggleButton
          key={size}
          value={size}
          aria-label={`${multiviewGridLabel(size)} grid`}
        >
          {multiviewGridLabel(size)}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
