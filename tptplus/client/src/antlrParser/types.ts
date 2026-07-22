export interface LspPosition {
  line: number;
  character: number;
}

export interface LspRange {
  start: LspPosition;
  end: LspPosition;
}

export interface LspDiagnostic {
  range: LspRange;
  message: string;
  severity?: number;
  source?: string;
}

export interface ExperimentalParseWithAntlrResult {
  ok: boolean;
  diagnostics: LspDiagnostic[];
  summary: {
    elapsedMs: number;
    syntaxErrorCount: number;
  };
}
