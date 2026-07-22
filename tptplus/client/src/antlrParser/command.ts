import * as vscode from 'vscode';
import type { LanguageClient } from 'vscode-languageclient/node';

import { toVsCodeDiagnostic } from './diagnostics';
import type { ExperimentalParseWithAntlrResult } from './types';

const ANTLR_PARSE_COMMAND = 'tptp.experimentalParseWithAntlr';
const ANTLR_PARSE_REQUEST = 'tptp/experimentalParseWithAntlr';

function writeTptpAntlrParseLog(
  output: vscode.OutputChannel,
  document: vscode.TextDocument,
  result: ExperimentalParseWithAntlrResult
): void {
  output.appendLine(`[${new Date().toISOString()}] ${document.uri.fsPath}`);
  output.appendLine(`Elapsed: ${result.summary.elapsedMs}ms`);
  output.appendLine(`Syntax errors: ${result.summary.syntaxErrorCount}`);

  if (result.diagnostics.length === 0) {
    output.appendLine('No ANTLR diagnostics.');
  } else {
    result.diagnostics.forEach(diagnostic => {
      output.appendLine(
        `${diagnostic.range.start.line + 1}:${diagnostic.range.start.character + 1} ${diagnostic.message}`
      );
    });
  }

  output.appendLine('');
}

function createAntlrParserCommandHandler(
  client: LanguageClient,
  clientReady: Promise<void>,
  diagnostics: vscode.DiagnosticCollection,
  output: vscode.OutputChannel
): () => Promise<void> {
  return async (): Promise<void> => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'tptp') {
      vscode.window.showErrorMessage('No active TPTP file open');
      return;
    }

    if (editor.document.uri.scheme !== 'file') {
      vscode.window.showErrorMessage(
        'The experimental TPTP ANTLR parser currently supports file-backed TPTP documents only.'
      );
      return;
    }

    try {
      await clientReady;
      const result = await client.sendRequest<ExperimentalParseWithAntlrResult>(
        ANTLR_PARSE_REQUEST,
        { uri: editor.document.uri.toString() }
      );

      diagnostics.set(
        editor.document.uri,
        result.diagnostics.map(toVsCodeDiagnostic)
      );
      writeTptpAntlrParseLog(output, editor.document, result);

      if (result.ok) {
        vscode.window.showInformationMessage(
          `ANTLR parse succeeded in ${result.summary.elapsedMs}ms.`
        );
      } else {
        vscode.window.showWarningMessage(
          `ANTLR parse found ${result.summary.syntaxErrorCount} error(s).`
        );
        output.show(true);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      output.appendLine(`[${new Date().toISOString()}] TPTP ANTLR parser request failed`);
      output.appendLine(message);
      output.show(true);
      vscode.window.showErrorMessage(`TPTP ANTLR parser request failed: ${message}`);
    }
  };
}

/** Registers the experimental ANTLR parser command and its diagnostic lifecycle. */
export function registerAntlrParserCommand(
  client: LanguageClient,
  clientReady: Promise<void>
): vscode.Disposable {
  const diagnostics = vscode.languages.createDiagnosticCollection('tptpAntlrExperimental');
  const output = vscode.window.createOutputChannel('TPTP ANTLR Parser');
  const commandHandler = createAntlrParserCommandHandler(
    client,
    clientReady,
    diagnostics,
    output
  );

  return vscode.Disposable.from(
    diagnostics,
    output,
    vscode.commands.registerCommand(ANTLR_PARSE_COMMAND, commandHandler),
    vscode.workspace.onDidChangeTextDocument(event => {
      diagnostics.delete(event.document.uri);
    })
  );
}
