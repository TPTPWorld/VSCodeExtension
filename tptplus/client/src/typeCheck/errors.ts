import type * as vscode from 'vscode';

const TYPE_CHECK_DIAGNOSTIC_SOURCE = 'LEO-III-STC type checker';
// DiagnosticSeverity.Warning is 1 in the VS Code API. Keeping this module's
// VS Code dependency type-only also makes the error parser independently testable.
const WARNING_DIAGNOSTIC_SEVERITY: vscode.DiagnosticSeverity = 1;

export interface LeoIIITypeError {
  formulaName: string;
  /** One-based source line reported by LEO-III-STC. */
  line: number;
  /** One-based source character reported by LEO-III-STC. */
  character: number;
  message: string;
}

/** Formats an SZS status message for display in a type-check toaster. */
export function formatTypeCheckStatusMessage(
  status: string | undefined,
  message: string | undefined
): string | undefined {
  if (status === 'TypeError') {
    // Discard the generic "Problem is not well-typed" message. The detailed
    // ill-typed formula messages from the SZS output are displayed instead.
    return '';
  }

  if (status === 'SyntaxError') {
    // Discard temporary file name
    return message?.replace(
      /^Parse error in file '[^\r\n]*' in line (?=\d+:\d+)/,
      'Parse error in line '
    );
  }

  return message;
}

/** Extracts every source-located type error reported by LEO-III-STC. */
export function getLeoIIITypeErrors(output: string): LeoIIITypeError[] {
  const typeErrors: LeoIIITypeError[] = [];
  const typeErrorPattern = /Illtyped formula ([^\r\n]+?) in line ([1-9]\d*):([1-9]\d*)\./g;

  for (const match of output.matchAll(typeErrorPattern)) {
    typeErrors.push({
      formulaName: match[1],
      line: Number(match[2]),
      character: Number(match[3]),
      message: match[0]
    });
  }

  return typeErrors;
}

/** Creates warning diagnostics from each valid LEO-III-STC source location. */
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
      severity: WARNING_DIAGNOSTIC_SEVERITY,
      source: TYPE_CHECK_DIAGNOSTIC_SOURCE
    });
  }

  return diagnostics;
}
