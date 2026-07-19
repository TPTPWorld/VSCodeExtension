import * as vscode from 'vscode';

import { errorMessage } from '../errorMessage';
import {
  createJJParserDiagnosticLocation,
  revealJJParserErrorLocation,
  setJJParserErrorDiagnostic
} from './diagnostics';
import { formatTptpLocally } from './local';
import { formatTptpWithFallback } from './workflow';
import { formatTptpRemotely } from './remote';
import {
  isPrettyPrintVersionKnownFormatted,
  markPrettyPrintVersionFormatted
} from './state';
import type { PrettyPrintOutcome } from './types';

const PRETTY_PRINT_COMMAND = 'tptp.prettyPrint';
const PRETTY_PRINT_RUNNING_CONTEXT_KEY = 'tptp.prettyPrintRunning';

async function setPrettyPrintRunningContext(running: boolean): Promise<void> {
  await vscode.commands.executeCommand(
    'setContext',
    PRETTY_PRINT_RUNNING_CONTEXT_KEY,
    running
  );
}

function getTargetUri(uri?: vscode.Uri): vscode.Uri | undefined {
  return uri ?? vscode.window.activeTextEditor?.document.uri;
}

interface DocumentSnapshot {
  version: number;
  text: string;
}

type ApplyPrettyPrintResult = 'applied' | 'rejected' | 'stale' | 'unchanged';

/** Applies formatted text only when the document still matches the input snapshot. */
async function applyPrettyPrintResult(
  document: vscode.TextDocument,
  snapshot: DocumentSnapshot,
  output: string
): Promise<ApplyPrettyPrintResult> {
  if (document.version !== snapshot.version) {
    return 'stale';
  }

  if (snapshot.text === output) {
    return 'unchanged';
  }

  const edit = new vscode.WorkspaceEdit();
  const fullTextRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(snapshot.text.length)
  );
  edit.replace(document.uri, fullTextRange, output);

  return await vscode.workspace.applyEdit(edit) ? 'applied' : 'rejected';
}

async function reportSourceError(
  diagnostics: vscode.DiagnosticCollection,
  document: vscode.TextDocument,
  outcome: Extract<PrettyPrintOutcome, { kind: 'source-error' }>
): Promise<void> {
  const errorLocation = createJJParserDiagnosticLocation(
    document,
    outcome.message,
    outcome.location
  );
  setJJParserErrorDiagnostic(diagnostics, document, errorLocation);
  await revealJJParserErrorLocation(document, errorLocation);

  const message = outcome.formatter === 'remote'
    ? 'Failed to format TPTP file: ' +
      `the SystemB4TPTP remote pretty-printer reported ${outcome.message}`
    : `Failed to format TPTP file: ${outcome.message}`;
  vscode.window.showErrorMessage(message);
}

async function presentPrettyPrintOutcome(
  diagnostics: vscode.DiagnosticCollection,
  document: vscode.TextDocument,
  snapshot: DocumentSnapshot,
  outcome: PrettyPrintOutcome
): Promise<void> {
  if (document.version !== snapshot.version) {
    vscode.window.showWarningMessage(
      'TPTP file changed while formatting. Please run the pretty-printer again.'
    );
    return;
  }

  if (outcome.kind === 'source-error') {
    await reportSourceError(diagnostics, document, outcome);
    return;
  }

  if (outcome.kind === 'formatter-error') {
    vscode.window.showErrorMessage(
      `Failed to format TPTP file ${outcome.formatter === 'remote' ? 'remotely' : 'locally'}: ` +
      outcome.message
    );
    return;
  }

  const applyResult = await applyPrettyPrintResult(document, snapshot, outcome.output);
  switch (applyResult) {
    case 'applied':
      markPrettyPrintVersionFormatted(document);
      vscode.window.showInformationMessage('TPTP file formatted successfully.');
      return;
    case 'unchanged':
      markPrettyPrintVersionFormatted(document);
      vscode.window.showInformationMessage('TPTP file is already formatted.');
      return;
    case 'stale':
      vscode.window.showWarningMessage(
        'TPTP file changed while formatting. Please run the pretty-printer again.'
      );
      return;
    case 'rejected':
      vscode.window.showErrorMessage(
        'Pretty-printer succeeded, but VS Code could not apply the formatted output.'
      );
  }
}

async function executePrettyPrint(
  context: vscode.ExtensionContext,
  diagnostics: vscode.DiagnosticCollection,
  uri: vscode.Uri
): Promise<void> {
  const document = await vscode.workspace.openTextDocument(uri);
  if (isPrettyPrintVersionKnownFormatted(document)) {
    vscode.window.showInformationMessage(
      'The file has not changed since it was last successfully formatted.'
    );
    return;
  }

  diagnostics.delete(document.uri);
  const snapshot: DocumentSnapshot = {
    version: document.version,
    text: document.getText(),
  };

  const outcome = await formatTptpWithFallback(snapshot.text, {
    formatLocally: sourceText => formatTptpLocally(context, sourceText),
    formatRemotely: formatTptpRemotely,
    onRemoteFallback: localFailureMessage => {
      vscode.window.showWarningMessage(
        `Failed to format TPTP file locally: ${localFailureMessage}. ` +
        'Trying the remote formatter provided by SystemB4TPTP...'
      );
    },
  });

  await presentPrettyPrintOutcome(diagnostics, document, snapshot, outcome);
}

function createPrettyPrintCommandHandler(
  context: vscode.ExtensionContext,
  diagnostics: vscode.DiagnosticCollection
): (uri?: vscode.Uri) => Promise<void> {
  let prettyPrintRunning = false;

  return async (uri?: vscode.Uri): Promise<void> => {
    if (prettyPrintRunning) {
      vscode.window.showInformationMessage('The TPTP pretty-printer is already running.');
      return;
    }

    const targetUri = getTargetUri(uri);
    if (!targetUri) {
      vscode.window.showErrorMessage('No TPTP file is currently open.');
      return;
    }

    prettyPrintRunning = true;
    try {
      await setPrettyPrintRunningContext(true);
      await executePrettyPrint(context, diagnostics, targetUri);
    } catch (error: unknown) {
      vscode.window.showErrorMessage(`Failed to format TPTP file: ${errorMessage(error)}`);
    } finally {
      await setPrettyPrintRunningContext(false);
      prettyPrintRunning = false;
    }
  };
}

/** Registers the pretty-print command and its diagnostic lifecycle. */
export function registerPrettyPrintCommand(
  context: vscode.ExtensionContext
): vscode.Disposable {
  const diagnostics = vscode.languages.createDiagnosticCollection('tptpPrettyPrint');
  const commandHandler = createPrettyPrintCommandHandler(context, diagnostics);

  return vscode.Disposable.from(
    diagnostics,
    vscode.commands.registerCommand(PRETTY_PRINT_COMMAND, commandHandler),
    vscode.workspace.onDidChangeTextDocument(event => {
      diagnostics.delete(event.document.uri);
    })
  );
}
