import FullscreenExitOutlinedIcon from '@mui/icons-material/FullscreenExitOutlined';
import FullscreenOutlinedIcon from '@mui/icons-material/FullscreenOutlined';
import IconButton from '@mui/material/IconButton';

export default function FullscreenButton({ isFullscreen, onClick }) {
  return (
    <IconButton
      className="fullscreen-corner-btn"
      onClick={onClick}
      size="small"
      title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
      aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
    >
      {isFullscreen ? <FullscreenExitOutlinedIcon fontSize="small" /> : <FullscreenOutlinedIcon fontSize="small" />}
    </IconButton>
  );
}
