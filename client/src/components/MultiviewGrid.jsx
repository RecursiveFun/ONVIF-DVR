import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { api } from '../api.js';
import LivePlayer from './LivePlayer.jsx';
import { statusColor, statusLabel } from '../utils/cameraStatus.js';

function MultiviewTile({ camera, onOpen, onRemove }) {
  const isLive = camera.status === 'live';
  const isRecording = camera.recording;

  let placeholder = 'Start live view from the camera page.';
  if (isRecording && !isLive) {
    placeholder = 'Recording without a live preview.';
  } else if (camera.status === 'recording') {
    placeholder = 'Recording in progress.';
  }

  return (
    <Card variant="outlined" className="multiview-tile" sx={{ position: 'relative' }}>
      <IconButton
        className="multiview-tile-close"
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(camera.id);
        }}
        aria-label={`Remove ${camera.name} from multiview`}
        title="Remove from multiview"
        sx={{
          position: 'absolute',
          top: 6,
          right: 6,
          zIndex: 2,
          color: '#fff',
          bgcolor: 'rgba(0, 0, 0, 0.55)',
          boxShadow: 1,
          '&:hover': {
            color: '#fff',
            bgcolor: 'rgba(0, 0, 0, 0.72)',
          },
        }}
      >
        <CloseIcon sx={{ fontSize: 16 }} />
      </IconButton>
      <CardContent sx={{ pb: 1, pr: 5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography variant="subtitle1" fontWeight={600} noWrap sx={{ pr: 1 }}>{camera.name}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
            {isRecording && <Chip label="REC" color="error" size="small" />}
            <Chip label={statusLabel(camera.status)} size="small" color={statusColor(camera.status)} variant="outlined" />
          </Box>
        </Box>
      </CardContent>

      <CardActionArea
        className="multiview-tile-viewer"
        onClick={() => onOpen(camera.id)}
        aria-label={`Open ${camera.name} in tab view`}
      >
        {isLive ? (
          <LivePlayer src={api.liveUrl(camera.id)} active compact />
        ) : (
          <Box className="placeholder video-placeholder multiview-placeholder">
            <Typography variant="body2" color="text.secondary" align="center">{placeholder}</Typography>
          </Box>
        )}
      </CardActionArea>

      <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
        <Button size="small" onClick={() => onOpen(camera.id)}>Open camera page</Button>
      </CardActions>
    </Card>
  );
}

export default function MultiviewGrid({ cameras, selectedIds, onOpenCamera, onRemoveCamera }) {
  const selected = new Set(selectedIds);
  const visible = cameras.filter((camera) => selected.has(camera.id));

  if (cameras.length === 0) {
    return (
      <Box className="placeholder page-placeholder multiview-empty">
        <Typography>No cameras configured.</Typography>
        <Typography color="text.secondary">Add a camera from the sidebar to see it here.</Typography>
      </Box>
    );
  }

  if (visible.length === 0) {
    return (
      <Box className="placeholder page-placeholder multiview-empty">
        <Typography>No cameras selected for multiview.</Typography>
        <Typography color="text.secondary">Choose cameras from the sidebar to show them in the grid.</Typography>
      </Box>
    );
  }

  return (
    <Box className="multiview-grid" aria-label="Camera multiview">
      {visible.map((camera) => (
        <MultiviewTile
          key={camera.id}
          camera={camera}
          onOpen={onOpenCamera}
          onRemove={onRemoveCamera}
        />
      ))}
    </Box>
  );
}
