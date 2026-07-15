import * as vscode from "vscode";

import {
  getJJParserErrorLocation,
  type JJParserErrorLocation,
  revealJJParserErrorLocation,
  setJJParserErrorDiagnostic
} from './jjParserDiagnostics';
import { formatTptpLocally } from './localPrettyPrint';
import { isDuplicateFormulaNameError } from './prettyPrintErrors';
import { createSystemB4TptpForm } from '../systemTptpForms';
import {
  extractSystemB4TptpOutput,
  lastNonemptyLine
} from '../systemB4TptpOutput';

/** Applies a pretty-print result to a document and shows success info in a toast. */
async function applyPrettyPrintResult(
  document: vscode.TextDocument,
  originalText: string,
  prettyPrintResult: string
): Promise<void> {
  if (originalText === prettyPrintResult) {
    vscode.window.showInformationMessage('TPTP file is already formatted.');
    return;
  }

  // use WorkspaceEdit to edit any URI's document, even if it's invisible
  const edit = new vscode.WorkspaceEdit();

  const fullTextRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(originalText.length)
  );
  edit.replace(document.uri, fullTextRange, prettyPrintResult);
  await vscode.workspace.applyEdit(edit);
  vscode.window.showInformationMessage('TPTP file formatted successfully.');
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
  context: vscode.ExtensionContext,
  prettyPrintDiagnostics: vscode.DiagnosticCollection
): vscode.Disposable {
  return vscode.commands.registerCommand('tptp.prettyPrint', async (uri: vscode.Uri) => {
    if (!uri) {
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor) {
        vscode.window.showErrorMessage('No TPTP file is currently open.');
        return;
      }
      uri = activeEditor.document.uri;
    }

    // Clear stale parser diagnostics before each new pretty-printer run.
    prettyPrintDiagnostics.delete(uri);

    const document = await vscode.workspace.openTextDocument(uri);
    const sourceText = document.getText();

    // run the local pretty-printer (JJParser)
    const localResult = await formatTptpLocally(context, sourceText);

    if (localResult.kind === 'success') {
      await applyPrettyPrintResult(document, sourceText, localResult.output);
      return;
    }

    if (localResult.kind === 'parser-error') {
      if (isDuplicateFormulaNameError(localResult.message)) {
        vscode.window.showErrorMessage(`Failed to format TPTP file: ${localResult.message}`);
        return;
      }

      const errorLocation = getJJParserErrorLocation(document, localResult.message);
      if (errorLocation !== undefined) {
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
      await applyPrettyPrintResult(document, sourceText, remoteResult);
    }

  });
}
