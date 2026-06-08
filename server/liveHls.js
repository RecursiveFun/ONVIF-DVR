/** @param {string} name */
export function isLiveHlsArtifact(name) {
  return name === 'index.m3u8' || /^seg_.*\.ts$/i.test(name);
}
