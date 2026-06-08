import Alert from '@mui/material/Alert';
import { formatBytes } from '../api.js';

export default function StorageBanner({ storage }) {
  if (!storage || storage.status === 'ok') return null;

  const isCritical = storage.status === 'critical';

  return (
    <Alert severity={isCritical ? 'error' : 'warning'} sx={{ borderRadius: 0 }}>
      {isCritical ? (
        <>
          <strong>Disk space critically low</strong>
          {' — '}
          {formatBytes(storage.freeBytes)} free on the recordings drive.
          New recordings are blocked and active recordings have been stopped.
        </>
      ) : (
        <>
          <strong>Disk space running low</strong>
          {' — '}
          {formatBytes(storage.freeBytes)} free
          {storage.recordingsBytes != null && (
            <> ({formatBytes(storage.recordingsBytes)} used by DVR)</>
          )}
          . Recordings stop automatically below {formatBytes(storage.criticalFreeBytes)} free.
        </>
      )}
    </Alert>
  );
}
