import * as path from 'path';
import * as vscode from 'vscode';

import { errorMessage } from '../errorMessage';
import {
  getSzsOutput,
  getSzsStatus,
  getSzsStatusMessage
} from '../systemB4TptpOutput';
import {
  createLeoIIITypeErrorDiagnostics,
  formatTypeCheckStatusMessage,
  getLeoIIITypeErrors
} from './errors';

const SYSTEM_ON_TPTP_URL = 'https://tptp.org/cgi-bin/SystemOnTPTPFormReply';
const LEO_III_STC = 'Leo-III-STC---'; // SystemB4TPTP will automatically run the latest version of LEO-III-STC it has available
const TYPE_CHECK_RUNNING_CONTEXT_KEY = 'tptp.typeCheckRunning';
const TYPE_CHECK_TIMEOUT_SEC = 60; // TODO: make this configurable
const TYPE_CHECK_REQUEST_TIMEOUT_MS = 75000; // TODO: make this configurable

function createLeoIIITypeCheckForm(document: vscode.TextDocument): FormData {
  const form = new FormData();

  // These are the fields used by RemoteSoT.py for one selected system.
  form.append('NoHTML', '1');
  form.append('QuietFlag', '-q1');
  form.append('SubmitButton', 'RunSelectedSystems');
  form.append('X2TPTP', '');
  form.append('ProblemSource', 'UPLOAD');
  form.append(`System___${LEO_III_STC}`, LEO_III_STC);
  form.append(`TimeLimit___${LEO_III_STC}`, String(TYPE_CHECK_TIMEOUT_SEC));
  form.append(
    'UPLOADProblem',
    new Blob([document.getText()], { type: 'text/plain' }),
    path.basename(document.fileName) || 'problem.p'
  );

  return form;
}

/**
 * Runs the complete remote request with visible progress, cancellation, and a timeout.
 *
 * @returns The response body for a successful request, or `undefined` when the user
 * cancels the operation. User cancellation is therefore an expected outcome rather
 * than an error.
 * @throws An error when the request times out, returns a non-successful HTTP status,
 * encounters a network failure, or fails while reading the response body.
 */
async function requestLeoIIITypeCheck(
  document: vscode.TextDocument
): Promise<string | undefined> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Type-checking with LEO-III-STC',
      cancellable: true
    },
    async (progress, token) => {
      const controller = new AbortController();
      let timedOut = false;

      progress.report({ message: 'Waiting for tptp.org...' });
      const cancellation = token.onCancellationRequested(() => {
        controller.abort();
      });
      const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, TYPE_CHECK_REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(SYSTEM_ON_TPTP_URL, {
          method: 'POST',
          body: createLeoIIITypeCheckForm(document),
          signal: controller.signal
        });

        if (token.isCancellationRequested) {
          return undefined;
        }
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText || 'request failed'}`);
        }

        const output = await response.text();
        return token.isCancellationRequested ? undefined : output;
      } catch (error: unknown) {
        if (token.isCancellationRequested) {
          return undefined;
        }
        if (timedOut) {
          throw new Error(
            `LEO-III-STC type check timed out after ${TYPE_CHECK_REQUEST_TIMEOUT_MS / 1000} seconds.`
          );
        }
        throw error;
      } finally {
        clearTimeout(timeout);
        cancellation.dispose();
      }
    }
  );
}

/** Registers the command that asks LEO-III-STC on SystemB4TPTP to type-check a TPTP document. */
export function registerTypeCheckCommand(): vscode.Disposable {
  let typeCheckRunning = false;

  const diagnostics = vscode.languages.createDiagnosticCollection('tptpTypeCheck');
  const command = vscode.commands.registerCommand('tptp.typeCheck', async (uri?: vscode.Uri) => {
    if (typeCheckRunning) {
      vscode.window.showInformationMessage('LEO-III-STC is already checking types.');
      return;
    }

    if (!uri) {
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor) {
        vscode.window.showErrorMessage('No TPTP file is currently open.');
        return;
      }
      uri = activeEditor.document.uri;
    }

    typeCheckRunning = true;
    try {
      await vscode.commands.executeCommand('setContext', TYPE_CHECK_RUNNING_CONTEXT_KEY, true);

      const document = await vscode.workspace.openTextDocument(uri);
      const checkedDocumentVersion = document.version;
      diagnostics.delete(document.uri);
      const output = await requestLeoIIITypeCheck(document);
      if (output === undefined) {
        vscode.window.showInformationMessage('LEO-III-STC type check cancelled.');
        return;
      }
      if (document.version !== checkedDocumentVersion) {
        vscode.window.showErrorMessage(
          'TPTP file changed while type-checking. Please run the type-checker again.'
        );
        return;
      }

      const status = getSzsStatus(output);
      const statusMessage = formatTypeCheckStatusMessage(
        status,
        getSzsStatusMessage(output)
      );
      const szsOutput = getSzsOutput(output);
      const outputSuffix = [statusMessage, szsOutput]
        .filter((message): message is string => Boolean(message)) // discard '' or undefined
        .map(message => `\n${message}`)
        .join('');
      if (status === 'Success') {
        vscode.window.showInformationMessage(`LEO-III-STC type check succeeded.`);
      } else if (status === 'TypeError') {
        const typeErrors = getLeoIIITypeErrors(szsOutput ?? output);
        diagnostics.set(
          document.uri,
          createLeoIIITypeErrorDiagnostics(document, typeErrors)
        );
        vscode.window.showErrorMessage(
          `LEO-III-STC found type error(s).${outputSuffix}`
        );
      } else if (status) {
        vscode.window.showErrorMessage(`LEO-III-STC reported ${status}.${outputSuffix}`);
      } else {
        vscode.window.showErrorMessage(`LEO-III-STC returned an unrecognized response: ${output}`);
      }
    } catch (error: unknown) {
      vscode.window.showErrorMessage(
        `Failed to check types with LEO-III-STC: ${errorMessage(error)}`
      );
    } finally {
      typeCheckRunning = false;
      await vscode.commands.executeCommand('setContext', TYPE_CHECK_RUNNING_CONTEXT_KEY, false);
    }
  });

  return vscode.Disposable.from(
    diagnostics,
    command,
    vscode.workspace.onDidChangeTextDocument(event => {
      diagnostics.delete(event.document.uri);
    })
  );
}
