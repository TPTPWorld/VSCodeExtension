import * as vscode from 'vscode';

export async function formatTptpLocally(
  context: vscode.ExtensionContext,
  input: string
): Promise<string | undefined> {
  return new Promise(resolve => {
    resolve("hello (form dummy local pretty printer)");
  });
}
