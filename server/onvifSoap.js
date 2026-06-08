import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { parseSOAPString, linerase } = require('onvif/lib/utils');

export { parseSOAPString, linerase };
