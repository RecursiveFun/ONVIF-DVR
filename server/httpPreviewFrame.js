/**
 * Fetch a single JPEG frame from an HTTP/MJPEG camera URL for sidebar previews.
 */

const SOI = Buffer.from([0xff, 0xd8]);
const EOI = Buffer.from([0xff, 0xd9]);

/**
 * @param {Buffer} buffer
 * @returns {Buffer | null}
 */
export function extractFirstJpeg(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const start = buf.indexOf(SOI);
  if (start < 0) return null;
  const end = buf.indexOf(EOI, start + 2);
  if (end < 0) return null;
  return buf.subarray(start, end + 2);
}

/**
 * @param {string} url
 * @param {number} [maxBytes]
 * @returns {Promise<Buffer>}
 */
export async function fetchHttpPreviewJpeg(url, maxBytes = 2_000_000) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'ONVIF-DVR/1.0' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`Camera returned ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('Empty response body');

  const chunks = [];
  let total = 0;

  while (total < maxBytes) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(Buffer.from(value));
    total += value.length;
    const frame = extractFirstJpeg(Buffer.concat(chunks));
    if (frame) {
      await reader.cancel().catch(() => {});
      return frame;
    }
  }

  throw new Error('No JPEG frame received');
}
