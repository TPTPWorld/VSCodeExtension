import { parentPort, workerData } from 'worker_threads';

import { parseTptpDocument } from './tptpAntlrParser';
import type { TptpAntlrWorkerData } from './tptpAntlrWorkerRunner';

if (!parentPort) {
  throw new Error('The ANTLR parser worker must run in a worker thread.');
}

const port = parentPort;
const { text, useOptimizedGrammar } = workerData as TptpAntlrWorkerData;
void parseTptpDocument(text, useOptimizedGrammar).then(result => port.postMessage(result));
