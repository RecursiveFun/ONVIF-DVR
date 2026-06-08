import { describe, expect, it } from 'vitest';
import { isHttpStreamUrl } from './streamUrl.js';

describe('streamUrl', () => {
  it('detects http and https camera urls', () => {
    expect(isHttpStreamUrl('http://camera.local/cgi-bin/camera')).toBe(true);
    expect(isHttpStreamUrl('https://camera.local/stream')).toBe(true);
    expect(isHttpStreamUrl('rtsp://camera.local/stream1')).toBe(false);
  });
});
