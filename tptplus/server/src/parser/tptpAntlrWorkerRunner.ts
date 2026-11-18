import * as path from 'path';
import { Worker } from 'worker_threads';
import {
  CancellationToken,
  Disposable,
  LSPErrorCodes,
  ResponseError,
} from 'vscode-languageserver/node';

import type { TptpAntlrParseResult } from './tptpAntlrParser';

function cancelled(): ResponseError<void> {
  return new ResponseError(LSPErrorCodes.RequestCancelled, 'ANTLR parse cancelled.');
}

/** Runs CPU-bound parsing off the server thread, with cancellation and no deadline. */
export function parseTptpDocumentInWorker(
  text: string,
  token: CancellationToken
): Promise<TptpAntlrParseResult> {
  if (token.isCancellationRequested) {
    return Promise.reject(cancelled());
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'tptpAntlrWorker.js'), {
      workerData: text,
    });
    let settled = false;
    let cancellation: Disposable | undefined;

    const finish = (complete: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      cancellation?.dispose();
      // Termination interrupts synchronous ANTLR work; a message to the worker
      // could only be handled after parsing finishes. Wait for it to exit before
      // settling the request, including on success and failure.
      void worker.terminate().then(complete, reject);
    };

    worker.once('message', (result: TptpAntlrParseResult) => {
      if (token.isCancellationRequested) {
        finish(() => reject(cancelled()));
      } else {
        finish(() => resolve(result));
      }
    });
    worker.once('error', error => finish(() => reject(error)));
    worker.once('exit', code => {
      finish(() => reject(new Error(
        `ANTLR parser worker exited without returning a result (code ${code}).`
      )));
    });
    cancellation = token.onCancellationRequested(() => finish(() => reject(cancelled())));
    if (token.isCancellationRequested) {
      finish(() => reject(cancelled()));
    }
  });
}
