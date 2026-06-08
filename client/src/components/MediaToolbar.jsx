/**
 * Mute toggle, volume slider, and percentage label for video players.
 */
import VolumeOffOutlinedIcon from '@mui/icons-material/VolumeOffOutlined';
import VolumeUpOutlinedIcon from '@mui/icons-material/VolumeUpOutlined';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export default function MediaToolbar({ volume, muted, onVolumeChange, onToggleMute }) {
  const pct = Math.round(volume * 100);
  const showMuted = muted || volume === 0;

  return (
    <Box className="media-toolbar" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <IconButton
        size="small"
        onClick={onToggleMute}
        title={showMuted ? 'Unmute' : 'Mute'}
        aria-label={showMuted ? 'Unmute' : 'Mute'}
        sx={{ color: 'inherit' }}
      >
        {showMuted ? <VolumeOffOutlinedIcon fontSize="small" /> : <VolumeUpOutlinedIcon fontSize="small" />}
      </IconButton>
      <Slider
        className="volume-slider"
        size="small"
        min={0}
        max={100}
        value={pct}
        onChange={(_e, value) => onVolumeChange(value / 100)}
        aria-label="Volume"
        sx={{ width: 72, color: 'inherit' }}
      />
      <Typography className="volume-label" variant="caption" sx={{ minWidth: 32 }}>
        {pct}%
      </Typography>
    </Box>
  );
}
