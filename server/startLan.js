process.env.HOST ??= '0.0.0.0';
process.env.SERVE_CLIENT ??= 'true';

await import('./index.js');
