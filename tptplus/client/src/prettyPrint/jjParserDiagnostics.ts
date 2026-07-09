import * as vscode from "vscode";

export interface JJParserErrorLocation {
  position: vscode.Position;
  range: vscode.Range;
  message: string;
  reportedText?: string;
}

/**
 * Takes a JJParser error message and turns it into a VS Code location.
 * @param message The expected message shape is like
 *                'SyntaxError: Line 15 Char 6 Token "{" continuing with ...' or
 *                'SyntaxError: Line 11 Char 42 Character "[" continuing with ...'
 * @returns VS Code location or undefined
 */
export function getJJParserErrorLocation(document: vscode.TextDocument, message: string):
  JJParserErrorLocation | undefined
{
  const match = message.match(/\bLine\s+(\d+)\s+Char\s+(\d+)(?:\s+(?:Token|Character)\s+"([\s\S]*?)"\s+continuing\b)?/);
  if (!match) {
    return undefined;
  }

  const reportedLine = Number.parseInt(match[1], 10);
  const reportedCharacter = Number.parseInt(match[2], 10);
  if (Number.isNaN(reportedLine) || Number.isNaN(reportedCharacter)) {
    return undefined;
  }

  const lineIndex = Math.max(0, Math.min(reportedLine - 1, document.lineCount - 1));
  const lineText = document.lineAt(lineIndex).text;
  let characterIndex = Math.max(0, Math.min(reportedCharacter - 1, lineText.length));
  const reportedText = match[3];

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
    message: message,
    reportedText: reportedText
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
  errorLocation: JJParserErrorLocation | undefined
) {
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
  errorLocation: JJParserErrorLocation | undefined
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
