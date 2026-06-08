/**
 * Sidebar camera list with preview thumbnails, status chips, and drag-to-tab.
 * Selection semantics differ between single-tab and multiview modes.
 */
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CameraPreview from './CameraPreview.jsx';
import SidebarSection from './SidebarSection.jsx';
import { setCameraDragData } from '../utils/dragPayload.js';
import { statusColor, statusLabel } from '../utils/cameraStatus.js';

export default function CameraList({
  cameras,
  activeId,
  selectedIds = null,
  multiviewMode = false,
  onSelect,
  onDragStart,
  onDragEnd,
}) {
  const handleDragStart = (cam, e) => {
    setCameraDragData(e, cam.id);
    onDragStart?.();
  };

  return (
    <SidebarSection title="Cameras" count={cameras.length}>
      {cameras.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No cameras configured.</Typography>
      ) : (
        <List dense disablePadding className="camera-pages-nav">
          {cameras.map((cam) => {
            // Multiview highlights every selected tile; tabs highlight the active page only.
            const inMultiview = multiviewMode && selectedIds?.includes(cam.id);
            const isActive = multiviewMode ? inMultiview : cam.id === activeId;

            return (
              <ListItem
                key={cam.id}
                disablePadding
                secondaryAction={null}
                className="camera-page-row"
              >
                <ListItemButton
                  draggable
                  selected={isActive}
                  className="draggable-row"
                  onClick={() => onSelect(cam.id)}
                  onDragStart={(e) => handleDragStart(cam, e)}
                  onDragEnd={onDragEnd}
                  aria-current={!multiviewMode && cam.id === activeId ? 'page' : undefined}
                  aria-pressed={multiviewMode ? inMultiview : undefined}
                  title={multiviewMode
                    ? `${cam.name} — click to toggle, drag to add to multiview`
                    : `${cam.name} — click to select, drag to open a new tab`}
                  sx={{ gap: 1, borderRadius: 1 }}
                >
                  <span className="drag-handle-icon" aria-hidden="true">⠿</span>
                  <CameraPreview
                    cameraId={cam.id}
                    streamUrl={cam.rtspUrl}
                    streaming={cam.status === 'live' || cam.recording}
                  />
                  <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                    <Typography variant="body2" fontWeight={500} noWrap>{cam.name}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                      <Chip label={statusLabel(cam.status)} size="small" color={statusColor(cam.status)} variant="outlined" />
                      {cam.status === 'live' && cam.recording && (
                        <Typography component="span" color="error" aria-label="Recording" sx={{ fontSize: '0.55rem' }}>
                          ●
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      )}
    </SidebarSection>
  );
}
