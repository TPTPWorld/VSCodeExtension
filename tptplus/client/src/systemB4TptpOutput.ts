import { JSDOM } from 'jsdom';

/**
 * Extract the text between `<PRE>` and `</PRE>` from the HTML response of System B4 TPTP.
 */
export function extractSystemB4TptpOutput(html: string): string | undefined {
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
