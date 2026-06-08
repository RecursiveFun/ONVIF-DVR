/**
 * Sidebar settings: theme, segment duration, retention, and recordings folder.
 *
 * Numeric fields commit on blur (or Enter) after validation; folder changes go through
 * DirectoryPicker and save immediately on selection.
 */
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import { formatBytes } from '../api.js';
import DirectoryPicker from './DirectoryPicker.jsx';
import SidebarSection from './SidebarSection.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import {
  clampRetentionDays,
  formatRetentionLabel,
  MAX_RETENTION_DAYS,
  MIN_RETENTION_DAYS,
} from '../utils/retention.js';
import {
  clampSegmentDurationSec,
  formatSegmentDurationLabel,
  segmentDurationMinutes,
  SEGMENT_DURATION_MAX_SEC,
  SEGMENT_DURATION_MIN_SEC,
} from '../utils/segmentDuration.js';

/**
 * @param {object} props
 * @param {object|null} [props.storage] - Disk usage snapshot from the server for the footer readout.
 */
export default function AppSettings({
  theme,
  onThemeChange,
  segmentDurationSec,
  onSegmentDurationChange,
  retentionDays = 7,
  onRetentionDaysChange,
  recordingsDir = '',
  onRecordingsDirChange,
  storage = null,
}) {
  const [minutesInput, setMinutesInput] = useState(String(segmentDurationMinutes(segmentDurationSec)));
  const [retentionDaysInput, setRetentionDaysInput] = useState(String(retentionDays));
  const [recordingsDirInput, setRecordingsDirInput] = useState(recordingsDir);
  const [savingDuration, setSavingDuration] = useState(false);
  const [savingRetention, setSavingRetention] = useState(false);
  const [savingRecordingsDir, setSavingRecordingsDir] = useState(false);
  const [durationError, setDurationError] = useState('');
  const [retentionError, setRetentionError] = useState('');
  const [recordingsDirError, setRecordingsDirError] = useState('');
  const [directoryPickerOpen, setDirectoryPickerOpen] = useState(false);

  // Sync local inputs when parent props change (e.g. after a successful save elsewhere).
  useEffect(() => {
    setMinutesInput(String(segmentDurationMinutes(segmentDurationSec)));
  }, [segmentDurationSec]);

  useEffect(() => {
    setRetentionDaysInput(String(retentionDays));
  }, [retentionDays]);

  useEffect(() => {
    setRecordingsDirInput(recordingsDir);
  }, [recordingsDir]);

  const openDirectoryPicker = () => {
    setDirectoryPickerOpen(true);
  };

  const handleDirectorySelect = async (selectedPath) => {
    setRecordingsDirInput(selectedPath);
    setRecordingsDirError('');
    if (selectedPath === recordingsDir) return;

    setSavingRecordingsDir(true);
    try {
      await onRecordingsDirChange(selectedPath);
    } catch (err) {
      setRecordingsDirError(err.message || 'Failed to save recordings folder.');
      setRecordingsDirInput(recordingsDir);
    } finally {
      setSavingRecordingsDir(false);
    }
  };

  /** Validate, clamp, and persist retention days; revert input on failure. */
  const commitRetentionDays = async () => {
    const days = Number(retentionDaysInput);
    if (!Number.isFinite(days) || days < MIN_RETENTION_DAYS || days > MAX_RETENTION_DAYS) {
      setRetentionError(`Choose between ${MIN_RETENTION_DAYS} and ${MAX_RETENTION_DAYS} days.`);
      setRetentionDaysInput(String(retentionDays));
      return;
    }

    const clamped = clampRetentionDays(days);
    if (clamped === retentionDays) {
      setRetentionError('');
      setRetentionDaysInput(String(clamped));
      return;
    }

    setSavingRetention(true);
    setRetentionError('');
    try {
      await onRetentionDaysChange(clamped);
      setRetentionDaysInput(String(clamped));
    } catch (err) {
      setRetentionError(err.message || 'Failed to save retention period.');
      setRetentionDaysInput(String(retentionDays));
    } finally {
      setSavingRetention(false);
    }
  };

  /** Validate minutes, convert to seconds, and persist; active recordings restart on change. */
  const commitSegmentDuration = async () => {
    const minutes = Number(minutesInput);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setDurationError('Enter a valid number of minutes.');
      setMinutesInput(String(segmentDurationMinutes(segmentDurationSec)));
      return;
    }

    const seconds = clampSegmentDurationSec(minutes * 60);
    const minMinutes = SEGMENT_DURATION_MIN_SEC / 60;
    const maxMinutes = SEGMENT_DURATION_MAX_SEC / 60;
    if (minutes < minMinutes || minutes > maxMinutes) {
      setDurationError(`Choose between ${minMinutes} and ${maxMinutes} minutes.`);
      setMinutesInput(String(segmentDurationMinutes(segmentDurationSec)));
      return;
    }

    if (seconds === segmentDurationSec) {
      setDurationError('');
      setMinutesInput(String(segmentDurationMinutes(seconds)));
      return;
    }

    setSavingDuration(true);
    setDurationError('');
    try {
      await onSegmentDurationChange(seconds);
      setMinutesInput(String(segmentDurationMinutes(seconds)));
    } catch (err) {
      setDurationError(err.message || 'Failed to save segment duration.');
      setMinutesInput(String(segmentDurationMinutes(segmentDurationSec)));
    } finally {
      setSavingDuration(false);
    }
  };

  return (
    <SidebarSection title="Settings" defaultExpanded={false}>
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">Theme</Typography>
          <ThemeToggle theme={theme} onChange={onThemeChange} />
        </Box>

        <Box>
          <TextField
            id="segment-duration-minutes"
            label="Segment duration"
            type="number"
            size="small"
            fullWidth
            value={minutesInput}
            disabled={savingDuration}
            error={Boolean(durationError)}
            helperText={
              durationError
              || `Currently ${formatSegmentDurationLabel(segmentDurationSec)} per file. Active recordings restart briefly when this changes.`
            }
            slotProps={{
              input: {
                endAdornment: <InputAdornment position="end">min</InputAdornment>,
                inputProps: {
                  min: SEGMENT_DURATION_MIN_SEC / 60,
                  max: SEGMENT_DURATION_MAX_SEC / 60,
                  step: 1,
                },
              },
            }}
            onChange={(e) => {
              setMinutesInput(e.target.value);
              setDurationError('');
            }}
            onBlur={() => { commitSegmentDuration(); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
          />
        </Box>

        <Box>
          <TextField
            id="retention-days"
            label="Auto-delete after"
            type="number"
            size="small"
            fullWidth
            value={retentionDaysInput}
            disabled={savingRetention}
            error={Boolean(retentionError)}
            helperText={
              retentionError
              || (retentionDays === 0
                ? 'Automatic cleanup is off — delete old segments manually.'
                : `Recordings older than ${formatRetentionLabel(retentionDays)} are removed automatically.`)
            }
            slotProps={{
              input: {
                endAdornment: <InputAdornment position="end">days</InputAdornment>,
                inputProps: {
                  min: MIN_RETENTION_DAYS,
                  max: MAX_RETENTION_DAYS,
                  step: 1,
                },
              },
            }}
            onChange={(e) => {
              setRetentionDaysInput(e.target.value);
              setRetentionError('');
            }}
            onBlur={() => { commitRetentionDays(); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
          />
        </Box>

        <Box>
          <TextField
            id="recordings-dir"
            label="Recordings folder"
            size="small"
            fullWidth
            value={recordingsDirInput}
            disabled={savingRecordingsDir}
            error={Boolean(recordingsDirError)}
            helperText={
              recordingsDirError
              || 'Click the path or Browse to choose a folder. Existing recordings stay in the old folder until you move them.'
            }
            slotProps={{
              input: {
                readOnly: true,
                sx: { cursor: 'pointer' },
              },
            }}
            onClick={openDirectoryPicker}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openDirectoryPicker();
              }
            }}
          />
          <Button
            size="small"
            startIcon={<FolderOpenOutlinedIcon />}
            sx={{ mt: 1 }}
            disabled={savingRecordingsDir}
            onClick={openDirectoryPicker}
          >
            Browse…
          </Button>
        </Box>

        {storage && (
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Disk space
            </Typography>
            <Typography variant="body2">
              {formatBytes(storage.freeBytes)} free · {formatBytes(storage.recordingsBytes)} DVR
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              Recording stops below {formatBytes(storage.criticalFreeBytes)} free.
              {storage.status === 'low' && ' Space is running low.'}
              {storage.status === 'critical' && ' Space is critically low — recording disabled.'}
            </Typography>
          </Box>
        )}
      </Stack>

      <DirectoryPicker
        open={directoryPickerOpen}
        initialPath={recordingsDirInput || recordingsDir}
        onSelect={handleDirectorySelect}
        onClose={() => setDirectoryPickerOpen(false)}
      />
    </SidebarSection>
  );
}
