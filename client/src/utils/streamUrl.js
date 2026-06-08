/** @param {string | null | undefined} url */
export function isHttpStreamUrl(url) {
  return /^https?:\/\//i.test((url || '').trim());
}
