/**
 * ONVIF SOAP parsing bridge.
 *
 * Re-exports `parseSOAPString` and `linerase` from the `onvif` package using
 * CommonJS `require` so ESM callers can parse WS-Discovery probe responses.
 */
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { parseSOAPString, linerase } = require('onvif/lib/utils');

export { parseSOAPString, linerase };
