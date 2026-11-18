import * as path from 'path';
import * as vscode from 'vscode';
import type { LanguageClient } from 'vscode-languageclient/node';

import { revealFirstAntlrError, toVsCodeDiagnostic } from './diagnostics';
import type { ExperimentalParseWithAntlrResult } from './types';

const ANTLR_PARSE_COMMAND = 'tptp.experimentalParseWithAntlr';
const ANTLR_PARSE_REQUEST = 'tptp/experimentalParseWithAntlr';
const ANTLR_PARSE_RUNNING_CONTEXT_KEY = 'tptp.antlrParseRunning';

/** Shows cancellable progress for startup and parsing, without imposing a deadline. */
async function requestAntlrParse(
  client: LanguageClient,
  clientReady: Promise<void>,
  document: vscode.TextDocument
): Promise<ExperimentalParseWithAntlrResult | undefined> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Parsing with ANTLR',
      cancellable: true
    },
    async (progress, token) => {
      progress.report({ message: path.basename(document.fileName) });
      let cancellation: vscode.Disposable | undefined;
      const cancelled = new Promise<undefined>(resolve => {
        cancellation = token.onCancellationRequested(() => resolve(undefined));
        if (token.isCancellationRequested) {
          resolve(undefined);
        }
      });
      const request = async (): Promise<ExperimentalParseWithAntlrResult | undefined> => {
        await clientReady;
        if (token.isCancellationRequested) {
          return undefined;
        }
        return client.sendRequest<ExperimentalParseWithAntlrResult>(
          ANTLR_PARSE_REQUEST,
          { uri: document.uri.toString() },
          token
        );
      };

      try {
        // Close progress promptly even if cancellation happens during startup.
        // The same token also forwards cancellation to the server's worker.
        const result = await Promise.race([request(), cancelled]);
        return token.isCancellationRequested ? undefined : result;
      } catch (error: unknown) {
        if (token.isCancellationRequested) {
          return undefined;
        }
        throw error;
      } finally {
        cancellation?.dispose();
      }
    }
  );
}

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
  let parseRunning = false;

  return async (): Promise<void> => {
    if (parseRunning) {
      vscode.window.showInformationMessage('ANTLR is already parsing a TPTP file.');
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'tptp') {
      vscode.window.showErrorMessage('No TPTP file is currently open.');
      return;
    }

    if (editor.document.uri.scheme !== 'file') {
      vscode.window.showErrorMessage(
        'The experimental TPTP ANTLR parser currently supports file-backed TPTP documents only.'
      );
      return;
    }

    parseRunning = true;
    try {
      await vscode.commands.executeCommand('setContext', ANTLR_PARSE_RUNNING_CONTEXT_KEY, true);

      const document = editor.document;
      const parsedDocumentVersion = document.version;
      diagnostics.delete(document.uri);
      const result = await requestAntlrParse(client, clientReady, document);
      if (result === undefined) {
        vscode.window.showInformationMessage('ANTLR parse cancelled.');
        return;
      }
      if (document.isClosed || document.version !== parsedDocumentVersion) {
        vscode.window.showWarningMessage(
          'TPTP file changed or was closed while parsing. Please run the parser again.'
        );
        return;
      }

      const parseDiagnostics = result.diagnostics.map(toVsCodeDiagnostic);
      diagnostics.set(document.uri, parseDiagnostics);
      writeTptpAntlrParseLog(output, document, result);

      if (result.ok) {
        vscode.window.showInformationMessage(
          `ANTLR parse succeeded in ${result.summary.elapsedMs}ms.`
        );
      } else {
        vscode.window.showWarningMessage(
          `ANTLR parse found ${result.summary.syntaxErrorCount} error(s).`
        );
        await revealFirstAntlrError(document, parseDiagnostics);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      output.appendLine(`[${new Date().toISOString()}] TPTP ANTLR parser request failed`);
      output.appendLine(message);
      output.show(true);
      vscode.window.showErrorMessage(`TPTP ANTLR parser request failed: ${message}`);
    } finally {
      parseRunning = false;
      await vscode.commands.executeCommand('setContext', ANTLR_PARSE_RUNNING_CONTEXT_KEY, false);
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
