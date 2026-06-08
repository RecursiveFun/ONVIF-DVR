/**
 * LAN / production-style entry point for the ONVIF-DVR server.
 *
 * Sets default environment variables for binding on all interfaces and serving
 * the built client, then dynamically imports the main server bootstrap (`index.js`).
 */
process.env.HOST ??= '0.0.0.0';
process.env.SERVE_CLIENT ??= 'true';

await import('./index.js');
