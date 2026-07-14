import * as path from 'path';
import { pathToFileURL } from 'url';
import {
  Diagnostic,
  DiagnosticSeverity,
} from 'vscode-languageserver/node';

export interface TptpAntlrParseSummary {
  elapsedMs: number;
  syntaxErrorCount: number;
}

export interface TptpAntlrParseResult {
  ok: boolean;
  diagnostics: Diagnostic[];
  summary: TptpAntlrParseSummary;
}

interface AntlrRuntime {
  InputStream: new (input: string) => unknown;
  CommonTokenStream: new (lexer: unknown) => unknown;
}

interface TptpAntlrRuntime {
  antlr4: AntlrRuntime;
  TPTPLexer: new (input: unknown) => AntlrRecognizer;
  TPTPParser: new (tokens: unknown) => AntlrRecognizer & {
    buildParseTrees: boolean;
    tptp_file: () => unknown;
  };
}

interface AntlrRecognizer {
  removeErrorListeners: () => void;
  addErrorListener: (listener: AntlrErrorListener) => void;
}

interface AntlrErrorListener {
  syntaxError: (
    recognizer: unknown,
    offendingSymbol: AntlrOffendingSymbol | null,
    line: number,
    column: number,
    msg: string,
    error: unknown
  ) => void;
}

interface AntlrOffendingSymbol {
  text?: string;
}

interface AntlrSyntaxError {
  line: number;
  column: number;
  message: string;
  offendingSymbol: AntlrOffendingSymbol | null;
}

type NativeImport = <T = unknown>(specifier: string) => Promise<T>;

const nativeImport = new Function('specifier', 'return import(specifier)') as NativeImport;

let runtimePromise: Promise<TptpAntlrRuntime> | undefined;

export async function parseTptpDocument(text: string): Promise<TptpAntlrParseResult> {
  const startedAt = Date.now();
  const lines = text.split(/\r?\n/);

  try {
    const runtime = await loadTptpAntlrRuntime();
    const syntaxErrors: AntlrSyntaxError[] = [];
    const errorListener = createErrorListener(syntaxErrors);

    const chars = new runtime.antlr4.InputStream(text);
    const lexer = new runtime.TPTPLexer(chars);
    lexer.removeErrorListeners();
    lexer.addErrorListener(errorListener);

    const tokens = new runtime.antlr4.CommonTokenStream(lexer);
    const parser = new runtime.TPTPParser(tokens);
    parser.buildParseTrees = true;
    parser.removeErrorListeners();
    parser.addErrorListener(errorListener);
    parser.tptp_file();

    const diagnostics = syntaxErrors.map(error => toDiagnostic(error, lines));
    return {
      ok: diagnostics.length === 0,
      diagnostics,
      summary: {
        elapsedMs: Date.now() - startedAt,
        syntaxErrorCount: diagnostics.length,
      },
    };
  } catch (error) {
    const diagnostic = createRuntimeDiagnostic(error);
    return {
      ok: false,
      diagnostics: [diagnostic],
      summary: {
        elapsedMs: Date.now() - startedAt,
        syntaxErrorCount: 1,
      },
    };
  }
}

async function loadTptpAntlrRuntime(): Promise<TptpAntlrRuntime> {
  runtimePromise ??= loadTptpAntlrRuntimeUncached();
  return runtimePromise;
}

async function loadTptpAntlrRuntimeUncached(): Promise<TptpAntlrRuntime> {
  const vendorDir = path.resolve(__dirname, '..', '..', 'parser', 'vendor', 'tptp-antlr');
  const lexerUrl = pathToFileURL(path.join(vendorDir, 'TPTPLexer.js')).href;
  const parserUrl = pathToFileURL(path.join(vendorDir, 'TPTPParser.js')).href;

  const antlrModule = await nativeImport<{ default: AntlrRuntime }>('antlr4');
  const lexerModule = await nativeImport<{ default: TptpAntlrRuntime['TPTPLexer'] }>(lexerUrl);
  const parserModule = await nativeImport<{ default: TptpAntlrRuntime['TPTPParser'] }>(parserUrl);

  return {
    antlr4: antlrModule.default,
    TPTPLexer: lexerModule.default,
    TPTPParser: parserModule.default,
  };
}

function createErrorListener(syntaxErrors: AntlrSyntaxError[]): AntlrErrorListener {
  return {
    syntaxError: (
      _recognizer,
      offendingSymbol,
      line,
      column,
      msg,
      _error
    ) => {
      syntaxErrors.push({
        line,
        column,
        message: msg,
        offendingSymbol,
      });
    },
  };
}

function toDiagnostic(error: AntlrSyntaxError, lines: string[]): Diagnostic {
  const line = clamp(error.line - 1, 0, Math.max(lines.length - 1, 0));
  const lineText = lines[line] ?? '';
  const startCharacter = clamp(error.column, 0, lineText.length);
  const tokenText = error.offendingSymbol?.text;
  const tokenLength = tokenText && tokenText !== '<EOF>' ? tokenText.length : 1;
  const boundedEndCharacter = Math.min(lineText.length, startCharacter + tokenLength);
  const endCharacter = boundedEndCharacter > startCharacter ? boundedEndCharacter : startCharacter;

  return {
    severity: DiagnosticSeverity.Error,
    range: {
      start: { line, character: startCharacter },
      end: { line, character: endCharacter },
    },
    message: `TPTP ANTLR parser: ${error.message}`,
    source: 'tptp-antlr-experimental',
  };
}

function createRuntimeDiagnostic(error: unknown): Diagnostic {
  const message = error instanceof Error ? error.message : String(error);
  return {
    severity: DiagnosticSeverity.Error,
    range: {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 1 },
    },
    message: `Unable to run TPTP ANTLR parser: ${message}`,
    source: 'tptp-antlr-experimental',
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
