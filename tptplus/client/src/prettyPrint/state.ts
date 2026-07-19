/**
 * Tracking per-document pretty-print state so document versions already known
 * to be formatted can skip redundant pretty-print runs.
 */

import type * as vscode from 'vscode';

const formattedVersionByDocument = new WeakMap<vscode.TextDocument, number>();

/** Whether the current document version is already known to be formatted. */
export function isPrettyPrintVersionKnownFormatted(document: vscode.TextDocument): boolean {
  return formattedVersionByDocument.get(document) === document.version;
}

/** Records the current document version as successfully formatted. */
export function markPrettyPrintVersionFormatted(document: vscode.TextDocument): void {
  formattedVersionByDocument.set(document, document.version);
}
