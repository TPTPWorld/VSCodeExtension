import type * as vscode from 'vscode';

const mightNeedPrettyPrintingByDocument = new WeakMap<vscode.TextDocument, boolean>();

/** Whether the current contents of a document might need to be pretty-printed. */
export function mightNeedPrettyPrinting(document: vscode.TextDocument): boolean {
  return mightNeedPrettyPrintingByDocument.get(document) ?? true;
}

/** Records whether the current contents of a document might need to be pretty-printed. */
export function setMightNeedPrettyPrinting(
  document: vscode.TextDocument,
  mightNeedPrettyPrinting: boolean
): void {
  mightNeedPrettyPrintingByDocument.set(document, mightNeedPrettyPrinting);
}
