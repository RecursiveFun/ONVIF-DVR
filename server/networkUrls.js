/**
 * LAN URL helpers for the HTTP server.
 *
 * Enumerates non-loopback IPv4 addresses on the host so startup logs can show
 * URLs other devices on the local network can use to reach the DVR UI.
 */
import os from 'os';

/**
 * Build http:// URLs for each external IPv4 interface on this machine.
 * @param {number | string} port TCP port the server is listening on.
 * @returns {string[]} One URL per eligible interface, e.g. `http://192.168.1.10:3001`.
 */
export function listLanUrls(port) {
  const urls = [];
  for (const nets of Object.values(os.networkInterfaces())) {
    for (const net of nets ?? []) {
      if ((net.family === 'IPv4' || net.family === 4) && !net.internal) {
        urls.push(`http://${net.address}:${port}`);
      }
    }
  }
  return urls;
}
