/**
 * Multiview page: fixed N×N grid of cameras the user selected in the sidebar.
 *
 * Each tile shows a live player when streaming, otherwise a status-aware placeholder.
 * Tiles open the full camera page or can be removed from the multiview set.
 * The grid accepts camera drags from the sidebar to fill empty slots.
 */
import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { useCallback, useState } from 'react';
import { api } from '../api.js';
import LivePlayer from './LivePlayer.jsx';
import { isDragPayload, parseDragPayload } from '../utils/dragPayload.js';
import { statusColor, statusLabel } from '../utils/cameraStatus.js';
import {
  buildMultiviewSlots,
  DEFAULT_MULTIVIEW_GRID_SIZE,
  maxMultiviewSlots,
} from '../utils/multiviewGrid.js';

/** Empty grid cell — accepts camera drops when a slot is free. */
function MultiviewEmptySlot({ compact, dragging, dropHover, onCameraDrop, onDragEnd }) {
  const [hover, setHover] = useState(false);

  const handleDragOver = useCallback((e) => {
    if (!isDragPayload(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setHover(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setHover(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setHover(false);
    const payload = parseDragPayload(e);
    if (payload?.type === 'camera') {
      onCameraDrop?.(payload.cameraId);
    }
    onDragEnd?.();
  }, [onCameraDrop, onDragEnd]);

  const active = dragging || dropHover || hover;

  return (
    <Card
      variant="outlined"
      className={`multiview-slot-empty${compact ? ' compact' : ''}${active ? ' drop-active' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Typography variant="body2" color="text.secondary" align="center">
        {active ? 'Drop camera here' : 'Empty slot'}
      </Typography>
    </Card>
  );
}

/** Single camera card in the multiview grid. */
function MultiviewTile({ camera, compact, onOpen, onRemove }) {
  const isLive = camera.status === 'live';
  const isRecording = camera.recording;

  // Placeholder copy reflects recording-without-live vs idle states.
  let placeholder = 'Start live view from the camera page.';
  if (isRecording && !isLive) {
    placeholder = 'Recording without a live preview.';
  } else if (camera.status === 'recording') {
    placeholder = 'Recording in progress.';
  }

  return (
    <Card
      variant="outlined"
      className={`multiview-tile${compact ? ' compact' : ''}`}
      sx={{
        position: 'relative',
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <CardActionArea
        className="multiview-tile-viewer"
        onClick={() => onOpen(camera.id)}
        aria-label={`Open ${camera.name} in tab view`}
        sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'stretch' }}
      >
        {isLive ? (
          <LivePlayer src={api.liveUrl(camera.id)} active compact />
        ) : (
          <Box className="placeholder video-placeholder multiview-placeholder">
            <Typography variant="body2" color="text.secondary" align="center">{placeholder}</Typography>
          </Box>
        )}

        <Box className="multiview-tile-header" component="div">
          <Typography
            className="multiview-tile-name"
            variant={compact ? 'body2' : 'subtitle2'}
            fontWeight={600}
            noWrap
          >
            {camera.name}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
            {isRecording && <Chip label="REC" color="error" size="small" />}
            <Chip
              label={statusLabel(camera.status)}
              size="small"
              color={statusColor(camera.status)}
              variant="outlined"
              sx={{ bgcolor: 'rgba(0, 0, 0, 0.35)' }}
            />
          </Box>
        </Box>
      </CardActionArea>

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
          zIndex: 3,
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
    </Card>
  );
}

/**
 * @param {object} props
 * @param {Array} props.cameras - Full camera list (for empty-state messaging).
 * @param {string[]} props.selectedIds - IDs shown in the grid; order follows sidebar selection.
 * @param {number} [props.gridSize] - N for an N×N layout.
 * @param {boolean} [props.dragging] - True when a sidebar camera is being dragged.
 * @param {(cameraId: string) => void} [props.onCameraDrop] - Add a camera tile from a drag payload.
 */
export default function MultiviewGrid({
  cameras,
  selectedIds,
  gridSize = DEFAULT_MULTIVIEW_GRID_SIZE,
  dragging = false,
  onCameraDrop,
  onDragEnd,
  onOpenCamera,
  onRemoveCamera,
}) {
  const [dropHover, setDropHover] = useState(false);
  const compact = gridSize >= 4;
  const maxSlots = maxMultiviewSlots(gridSize);
  const filledCount = selectedIds.filter((id) => cameras.some((camera) => camera.id === id)).length;
  const gridFull = filledCount >= maxSlots;
  const slots = buildMultiviewSlots(selectedIds, cameras, gridSize);

  const handleDragOver = useCallback((e) => {
    if (!isDragPayload(e) || gridFull) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDropHover(true);
  }, [gridFull]);

  const handleDragLeave = useCallback((e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDropHover(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDropHover(false);
    if (gridFull) return;
    const payload = parseDragPayload(e);
    if (payload?.type === 'camera') {
      onCameraDrop?.(payload.cameraId);
    }
    onDragEnd?.();
  }, [gridFull, onCameraDrop, onDragEnd]);

  const dropZoneClass = [
    'multiview-drop-zone',
    dragging && !gridFull ? 'dragging-active' : '',
    dropHover && !gridFull ? 'drop-hover' : '',
    gridFull ? 'grid-full' : '',
  ].filter(Boolean).join(' ');

  const dropHint = (dragging || dropHover) && !gridFull && (
    <div className="multiview-drop-hint" aria-hidden="true">
      Drop camera to add to multiview
    </div>
  );

  if (cameras.length === 0) {
    return (
      <Box
        className={`placeholder page-placeholder multiview-empty ${dropZoneClass}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {dropHint}
        <Typography>No cameras configured.</Typography>
        <Typography color="text.secondary">Add a camera from the sidebar to see it here.</Typography>
      </Box>
    );
  }

  return (
    <Box
      className={`multiview-grid layout-sized ${dropZoneClass}`}
      style={{ '--grid-size': gridSize }}
      aria-label={`Camera multiview ${gridSize} by ${gridSize}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dropHint}
      {slots.map((camera, index) => (
        camera ? (
          <MultiviewTile
            key={camera.id}
            camera={camera}
            compact={compact}
            onOpen={onOpenCamera}
            onRemove={onRemoveCamera}
          />
        ) : (
          <MultiviewEmptySlot
            key={`empty-${index}`}
            compact={compact}
            dragging={dragging}
            dropHover={dropHover}
            onCameraDrop={onCameraDrop}
            onDragEnd={onDragEnd}
          />
        )
      ))}
    </Box>
  );
}
