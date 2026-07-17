/**
 * Tracking per-document pretty-print state so unchanged document versions can
 * skip redundant pretty-print runs.
 */

import type * as vscode from 'vscode';

const handledVersionByDocument = new WeakMap<vscode.TextDocument, number>();

/** Whether the current document version already produced a terminal outcome. */
export function wasPrettyPrintVersionHandled(document: vscode.TextDocument): boolean {
  return handledVersionByDocument.get(document) === document.version;
}

/** Records the current document version as having produced a terminal outcome. */
export function markPrettyPrintVersionHandled(document: vscode.TextDocument): void {
  handledVersionByDocument.set(document, document.version);
}
