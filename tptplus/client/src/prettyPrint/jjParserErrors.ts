import type { PrettyPrintSourceErrorLocation } from './types';

const DUPLICATE_FORMULA_NAME_ERROR_PREFIX =
  'ERROR: Duplicate annotated formula name';

export type ParsedJJParserError =
  | { kind: 'duplicate-name' }
  | { kind: 'syntax-error'; location: PrettyPrintSourceErrorLocation }
  | { kind: 'unlocated-error' };

/**
 * Classifies a JJParser error and extracts its zero-based source location when present.
 * Expected located messages include:
 *   'SyntaxError: Line 15 Char 6 Token "{" continuing with ...'
 *   'SyntaxError: Line 11 Char 42 Character "[" continuing with ...'
 */
export function parseJJParserError(message: string): ParsedJJParserError {
  if (message.trim().startsWith(DUPLICATE_FORMULA_NAME_ERROR_PREFIX)) {
    return { kind: 'duplicate-name' };
  }

  const match = message.match(
    /\bLine\s+(\d+)\s+Char\s+(\d+)(?:\s+(?:Token|Character)\s+"([\s\S]*?)"\s+continuing\b)?/
  );
  if (!match) {
    return { kind: 'unlocated-error' };
  }

  const reportedLine = Number.parseInt(match[1], 10);
  const reportedCharacter = Number.parseInt(match[2], 10);
  if (Number.isNaN(reportedLine) || Number.isNaN(reportedCharacter)) {
    return { kind: 'unlocated-error' };
  }

  return {
    kind: 'syntax-error',
    location: {
      line: Math.max(0, reportedLine - 1),
      character: Math.max(0, reportedCharacter - 1),
      reportedText: match[3],
    },
  };
}
