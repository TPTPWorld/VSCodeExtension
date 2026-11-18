import { parentPort, workerData } from 'worker_threads';

import { parseTptpDocument } from './tptpAntlrParser';

if (!parentPort) {
  throw new Error('The ANTLR parser worker must run in a worker thread.');
}

const port = parentPort;
void parseTptpDocument(workerData).then(result => port.postMessage(result));
