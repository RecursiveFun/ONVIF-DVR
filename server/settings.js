import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { assertUnderBrowseRoots } from './security.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
export const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

export const DEFAULT_SEGMENT_SECONDS = 300;
export const MIN_SEGMENT_SECONDS = 60;
export const MAX_SEGMENT_SECONDS = 3600;
export const DEFAULT_RECORDINGS_DIR = path.join(DATA_DIR, 'recordings');
export const DEFAULT_RETENTION_DAYS = 7;
export const MIN_RETENTION_DAYS = 0;
export const MAX_RETENTION_DAYS = 365;

const defaults = {
  segmentDurationSec: DEFAULT_SEGMENT_SECONDS,
  recordingsDir: DEFAULT_RECORDINGS_DIR,
  retentionDays: DEFAULT_RETENTION_DAYS,
};

/** @type {{ segmentDurationSec: number, recordingsDir: string, retentionDays: number }} */
let cached = { ...defaults };

export function clampRetentionDays(value) {
  const rounded = Math.round(Number(value));
  if (!Number.isFinite(rounded)) return DEFAULT_RETENTION_DAYS;
  return Math.min(MAX_RETENTION_DAYS, Math.max(MIN_RETENTION_DAYS, rounded));
}

export function clampSegmentSeconds(value) {
  const rounded = Math.round(Number(value));
  if (!Number.isFinite(rounded)) return DEFAULT_SEGMENT_SECONDS;
  return Math.min(MAX_SEGMENT_SECONDS, Math.max(MIN_SEGMENT_SECONDS, rounded));
}

export function resolveRecordingsDir(input) {
  const trimmed = typeof input === 'string' ? input.trim() : '';
  if (!trimmed) return DEFAULT_RECORDINGS_DIR;
  if (path.isAbsolute(trimmed)) return path.normalize(trimmed);
  return path.resolve(PROJECT_ROOT, trimmed);
}

export function validateRecordingsDir(input) {
  const resolved = resolveRecordingsDir(input);
  assertUnderBrowseRoots(resolved);
  try {
    fs.mkdirSync(resolved, { recursive: true });
    fs.accessSync(resolved, fs.constants.W_OK);
  } catch {
    throw new Error(`Recordings folder is not writable: ${resolved}`);
  }
  return resolved;
}

function normalizeSettings(input, { validateRecordings = false } = {}) {
  const recordingsInput = input?.recordingsDir ?? DEFAULT_RECORDINGS_DIR;
  const recordingsDir = validateRecordings
    ? validateRecordingsDir(recordingsInput)
    : resolveRecordingsDir(recordingsInput);

  if (!validateRecordings) {
    try {
      fs.mkdirSync(recordingsDir, { recursive: true });
    } catch {
      // keep configured path even if the folder cannot be created yet
    }
  }

  return {
    segmentDurationSec: clampSegmentSeconds(
      input?.segmentDurationSec ?? DEFAULT_SEGMENT_SECONDS,
    ),
    recordingsDir,
    retentionDays: clampRetentionDays(input?.retentionDays ?? DEFAULT_RETENTION_DAYS),
  };
}

function loadSettings() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SETTINGS_FILE)) return { ...defaults };
  try {
    return normalizeSettings(JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')));
  } catch (e) {
    console.error('Failed to load settings.json:', e.message);
    return { ...defaults };
  }
}

function saveSettings() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(cached, null, 2));
}

export function getSettings() {
  return { ...cached };
}

export function getSegmentSeconds() {
  return cached.segmentDurationSec;
}

export function getRecordingsDir() {
  return cached.recordingsDir;
}

export function getRetentionDays() {
  return cached.retentionDays;
}

export function ensureRecordingsDir() {
  const dir = getRecordingsDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function updateSettings(partial) {
  const next = { ...cached };

  if (partial?.segmentDurationSec !== undefined) {
    next.segmentDurationSec = clampSegmentSeconds(partial.segmentDurationSec);
  }

  if (partial?.recordingsDir !== undefined) {
    next.recordingsDir = validateRecordingsDir(partial.recordingsDir);
  }

  if (partial?.retentionDays !== undefined) {
    next.retentionDays = clampRetentionDays(partial.retentionDays);
  }

  cached = next;
  saveSettings();
  return { ...cached };
}

/** @internal test helper */
export function resetSettingsForTests(next = defaults) {
  cached = normalizeSettings(next);
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      fs.unlinkSync(SETTINGS_FILE);
    } catch {
      // ignore
    }
  }
}

cached = loadSettings();
