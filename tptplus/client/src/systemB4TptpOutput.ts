import { JSDOM } from 'jsdom';

/**
 * Extract the text between `<PRE>` and `</PRE>` from the HTML response of System B4 TPTP.
 */
export function extractSystemB4TptpHtmlOutput(html: string): string | undefined {
  const dom = new JSDOM(html);
  const preText = dom.window.document.querySelector('pre')?.textContent ?? undefined;
  if (preText === undefined) {
    return undefined;
  }

  const startMarker = '% START OF SYSTEM OUTPUT';
  const endMarker = '% END OF SYSTEM OUTPUT';
  const lines = preText.split('\n');
  const startLine = lines.findIndex(line => line.trim() === startMarker);
  let endLine = -1;  // TODO: use `findLastIndex`?
  for (let i = lines.length - 1; i >= Math.max(0, startLine); i -= 1) {
    if (lines[i].trim() === endMarker) {
      endLine = i;
      break;
    }
  }

  if (startLine === -1 || endLine === -1 || startLine >= endLine) {
    return undefined;
  }

  return lines.slice(startLine + 1, endLine).join('\n');
}

export function lastNonemptyLine(text: string): string | undefined {
  const lines = text.split('\n');
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i].trim();
    if (line) {
      return line;
    }
  }

  return undefined;
}

/** Finds an SZS status line outside an SZS output block. */
function getSzsStatusLine(output: string): string | undefined {
  for (const line of output.split(/\r?\n/)) {
    if (/^% SZS output start \S+/.test(line)) {
      return undefined;
    }
    if (/^% SZS status \S+/.test(line)) {
      return line;
    }
  }

  return undefined;
}

/** Extracts the status name from an SZS status line outside an SZS output block. */
export function getSzsStatus(output: string): string | undefined {
  return getSzsStatusLine(output)?.match(/^% SZS status (\S+)/)?.[1];
}

/** Extracts the message after the first colon in an SZS status line. */
export function getSzsStatusMessage(output: string): string | undefined {
  const statusLine = getSzsStatusLine(output);
  const colonIndex = statusLine?.indexOf(':') ?? -1;
  if (!statusLine || colonIndex < 0) {
    return undefined;
  }

  return statusLine.slice(colonIndex + 1).trim() || undefined;
}

/** Extracts the content between the outermost SZS output markers. */
export function getSzsOutput(output: string): string | undefined {
  const szsOutput = output.match(
    /^% SZS output start \S+[^\r\n]*\r?\n([\s\S]*)\r?\n% SZS output end \S+[^\r\n]*$/m
  )?.[1];

  // A greedy capture can consume the `\r` from the final CRLF delimiter.
  return szsOutput?.replace(/\r$/, '');
}
