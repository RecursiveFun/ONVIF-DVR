import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

export default function ThemeToggle({ theme, onChange }) {
  return (
    <ToggleButtonGroup
      className="theme-toggle"
      exclusive
      size="small"
      value={theme}
      onChange={(_event, value) => {
        if (value) onChange(value);
      }}
      aria-label="Color theme"
    >
      <ToggleButton value="light" aria-label="Light mode" title="Light mode">
        <LightModeOutlinedIcon fontSize="small" sx={{ mr: 0.5 }} />
        Light
      </ToggleButton>
      <ToggleButton value="dark" aria-label="Dark mode" title="Dark mode">
        <DarkModeOutlinedIcon fontSize="small" sx={{ mr: 0.5 }} />
        Dark
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
