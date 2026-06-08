/**
 * Probe RTSP URLs for an audio stream so FFmpeg output args can omit unused codecs.
 */
import { spawn } from 'child_process';
import { resolveFfprobePath } from './ffmpegUtil.js';

/** @param {string} stdout */
export function parseFfprobeHasAudio(stdout) {
  return stdout.trim().toLowerCase() === 'audio';
}

/**
 * @param {string} url
 * @param {number} [timeoutMs]
 * @returns {Promise<boolean>}
 */
export function probeRtspHasAudio(url, timeoutMs = 12_000) {
  const ffprobe = resolveFfprobePath();
  if (!ffprobe) return Promise.resolve(false);

  return new Promise((resolve) => {
    const args = [
      '-hide_banner',
      '-v', 'error',
      '-rtsp_transport', 'tcp',
      '-analyzeduration', '5M',
      '-probesize', '5M',
      '-select_streams', 'a:0',
      '-show_entries', 'stream=codec_type',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      url,
    ];

    const child = spawn(ffprobe, args, { windowsHide: true });
    let stdout = '';
    let settled = false;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        child.kill();
      } catch {
        // ignore
      }
      resolve(value);
    };

    const timer = setTimeout(() => finish(false), timeoutMs);

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.on('error', () => finish(false));
    child.on('close', (code) => {
      finish(code === 0 && parseFfprobeHasAudio(stdout));
    });
  });
}
