import * as vscode from "vscode";

import {
  getJJParserErrorLocation,
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

export function registerPrettyPrintCommand(
  context: vscode.ExtensionContext,
  prettyPrintDiagnostics: vscode.DiagnosticCollection
): vscode.Disposable {
  return vscode.commands.registerCommand('tptp.prettyPrint', async (uri: vscode.Uri) => {
    if (!uri) {
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor) {
        vscode.window.showErrorMessage('No active TPTP file open');
        return;
      }
      uri = activeEditor.document.uri;
    }

    // Clear stale parser diagnostics before each new pretty-printer run.
    prettyPrintDiagnostics.delete(uri);

    const document = await vscode.workspace.openTextDocument(uri);
    const sourceText = document.getText();
    const fullTextRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(sourceText.length)
    );

    // use WorkspaceEdit to edit any URI's document, even if it's invisible
    const edit = new vscode.WorkspaceEdit();

    // run the local pretty-printer (JJParser)
    const localResult = await formatTptpLocally(context, sourceText);

    if (localResult.kind === 'success') {
      edit.replace(uri, fullTextRange, localResult.output);
      await vscode.workspace.applyEdit(edit);
      return;
    }

    if (localResult.kind === 'parser-error') {
      if (isDuplicateFormulaNameError(localResult.message)) {
        vscode.window.showErrorMessage(`Failed to format TPTP file: ${localResult.message}`);
        return;
      }

      const errorLocation = getJJParserErrorLocation(document, localResult.message);
      if (errorLocation !== undefined) {
        setJJParserErrorDiagnostic(prettyPrintDiagnostics, document, errorLocation);
        await revealJJParserErrorLocation(document, errorLocation);
        vscode.window.showErrorMessage(`Failed to format TPTP file: ${localResult.message}`);
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
    const form = createSystemB4TptpForm(sourceText, null);
    const response = await fetch('https://tptp.org/cgi-bin/SystemOnTPTPFormReply', {
      method: 'POST',
      body: form
    });
    const text = await response.text();
    const formattedOutput = extractSystemB4TptpOutput(text);

    if (formattedOutput !== undefined) {
      const lastLine = lastNonemptyLine(formattedOutput);
      if (lastLine?.startsWith('ERROR: ')) {
        const errorLocation = getJJParserErrorLocation(document, lastLine);
        setJJParserErrorDiagnostic(prettyPrintDiagnostics, document, errorLocation);
        await revealJJParserErrorLocation(document, errorLocation);
        vscode.window.showErrorMessage(
          'Failed to format TPTP file: ' +
          `remote formatter provided by SystemB4TPTP exited with ${lastLine}`
        );
      } else {
        edit.replace(uri, fullTextRange, formattedOutput);
        await vscode.workspace.applyEdit(edit);
        vscode.window.showInformationMessage('Format TPTP file successful.');
      }
    }

  });
}
