export const DEFAULT_RETENTION_DAYS = 7;
export const MIN_RETENTION_DAYS = 0;
export const MAX_RETENTION_DAYS = 365;

export function clampRetentionDays(value) {
  const rounded = Math.round(Number(value));
  if (!Number.isFinite(rounded)) return DEFAULT_RETENTION_DAYS;
  return Math.min(MAX_RETENTION_DAYS, Math.max(MIN_RETENTION_DAYS, rounded));
}

export function formatRetentionLabel(days) {
  const value = clampRetentionDays(days);
  if (value === 0) return 'never (manual cleanup only)';
  if (value === 1) return '1 day';
  return `${value} days`;
}
