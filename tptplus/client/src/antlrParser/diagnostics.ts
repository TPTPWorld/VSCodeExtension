import * as vscode from 'vscode';

import type { LspDiagnostic } from './types';

function toVsCodeSeverity(severity: number | undefined): vscode.DiagnosticSeverity {
  switch (severity) {
    case 2:
      return vscode.DiagnosticSeverity.Warning;
    case 3:
      return vscode.DiagnosticSeverity.Information;
    case 4:
      return vscode.DiagnosticSeverity.Hint;
    case 1:
    default:
      return vscode.DiagnosticSeverity.Error;
  }
}

/** Converts a language-server diagnostic into its VS Code client representation. */
export function toVsCodeDiagnostic(diagnostic: LspDiagnostic): vscode.Diagnostic {
  const range = new vscode.Range(
    diagnostic.range.start.line,
    diagnostic.range.start.character,
    diagnostic.range.end.line,
    diagnostic.range.end.character
  );
  const result = new vscode.Diagnostic(
    range,
    diagnostic.message,
    toVsCodeSeverity(diagnostic.severity)
  );
  result.source = diagnostic.source;
  return result;
}
