import dgram from 'dgram';
import os from 'os';
import onvif from 'onvif';
import { parseSOAPString, linerase } from './onvifSoap.js';

const MULTICAST = '239.255.255.250';
const WS_DISCOVERY_PORT = 3702;

function guid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function buildProbeMessage(messageId = guid()) {
  return Buffer.from(
    '<Envelope xmlns="http://www.w3.org/2003/05/soap-envelope" xmlns:dn="http://www.onvif.org/ver10/network/wsdl">' +
      '<Header>' +
      '<wsa:MessageID xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing">urn:uuid:' + messageId + '</wsa:MessageID>' +
      '<wsa:To xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing">urn:schemas-xmlsoap-org:ws:2005:04:discovery</wsa:To>' +
      '<wsa:Action xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing">http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</wsa:Action>' +
      '</Header>' +
      '<Body>' +
      '<Probe xmlns="http://schemas.xmlsoap.org/ws/2005/04/discovery">' +
      '<Types>dn:NetworkVideoTransmitter</Types>' +
      '<Scopes />' +
      '</Probe>' +
      '</Body>' +
      '</Envelope>'
  );
}

function isIPv4(family) {
  return family === 'IPv4' || family === 4;
}

function parseXaddr(xaddr, fallbackHost) {
  try {
    const u = new URL(xaddr);
    return {
      hostname: u.hostname || fallbackHost,
      port: u.port ? parseInt(u.port, 10) : (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname || '/onvif/device_service',
      secure: u.protocol === 'https:',
    };
  } catch {
    return null;
  }
}

function embedRtspCredentials(rtspUrl, username, password) {
  if (!username || !password || !rtspUrl || rtspUrl.includes('@')) return rtspUrl;
  const m = rtspUrl.match(/^rtsp:\/\/(.+)$/i);
  if (!m) return rtspUrl;
  return `rtsp://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${m[1]}`;
}

function isAuthError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return msg.includes('authority') || msg.includes('authorized') || msg.includes('authentication')
    || msg.includes('401') || msg.includes('unauthorized');
}

export function listNetworkInterfaces() {
  const nets = os.networkInterfaces();
  const result = [];
  for (const [name, addrs] of Object.entries(nets)) {
    for (const addr of addrs || []) {
      if (!isIPv4(addr.family) || addr.internal) continue;
      result.push({ name, address: addr.address, netmask: addr.netmask });
    }
  }
  return result;
}

function normalizeDevice(data, rinfo) {
  const match = data?.probeMatches?.probeMatch;
  if (!match) return null;

  const urn = match.endpointReference?.address || match.endpointreference?.address;
  const xaddrs = (match.XAddrs || match.xaddrs || '').split(/\s+/).filter(Boolean);
  const parsed = xaddrs.map((x) => parseXaddr(x, rinfo.address)).find(Boolean);

  return {
    urn: urn || `${rinfo.address}`,
    name: match.scopes?.match(/onvif:\/\/www\.onvif\.org\/name\/([^\s]+)/)?.[1]?.replace(/_/g, ' ')
      || parsed?.hostname
      || rinfo.address,
    hostname: parsed?.hostname || rinfo.address,
    port: parsed?.port || 80,
    path: parsed?.path || '/onvif/device_service',
    secure: parsed?.secure || false,
    xaddrs,
  };
}

function probeTarget({ bindAddress, targetHost, timeoutMs = 8000 }) {
  return new Promise((resolve) => {
    const found = new Map();
    const request = buildProbeMessage();
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    const finish = () => {
      try { socket.close(); } catch { /* ignore */ }
      resolve([...found.values()]);
    };

    const timer = setTimeout(finish, timeoutMs);

    socket.on('error', () => {
      clearTimeout(timer);
      finish();
    });

    socket.on('message', (msg, rinfo) => {
      parseSOAPString(msg.toString(), (err, data) => {
        if (err || !data?.[0]?.probeMatches) return;
        const flat = linerase(data);
        const device = normalizeDevice(flat, rinfo);
        if (device) found.set(device.urn, device);
      });
    });

    const sendProbe = () => {
      socket.send(request, 0, request.length, WS_DISCOVERY_PORT, targetHost, (err) => {
        if (err) {
          clearTimeout(timer);
          finish();
        }
      });
    };

    if (bindAddress) socket.bind(0, bindAddress, sendProbe);
    else sendProbe();
  });
}

