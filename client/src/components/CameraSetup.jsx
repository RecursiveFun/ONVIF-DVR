import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { api } from '../api.js';
import SidebarSection from './SidebarSection.jsx';

function requireCredentials(user, pass) {
  if (!user?.trim()) return 'Enter the ONVIF username first (above the device list).';
  if (!pass) return 'Enter the ONVIF password first (above the device list).';
  return null;
}

export default function CameraSetup({ onAdded }) {
  const [name, setName] = useState('');
  const [rtspUrl, setRtspUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hints, setHints] = useState([]);
  const [tab, setTab] = useState('manual');

  const [onvifHost, setOnvifHost] = useState('');
  const [onvifPort, setOnvifPort] = useState('80');
  const [onvifUser, setOnvifUser] = useState('');
  const [onvifPass, setOnvifPass] = useState('');
  const [devices, setDevices] = useState([]);
  const [discovering, setDiscovering] = useState(false);

  const submitManual = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cam = await api.addCamera({ name: name || 'Camera', rtspUrl });
      onAdded(cam);
      setName('');
      setRtspUrl('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const discover = async () => {
    setError('');
    setHints([]);
    setDiscovering(true);
    try {
      const result = await api.discoverOnvif();
      setDevices(result.devices || []);
      setHints(result.hints || []);
      if (!result.devices?.length) {
        setError('No ONVIF devices found via network scan.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setDiscovering(false);
    }
  };

  const connectByIp = async () => {
    const credErr = requireCredentials(onvifUser, onvifPass);
    if (credErr) { setError(credErr); return; }
    if (!onvifHost.trim()) {
      setError('Enter the camera IP address.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await api.connectOnvifHost({
        hostname: onvifHost.trim(),
        port: parseInt(onvifPort, 10) || 80,
        username: onvifUser,
        password: onvifPass,
      });
      setRtspUrl(result.rtspUrl);
      setName(name || onvifHost.trim());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStreamUri = async (device) => {
    const credErr = requireCredentials(onvifUser, onvifPass);
    if (credErr) { setError(credErr); return; }
    setError('');
    setLoading(true);
    try {
      const { rtspUrl: uri } = await api.getOnvifStreamUri({
        hostname: device.hostname,
        port: device.port,
        path: device.path,
        secure: device.secure,
        username: onvifUser,
        password: onvifPass,
      });
      setRtspUrl(uri);
      setName(device.name || device.hostname);
      setOnvifHost(device.hostname);
      setOnvifPort(String(device.port || 80));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const submitOnvif = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let url = rtspUrl;
      if (!url && onvifHost) {
        const credErr = requireCredentials(onvifUser, onvifPass);
        if (credErr) { setError(credErr); setLoading(false); return; }
        const result = await api.connectOnvifHost({
          hostname: onvifHost.trim(),
          port: parseInt(onvifPort, 10) || 80,
          username: onvifUser,
          password: onvifPass,
        });
        url = result.rtspUrl;
      }
      const cam = await api.addCamera({ name: name || onvifHost, rtspUrl: url });
      onAdded(cam);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SidebarSection title="Add Camera" defaultExpanded={false}>
      <Tabs
        value={tab}
        onChange={(_e, value) => setTab(value)}
        variant="fullWidth"
        sx={{ mb: 2, minHeight: 36 }}
      >
        <Tab label="RTSP URL" value="manual" sx={{ minHeight: 36, py: 0.5 }} />
        <Tab label="ONVIF Discovery" value="onvif" sx={{ minHeight: 36, py: 0.5 }} />
      </Tabs>

      {tab === 'manual' ? (
        <Stack component="form" spacing={1.5} onSubmit={submitManual}>
          <TextField
            label="Name"
            size="small"
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Front Door"
          />
          <TextField
            label="RTSP URL"
            size="small"
            fullWidth
            required
            value={rtspUrl}
            onChange={(e) => setRtspUrl(e.target.value)}
            placeholder="rtsp://user:pass@192.168.1.100:554/stream1"
          />
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? 'Adding…' : 'Add Camera'}
          </Button>
        </Stack>
      ) : (
        <Stack spacing={2}>
          <Box>
            <Typography variant="subtitle2" gutterBottom>ONVIF credentials</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                label="Username"
                size="small"
                fullWidth
                value={onvifUser}
                onChange={(e) => setOnvifUser(e.target.value)}
              />
              <TextField
                label="Password"
                type="password"
                size="small"
                fullWidth
                value={onvifPass}
                onChange={(e) => setOnvifPass(e.target.value)}
              />
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              ONVIF login is often different from the RTSP URL credentials.
            </Typography>
          </Box>

          <Button variant="outlined" onClick={discover} disabled={discovering}>
            {discovering ? 'Scanning network…' : 'Scan Network (multicast)'}
          </Button>

          {hints.length > 0 && (
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {hints.map((h) => (
                <Typography key={h} component="li" variant="caption" color="text.secondary">{h}</Typography>
              ))}
            </Box>
          )}

          {devices.length > 0 && (
            <Stack spacing={1}>
              {devices.map((d) => (
                <Box
                  key={d.urn}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2">{d.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {d.hostname}:{d.port}
                    </Typography>
                  </Box>
                  <Button size="small" onClick={() => fetchStreamUri(d)} disabled={loading}>
                    Get RTSP
                  </Button>
                </Box>
              ))}
            </Stack>
          )}

          <Stack component="form" spacing={1.5} onSubmit={submitOnvif}>
            <Typography variant="subtitle2">Connect by IP (if scan finds nothing)</Typography>
            <Stack direction="row" spacing={1}>
              <TextField
                label="Camera IP / hostname"
                size="small"
                fullWidth
                value={onvifHost}
                onChange={(e) => setOnvifHost(e.target.value)}
                placeholder="10.0.0.100"
              />
              <TextField
                label="Port"
                size="small"
                sx={{ width: 90 }}
                value={onvifPort}
                onChange={(e) => setOnvifPort(e.target.value)}
                placeholder="80"
              />
            </Stack>
            <Button variant="outlined" onClick={connectByIp} disabled={loading || !onvifHost.trim()}>
              {loading ? 'Connecting…' : 'Connect by IP'}
            </Button>
            <TextField
              label="RTSP URL (auto-filled from ONVIF)"
              size="small"
              fullWidth
              required
              value={rtspUrl}
              onChange={(e) => setRtspUrl(e.target.value)}
              placeholder="rtsp://…"
            />
            <Button type="submit" variant="contained" disabled={loading || !rtspUrl}>
              {loading ? 'Adding…' : 'Add Camera'}
            </Button>
          </Stack>
        </Stack>
      )}

      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
    </SidebarSection>
  );
}
