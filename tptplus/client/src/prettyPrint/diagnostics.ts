import * as vscode from 'vscode';
import type { PrettyPrintSourceErrorLocation } from './types';

export interface PrettyPrintDiagnosticLocation {
  position: vscode.Position;
  range: vscode.Range;
  message: string;
  reportedText?: string;
}

/** Converts a parsed source location into a document-clamped VS Code location. */
export function createJJParserDiagnosticLocation(
  document: vscode.TextDocument,
  message: string,
  sourceLocation: PrettyPrintSourceErrorLocation | undefined
): PrettyPrintDiagnosticLocation | undefined {
  if (!sourceLocation) {
    return undefined;
  }

  const lineIndex = Math.min(sourceLocation.line, document.lineCount - 1);
  const lineText = document.lineAt(lineIndex).text;
  let characterIndex = Math.min(sourceLocation.character, lineText.length);
  const reportedText = sourceLocation.reportedText;

  // If the error message reports a token or character, try to move cursor to its beginning.
  if (reportedText) {
    const reportedTextIndex = lineText.slice(0, characterIndex + 1).lastIndexOf(reportedText);
    if (reportedTextIndex >= 0) {
      characterIndex = reportedTextIndex;
    }
  }

  const startPosition = new vscode.Position(lineIndex, characterIndex);
  const endCharacterIndex = reportedText
    ? Math.min(lineText.length, characterIndex + reportedText.length)
    : characterIndex;
  const endPosition = new vscode.Position(lineIndex, endCharacterIndex);

  return {
    position: startPosition,
    range: new vscode.Range(startPosition, endPosition),
    message,
    reportedText
  };
}

/**
 * Adds a warning diagnostic for a JJParser-reported token or character.
 * The squiggle and diagnostic message are cleared on document edit or before
 * each new pretty-printer run.
 */
export function setJJParserErrorDiagnostic(
  diagnostics: vscode.DiagnosticCollection,
  document: vscode.TextDocument,
  errorLocation: PrettyPrintDiagnosticLocation | undefined
): void {
  if (!errorLocation?.reportedText) {
    return;
  }

  const diagnostic = new vscode.Diagnostic(
    errorLocation.range,
    errorLocation.message,
    vscode.DiagnosticSeverity.Warning
  );
  diagnostic.source = 'TPTP pretty-printer (JJParser)';
  diagnostics.set(document.uri, [diagnostic]);
}

/**
 * Takes a JJParser error location and, if it points to a specific position in source file,
 * highlight the position.
 * @param errorLocation The location parsed from a JJParser error message.
 */
export async function revealJJParserErrorLocation(
  document: vscode.TextDocument,
  errorLocation: PrettyPrintDiagnosticLocation | undefined
): Promise<void>
{
  const position = errorLocation?.position;
  if (!position) {
    return;
  }

  const range = new vscode.Range(position, position);
  const editor = await vscode.window.showTextDocument(document, {
    preview: false,
    selection: range,
  });
  editor.selection = new vscode.Selection(position, position);
  editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}