export async function discoverDevices(timeoutMs = 10000) {
  const interfaces = listNetworkInterfaces();
  const seen = new Map();

  const probes = [
    ...interfaces.map((iface) =>
      probeTarget({ bindAddress: iface.address, targetHost: MULTICAST, timeoutMs })
    ),
    probeTarget({ bindAddress: null, targetHost: MULTICAST, timeoutMs }),
  ];

  const results = await Promise.all(probes);
  for (const list of results) {
    for (const device of list) seen.set(device.urn, device);
  }

  if (seen.size === 0) {
    const legacy = await legacyProbe(timeoutMs);
    for (const device of legacy) seen.set(device.urn, device);
  }

  return {
    devices: [...seen.values()],
    interfaces: interfaces.map((i) => i.address),
    hints: seen.size === 0
      ? [
          'WS-Discovery uses UDP port 3702 — allow it in Windows Firewall.',
          'Cameras must be on the same subnet as this PC.',
          'Enter credentials above, then use Connect by IP if scan finds nothing.',
        ]
      : [],
  };
}

function legacyProbe(timeoutMs) {
  return new Promise((resolve) => {
    onvif.Discovery.probe({ timeout: timeoutMs, resolve: false }, (err, cams) => {
      if (err || !cams?.length) return resolve([]);
      resolve(
        cams.map((d) => {
          const flat = linerase(d);
          const match = flat.probeMatches?.probeMatch || flat;
          const xaddrs = match.XAddrs ? String(match.XAddrs).split(/\s+/) : [];
          const parsed = xaddrs.map((x) => parseXaddr(x, match.hostname)).find(Boolean);
          return {
            urn: match.endpointReference?.address || guid(),
            name: match.hostname || 'ONVIF device',
            hostname: parsed?.hostname || match.hostname,
            port: parsed?.port || match.port || 80,
            path: parsed?.path || '/onvif/device_service',
            xaddrs,
          };
        })
      );
    });
  });
}

export async function probeHost(hostname, timeoutMs = 5000) {
  const interfaces = listNetworkInterfaces();
  const seen = new Map();
  const probes = interfaces.length
    ? interfaces.map((iface) =>
        probeTarget({ bindAddress: iface.address, targetHost: hostname, timeoutMs })
      )
    : [probeTarget({ bindAddress: null, targetHost: hostname, timeoutMs })];

  const results = await Promise.all(probes);
  for (const list of results) {
    for (const device of list) seen.set(device.urn, device);
  }
  return [...seen.values()];
}

function connectCam(options) {
  return new Promise((resolve, reject) => {
    const cam = new onvif.Cam(options, (err) => {
      if (err) return reject(err);
      cam.getStreamUri({ protocol: 'RTSP' }, (err2, stream) => {
        if (err2) return reject(err2);
        resolve({
          cam,
          rtspUrl: stream.uri,
          deviceInfo: {
            manufacturer: cam.deviceInformation?.manufacturer,
            model: cam.deviceInformation?.model,
            firmware: cam.deviceInformation?.firmwareVersion,
          },
        });
      });
    });
  });
}

function connectionAttempts({ hostname, port, username, password, path, secure }) {
  const paths = [...new Set([
    path,
    '/onvif/device_service',
    '/onvif/device_service.cgi',
    '/onvif/services',
  ].filter(Boolean))];

  const attempts = [];
  for (const p of paths) {
    for (const useWSSecurity of [true, false]) {
      attempts.push({
        hostname,
        port: port || (secure ? 443 : 80),
        username: username || '',
        password: password || '',
        path: p,
        useWSSecurity,
        useSecure: secure || false,
      });
    }
  }
  return attempts;
}

/**
 * Connect to an ONVIF device and return RTSP stream URI.
 */
export async function getStreamUri({ hostname, port = 80, username, password, path, secure }) {
  if (!username?.trim() || !password) {
    throw new Error('ONVIF username and password are required (may differ from RTSP-only credentials).');
  }

  const attempts = connectionAttempts({ hostname, port, username, password, path, secure });
  let lastError;

  for (const opts of attempts) {
    try {
      const result = await connectCam(opts);
      return {
        rtspUrl: embedRtspCredentials(result.rtspUrl, username, password),
        deviceInfo: result.deviceInfo,
        authMethod: opts.useWSSecurity ? 'ws-security' : 'http-digest',
        onvifPath: opts.path,
      };
    } catch (err) {
      lastError = err;
      if (!isAuthError(err)) break;
    }
  }

  const msg = String(lastError?.message || lastError || 'ONVIF connection failed');
  if (isAuthError(lastError)) {
    throw new Error(
      `ONVIF authentication failed for ${hostname}. Check username/password — ONVIF credentials are often separate from the RTSP URL. (${msg})`
    );
  }
  throw lastError;
}

export async function connectByHost({ hostname, port, username, password }) {
  const probed = await probeHost(hostname);
  const device = probed[0];
  return getStreamUri({
    hostname,
    port: device?.port || port || 80,
    username,
    password,
    path: device?.path,
    secure: device?.secure,
  });
}
