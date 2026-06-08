import os from 'os';

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
