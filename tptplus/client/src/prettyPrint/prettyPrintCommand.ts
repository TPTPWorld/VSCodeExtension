import * as vscode from "vscode";

import {
  getJJParserErrorLocation,
  type JJParserErrorLocation,
  revealJJParserErrorLocation,
  setJJParserErrorDiagnostic
} from './jjParserDiagnostics';
import { formatTptpLocally } from './localPrettyPrint';
import { isDuplicateFormulaNameError } from './prettyPrintErrors';
import {
  mightNeedPrettyPrinting,
  setMightNeedPrettyPrinting
} from './prettyPrintState';
import { createSystemB4TptpForm } from '../systemTptpForms';
import {
  extractSystemB4TptpOutput,
  lastNonemptyLine
} from '../systemB4TptpOutput';

const PRETTY_PRINT_RUNNING_CONTEXT_KEY = 'tptp.prettyPrintRunning';

/** Applies a pretty-print result if the document has not changed since formatting began. */
async function applyPrettyPrintResult(
  document: vscode.TextDocument,
  originalVersion: number,
  originalText: string,
  prettyPrintResult: string
): Promise<boolean> {
  if (document.version !== originalVersion) {
    vscode.window.showWarningMessage(
      'TPTP file changed while formatting. Please run the pretty-printer again.'
    );
    return false;
  }

  if (originalText === prettyPrintResult) {
    vscode.window.showInformationMessage('TPTP file is already formatted.');
    return true;
  }

  // use WorkspaceEdit to edit any URI's document, even if it's invisible
  const edit = new vscode.WorkspaceEdit();

  const fullTextRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(originalText.length)
  );
  edit.replace(document.uri, fullTextRange, prettyPrintResult);

  const isEditApplied = await vscode.workspace.applyEdit(edit);
  if (!isEditApplied) {
    vscode.window.showErrorMessage('Pretty-printer succeeded, but VS Code could not apply the formatted output.');
    return false;
  } else {
    vscode.window.showInformationMessage('TPTP file formatted successfully.');
    return true;
  }
}

/** Publishes and reveals a parser diagnostic, then shows its error message in a toast. */
async function reportPrettyPrintError(
  prettyPrintDiagnostics: vscode.DiagnosticCollection,
  document: vscode.TextDocument,
  errorLocation: JJParserErrorLocation | undefined,
  errorMessage: string
): Promise<void> {
  setJJParserErrorDiagnostic(prettyPrintDiagnostics, document, errorLocation);
  await revealJJParserErrorLocation(document, errorLocation);
  vscode.window.showErrorMessage(errorMessage);
}

/**
 * Formats TPTP source text using the SystemB4TPTP remote pretty-printer.
 * @throws If the request fails, the response is unsuccessful, or the formatted output cannot be extracted.
 */
async function formatTptpRemotely(sourceText: string): Promise<string> {
  const form = createSystemB4TptpForm(sourceText, null);
  const response = await fetch('https://tptp.org/cgi-bin/SystemOnTPTPFormReply', {
    method: 'POST',
    body: form
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText || 'request failed'}`);
  }

  const result = extractSystemB4TptpOutput(await response.text());
  if (result === undefined) {
    throw new Error('unknown error');
  }

  return result;
}

// TODO: use the VSCode formatting API:
// https://code.visualstudio.com/blogs/2016/11/15/formatters-best-practices
/** Registers the pretty-print command with local formatting and a remote fallback. */
export function registerPrettyPrintCommand(
  context: vscode.ExtensionContext
): vscode.Disposable {
  const prettyPrintDiagnostics = vscode.languages.createDiagnosticCollection('tptpPrettyPrint');
  let prettyPrintRunning = false;

  const commandDisposable = vscode.commands.registerCommand('tptp.prettyPrint', async (uri: vscode.Uri) => {
    if (prettyPrintRunning) {
      vscode.window.showInformationMessage('The TPTP pretty-printer is already running.');
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

    prettyPrintRunning = true;
    try {
      await vscode.commands.executeCommand('setContext', PRETTY_PRINT_RUNNING_CONTEXT_KEY, true);

      const document = await vscode.workspace.openTextDocument(uri);
      if (!mightNeedPrettyPrinting(document)) {
        vscode.window.showInformationMessage(
          'The file has not changed since the last pretty-printer run.'
        );
        return;
      }

      // Clear stale parser diagnostics before each new pretty-printer run.
      prettyPrintDiagnostics.delete(uri);

      const sourceVersion = document.version;
      const sourceText = document.getText();

      // run the local pretty-printer (JJParser)
      const localResult = await formatTptpLocally(context, sourceText);

      if (localResult.kind === 'success') {
        const documentIsFormatted = await applyPrettyPrintResult(
          document,
          sourceVersion,
          sourceText,
          localResult.output
        );
        if (documentIsFormatted) {
          setMightNeedPrettyPrinting(document, false);
        }
        return;
      }

      if (localResult.kind === 'parser-error') {
        if (isDuplicateFormulaNameError(localResult.message)) {
          if (document.version === sourceVersion) {
            setMightNeedPrettyPrinting(document, false);
          }
          vscode.window.showErrorMessage(`Failed to format TPTP file: ${localResult.message}`);
          return;
        }

        const errorLocation = getJJParserErrorLocation(document, localResult.message);
        if (errorLocation !== undefined) {
          if (document.version === sourceVersion) {
            setMightNeedPrettyPrinting(document, false);
          }
          await reportPrettyPrintError(
            prettyPrintDiagnostics,
            document,
            errorLocation,
            `Failed to format TPTP file: ${localResult.message}`
          );
          return;
        }
      }

      // Fall back to remote pretty-printer if the local pretty-printer fails on a critical error,
      // i.e., either an `unknown-error`, or a `parser-error` that is not a duplicate formula name
      // error and does not point to any specific location in `sourceText`.
      const localFailMessage =
        localResult.kind === 'parser-error' ? localResult.message : 'unknown error';
      vscode.window.showWarningMessage(
        `Failed to format TPTP file locally: ${localFailMessage}. ` +
        'Trying the remote formatter provided by SystemB4TPTP...'
      );

      // run the remote pretty-printer (provided by SystemB4TPTP)
      let remoteResult: string;
      try {
        remoteResult = await formatTptpRemotely(sourceText);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to format TPTP file remotely: ${errorMessage}`);
        return;
      }

      const lastLine = lastNonemptyLine(remoteResult);
      if (lastLine?.startsWith('ERROR: ')) {
        const errorLocation = getJJParserErrorLocation(document, lastLine);
        await reportPrettyPrintError(
          prettyPrintDiagnostics,
          document,
          errorLocation,
          'Failed to format TPTP file: ' +
          `the SystemB4TPTP remote pretty-printer reported ${lastLine}`
        );
      } else {
        const documentIsFormatted = await applyPrettyPrintResult(
          document,
          sourceVersion,
          sourceText,
          remoteResult
        );
        if (documentIsFormatted) {
          setMightNeedPrettyPrinting(document, false);
        }
      }
    } finally {
      prettyPrintRunning = false;
      await vscode.commands.executeCommand('setContext', PRETTY_PRINT_RUNNING_CONTEXT_KEY, false);
    }
  });

  const changeDisposable = vscode.workspace.onDidChangeTextDocument(event => {
    prettyPrintDiagnostics.delete(event.document.uri);
    setMightNeedPrettyPrinting(event.document, true);
  });

  return vscode.Disposable.from(
    prettyPrintDiagnostics,
    commandDisposable,
    changeDisposable
  );
}
