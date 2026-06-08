/**
 * Probe HTTP camera URLs to pick the right FFmpeg demuxer.
 * IP cameras vary: raw MJPEG, MIME multipart (mpjpeg), or need auto-detect.
 */

export const HTTP_INPUT_FORMATS = ['mjpeg', 'mpjpeg', 'auto'];

/**
 * @param {string | undefined} contentType
 * @param {Uint8Array | Buffer | null | undefined} firstChunk
 * @returns {'mjpeg' | 'mpjpeg' | 'auto'}
 */
export function detectHttpInputFormat(contentType, firstChunk) {
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('multipart/x-mixed-replace') || ct.includes('multipart/mixed')) {
    return 'mpjpeg';
  }

  if (firstChunk?.length) {
    const head = Buffer.from(firstChunk.slice(0, Math.min(256, firstChunk.length))).toString('latin1');
    if (head.includes('multipart')) return 'mpjpeg';
    if (firstChunk[0] === 0xff && firstChunk[1] === 0xd8) return 'mjpeg';
  }

  if (ct.includes('image/jpeg') || ct.includes('video/x-motion-jpeg')) {
    return 'mjpeg';
  }

  return 'auto';
}

/**
 * @param {string} url
 * @returns {Promise<'mjpeg' | 'mpjpeg' | 'auto'>}
 */
export async function probeHttpStreamFormat(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ONVIF-DVR/1.0' },
      signal: AbortSignal.timeout(10_000),
    });

    const contentType = res.headers.get('content-type') || '';
    if (!res.ok) {
      return detectHttpInputFormat(contentType, null);
    }

    const reader = res.body?.getReader();
    if (!reader) return detectHttpInputFormat(contentType, null);

    const { value } = await reader.read();
    await reader.cancel().catch(() => {});
    return detectHttpInputFormat(contentType, value);
  } catch {
    return 'mjpeg';
  }
}

/**
 * @param {string | null | undefined} current
 * @returns {'mjpeg' | 'mpjpeg' | 'auto' | null} Next format, or null when exhausted.
 */
export function nextHttpInputFormat(current) {
  const format = current && HTTP_INPUT_FORMATS.includes(current) ? current : 'mjpeg';
  const index = HTTP_INPUT_FORMATS.indexOf(format);
  const next = HTTP_INPUT_FORMATS[index + 1];
  return next ?? null;
}
