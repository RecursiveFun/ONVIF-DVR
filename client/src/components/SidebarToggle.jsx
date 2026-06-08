/**
 * Header button that shows or hides the cameras sidebar.
 */
import MenuIcon from '@mui/icons-material/Menu';
import IconButton from '@mui/material/IconButton';

export default function SidebarToggle({ open, onClick }) {
  return (
    <IconButton
      className="sidebar-toggle"
      onClick={onClick}
      aria-label={open ? 'Hide cameras panel' : 'Show cameras panel'}
      aria-expanded={open}
      size="small"
    >
      <MenuIcon fontSize="small" />
    </IconButton>
  );
}
