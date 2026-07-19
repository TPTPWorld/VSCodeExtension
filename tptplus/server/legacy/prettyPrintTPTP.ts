/**
 * Legacy heuristic TPTP formatter.
 *
 * This implementation is intentionally kept outside `src` so it is preserved
 * for reference without being compiled or advertised by the language server.
 */
export function prettyPrintTPTP(input: string): string {
  const indentUnit = "    ";   // 4 spaces
  const maxLineLength = 20;    // threshold for breaking formula to new line
  let indentLevel = 0;
  let parenDepth = 0;          // actual ( ... ) depth
  let out = "";
  let inString = false;        // tracking '...' or "..."
  let strChar = "";            // either "'" or '"'
  let inLineComment = false;
  let inBlockComment = false;
  let isInTPTPFormula = false;  // track if we're in the formula part of TPTP declaration
  let tptpCommaCount = 0;       // count commas in TPTP declaration to identify formula part
  let bracketDepth = 0;
  let justEndedFormula = false; // track if we just ended a formula with a period

  // Helper: peek ahead, skipping any whitespace
  function peekNonWhitespace(idx: number): string | null {
    let j = idx;
    while (j < input.length && /\s/.test(input[j])) { j++; }
    return j < input.length ? input[j] : null;
  }

  // Helper: check if current position is start of TPTP declaration
  function isAtTPTPStart(idx: number): boolean {
    const patterns = ["tpi(", "thf(", "tff(", "tcf(", "fof(", "cnf("];
    return patterns.some(pattern => input.substring(idx, idx + pattern.length) === pattern);
  }

  // Helper: get the length of the TPTP declaration type
  function getTPTPDeclLength(idx: number): number {
    const patterns = ["tpi(", "thf(", "tff(", "tcf(", "fof(", "cnf("];
    for (const pattern of patterns) {
      if (input.substring(idx, idx + pattern.length) === pattern) {
        return pattern.length;
      }
    }
    return 0;
  }

  // Helper: estimate current line length from last newline
  function getCurrentLineLength(): number {
    const lastNewlineIdx = out.lastIndexOf('\n');
    if (lastNewlineIdx === -1) return out.length;
    return out.length - lastNewlineIdx - 1;
  }

  // Helper: check if there's already a blank line at the end of output
  function hasBlankLineAtEnd(): boolean {
    const lines = out.split('\n');
    return lines.length >= 2 && lines[lines.length - 1] === '' && lines[lines.length - 2] === '';
  }

  // Preserve empty lines by tracking consecutive newlines
  function preserveEmptyLines(startIdx: number): number {
    let i = startIdx;
    let newlineCount = 0;

    // Count newlines (but skip other whitespace)
    while (i < input.length) {
      if (input[i] === '\n') {
        newlineCount++;
        i++;
      } else if (/[ \t\r]/.test(input[i])) {
        // Skip other whitespace but don't count it
        i++;
      } else {
        break;
      }
    }

    // If we have more than one newline, preserve the extras as empty lines
    if (newlineCount > 1) {
      // Add the extra newlines (newlineCount - 1 because we already have one)
      for (let j = 1; j < newlineCount && j < 3; j++) {
        out += '\n';
      }
    }

    return i;
  }

  // We iterate char by char, but sometimes lookahead ("=>" etc.)
  for (let i = 0; i < input.length; ) {
    const ch = input[i];
    const next = input[i + 1] ?? "";

    if (ch === "[") {
      bracketDepth++;
      out += ch;
      i++;
      continue;
    }

    if (ch === "]") {
      bracketDepth = Math.max(bracketDepth - 1, 0);
      out += ch;
      i++;
      continue;
    }

    //
    // 1) Single‐line comment "% …" (only if it occurs at line‐start or after a newline)
    //
    if (
      !inString &&
      !inBlockComment &&
      ch === "%" &&
      (i === 0 || input[i - 1] === "\n")
    ) {
      inLineComment = true;
      // Copy "%" + everything until end‐of‐line
      while (i < input.length && input[i] !== "\n") {
        out += input[i++];
      }
      // Copy the newline too (if any)
      if (i < input.length && input[i] === "\n") {
        out += "\n";
        i++;
      }
      inLineComment = false;
      continue;
    }

    //
    // 2) Block comment start "/* … */"
    //
    if (!inString && !inLineComment && !inBlockComment && ch === "/" && next === "*") {
      inBlockComment = true;
      out += "/*";
      i += 2;
      // Copy until matching "*/"
      while (i < input.length) {
        if (input[i] === "*" && input[i + 1] === "/") {
          out += "*/";
          i += 2;
          inBlockComment = false;
          break;
        } else {
          out += input[i++];
        }
      }
      continue;
    }

    //
    // 3) If already inside a block comment, copy verbatim until it ends
    //
    if (inBlockComment) {
      out += ch;
      i++;
      continue;
    }

    //
    // 4) Toggle inString on unescaped ' or "
    //
    if (!inLineComment && (ch === "'" || ch === '"') && input[i - 1] !== "\\") {
      if (!inString) {
        inString = true;
        strChar = ch;
        out += ch;
        i++;
        continue;
      } else if (inString && ch === strChar) {
        inString = false;
        strChar = "";
        out += ch;
        i++;
        continue;
      }
    }
    if (inString) {
      // Inside a string → copy verbatim
      out += ch;
      i++;
      continue;
    }

    //
    // 5) Handle TPTP declaration detection and comma counting
    //
    if (isAtTPTPStart(i)) {
      // If we just ended a formula and are starting a new one, ensure blank line
      if (justEndedFormula && !hasBlankLineAtEnd()) {
        out += "\n";
      }
      justEndedFormula = false;

      const declLength = getTPTPDeclLength(i);
      out += input.substring(i, i + declLength); // e.g., "fof("
      i += declLength;

      tptpCommaCount = 0;
      isInTPTPFormula = false;
      parenDepth = 1;
      indentLevel = 1;

      // Parse and keep first two arguments (name, role) inline
      let arg = "";
      let commasSeen = 0;

      while (i < input.length && commasSeen < 2) {
        const ch2 = input[i];

        if (ch2 === ",") {
          out += arg.trim() + ", ";
          arg = "";
          commasSeen++;
          i++;
        } else {
          arg += ch2;
          i++;
        }
      }

      // After second comma, break to a new line and indent for the formula
      out += "\n" + indentUnit.repeat(indentLevel);
      isInTPTPFormula = true;

      continue;
    }


    //
    // 6) Handle "=>" (implication): break‐before, indent at current level, then print "=>", then a space
    //
    if (ch === "=" && next === ">") {
      // newline + indent
      out += "\n" + indentUnit.repeat(Math.max(1, indentLevel - 3)) + " =>";
      i += 2;
      // skip any whitespace that follows
      while (i < input.length && /\s/.test(input[i])) {
        i++;
      }
      out += " ";
      continue;
    }

    //
    // 7) Handle disjunction "|": break‐before, indent one deeper than current level, then "| "
    //
    if (ch === "|") {
      out += "\n" + indentUnit.repeat(Math.max(1, indentLevel - 3)) + "|";
      i++;
      // skip following whitespace
      while (i < input.length && /\s/.test(input[i])) {
        i++;
      }
      out += " ";
      continue;
    }

    // 7.1) Handle conjunction "&": break‐before, indent one deeper than current level, then "& "
    if (ch === "&") {
      out += "\n" + indentUnit.repeat(Math.max(1, indentLevel - 3)) + "&";
      i++;
      // skip any whitespace that follows
      while (i < input.length && /\s/.test(input[i])) {
        i++;
      }
      out += " ";
      continue;
    }

    // 7.2) Handle conjunction ":": keep ":" on current line, then newline + indent
    if (ch === ":") {
      out += " :";
      i++;
      // skip any whitespace that follows
      while (i < input.length && /\s/.test(input[i])) {
        i++;
      }
      out += "\n" + indentUnit.repeat(Math.max(1, indentLevel - 3));
      continue;
    }

    // 7.3) Handle quantifiers ?[ ... ], ![ ... ], ^[ ... ]
    if ((ch === "?" || ch === "!" || ch === "^" || ch === "~") && peekNonWhitespace(i + 1) === "[") {
      out += ch + " ";
      i++;

      // skip any whitespace between quantifier and bracket
      while (i < input.length && /\s/.test(input[i])) {
        i++;
      }

      if (input[i] === "[") {
        out += "[";
        bracketDepth++;
        i++;
        continue;
      }
    }

    // 7.4) Add spaces before special symbols
    if (
      (ch === "=" && input[i - 1] !== "<" && input[i - 1] !== "!" && input[i - 1] !== ">") ||
      (ch === "!" && next === "=") ||
      (ch === "<" && next === "=") ||
      (ch === ">" && next === "=")
    ) {
      const op = (ch === "!" || ch === "<" || ch === ">") ? ch + next : ch;
      out += " " + op + " ";
      i += op.length;
      continue;
    }

    //
    // 8) Opening parenthesis "(":  increase parenDepth & indentLevel, print "("
    //    Then, if the next real (non‐whitespace) character is a letter or "!", insert a single space.
    //
    if (ch === "(") {
      out += "(";
      parenDepth++;
      // indentLevel++;
      i++;

      // Peek the next non‐ws character; if it's a letter or "!", insert exactly one space:
      const nn = peekNonWhitespace(i);
      if (nn !== null && /[A-Za-z!]/.test(nn)) {
        // out += " ";
      }
      continue;
    }

    //~ DONT WANT THIS FOR NOW
    // 9) Closing parenthesis ")": break‐before at (level−1), then print ")"
    // if (ch === ")") {
    //   let closeCount = 0;
    //   // Count consecutive closing parens
    //   while (input[i + closeCount] === ")") {
    //     closeCount++;
    //   }

    //   // If followed by a period, group them all together
    //   const followsPeriod = input[i + closeCount] === ".";

    //   // Write the closing parens on the same line
    //   out += " ".repeat(1); // optional space before
    //   for (let j = 0; j < closeCount; j++) {
    //     parenDepth = Math.max(parenDepth - 1, 0);
    //     indentLevel = Math.max(indentLevel - 1, 0);
    //     out += ")";
    //   }

    //   i += closeCount;

    //   // If there's a period, append it too
    //   if (followsPeriod) {
    //     out += ".\n";
    //     i++; // skip '.'
    //     isInTPTPFormula = false;
    //     tptpCommaCount = 0;
    //   }

    //   continue;
    // }


    //
    // 10) Comma ",":
    //     • Track TPTP comma count and handle formula formatting
    //     • if parenDepth === 1  → this is the top‐level comma inside "tptp( name, role, formula )": emit "," + newline + indent(at same level)
    //     • else (nested comma) → emit ", " (comma + single space) on the same line
    //
    if (ch === ",") {
      if (parenDepth === 1 && bracketDepth === 0) {
        // top‐level comma in "tptp(...)"
        tptpCommaCount++;
        out += ",";

        // If this is the second comma (before formula), check line length
        if (tptpCommaCount === 2) {
          const currentLineLength = getCurrentLineLength();
          if (currentLineLength > maxLineLength) {
            out += "\n" + indentUnit.repeat(indentLevel);
            isInTPTPFormula = true;
          } else {
            out += "\n" + indentUnit.repeat(indentLevel);
            isInTPTPFormula = true;
          }
        } else {
          out += "\n" + indentUnit.repeat(indentLevel);
        }
        i++;
      } else {
        // nested comma, keep on same line
        out += ", ";
        i++;
        // skip any whitespace that follows
        while (i < input.length && /\s/.test(input[i])) {
          i++;
        }
      }
      continue;
    }

    //
    // 11) Period "." → print "." then newline, reset TPTP state
    //
    if (ch === ".") {
      out += ".";
      out += "\n";
      isInTPTPFormula = false;
      tptpCommaCount = 0;
      justEndedFormula = true; // Mark that we just ended a formula
      i++;
      continue;
    }

    //
    // 12) Whitespace (spaces, tabs, newlines):
    //      Handle empty line preservation and normal whitespace collapse
    //
    if (/\s/.test(ch)) {
      // Check for multiple consecutive newlines to preserve empty lines
      if (ch === '\n') {
        const preservedIdx = preserveEmptyLines(i);
        if (preservedIdx > i + 1) {
          // We preserved multiple newlines, skip ahead
          i = preservedIdx;
          continue;
        }
      }

      // Skip all remaining whitespace in input
      while (i < input.length && /\s/.test(input[i])) {
        i++;
      }

      // Now decide whether to insert exactly one space:
      const lastCh = out.length > 0 ? out[out.length - 1] : "\n";
      if (
        lastCh !== " " &&
        lastCh !== "\n" &&
        lastCh !== "("
      ) {
        // Insert one space if the next real char is alphanumeric or "$" or "<" etc.
        const nn = peekNonWhitespace(i);
        if (nn !== null && /[A-Za-z0-9\$<]/.test(nn)) {
          out += " ";
        }
      }
      continue;
    }

    //
    // 13) Default: any other character—just copy verbatim
    //
    out += ch;
    i++;
  }

  // Trim trailing whitespace/newlines, then append exactly one newline at end
  return out.replace(/\s*$/, "") + "\n";
}
