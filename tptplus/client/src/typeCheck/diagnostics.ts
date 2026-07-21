import * as vscode from 'vscode';

import type { LeoIIITypeError } from './errors';

const TYPE_CHECK_DIAGNOSTIC_SOURCE = 'LEO-III-STC type checker';

/** Creates warning diagnostic from each LEO-III-STC type error. */
export function createLeoIIITypeErrorDiagnostics(
  document: vscode.TextDocument,
  typeErrors: LeoIIITypeError[]
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];

  for (const typeError of typeErrors) {
    const lineIndex = typeError.line - 1;
    if (lineIndex < 0 || lineIndex >= document.lineCount) {
      continue;
    }

    const line = document.lineAt(lineIndex);
    const characterIndex = Math.min(typeError.character - 1, line.text.length);
    const startPosition = line.range.start.with(undefined, characterIndex);
    diagnostics.push({
      range: line.range.with(startPosition, line.range.end),
      message: typeError.message,
      severity: vscode.DiagnosticSeverity.Warning,
      source: TYPE_CHECK_DIAGNOSTIC_SOURCE
    });
  }

  return diagnostics;
}

/** Moves the editor cursor to the first source-located type error. */
export async function revealFirstTypeError(
  document: vscode.TextDocument,
  typeErrorDiagnostics: readonly vscode.Diagnostic[]
): Promise<void> {
  const firstTypeError = typeErrorDiagnostics[0];
  if (!firstTypeError) {
    return;
  }

  const position = firstTypeError.range.start;
  const range = new vscode.Range(position, position);
  const editor = await vscode.window.showTextDocument(document, {
    preview: false,
    selection: range
  });
  editor.selection = new vscode.Selection(position, position);
  editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}
