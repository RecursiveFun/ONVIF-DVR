/**
 * MUI chip labels and colors for camera session status from the API.
 */

export function statusLabel(status) {
  if (!status) return '';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function statusColor(status) {
  if (status === 'live') return 'success';
  if (status === 'recording') return 'error';
  return 'default';
}
