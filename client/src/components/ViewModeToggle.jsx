/**
 * Tabs vs multiview layout switcher in the app header.
 */
import TabOutlinedIcon from '@mui/icons-material/TabOutlined';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { VIEW_MODE_MULTIVIEW, VIEW_MODE_TABS } from '../utils/viewMode.js';

export default function ViewModeToggle({ viewMode, onChange }) {
  return (
    <ToggleButtonGroup
      className="view-mode-toggle"
      exclusive
      size="small"
      value={viewMode}
      onChange={(_event, value) => {
        // Exclusive group passes null when the active button is clicked again.
        if (value) onChange(value);
      }}
      aria-label="Main view mode"
    >
      <ToggleButton value={VIEW_MODE_TABS} aria-label="Tabs">
        <TabOutlinedIcon fontSize="small" sx={{ mr: 0.5 }} />
        Tabs
      </ToggleButton>
      <ToggleButton value={VIEW_MODE_MULTIVIEW} aria-label="Multiview">
        <GridViewOutlinedIcon fontSize="small" sx={{ mr: 0.5 }} />
        Multiview
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
