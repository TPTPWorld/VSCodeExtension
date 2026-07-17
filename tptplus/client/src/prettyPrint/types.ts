/** The formatter implementation that produced an outcome. */
export type PrettyPrintFormatter = 'local' | 'remote';

/** A zero-based source location reported by a TPTP parser. */
export interface PrettyPrintSourceErrorLocation {
  line: number;
  character: number;
  reportedText?: string;
}

/** The normalized result returned by an individual formatter adapter (e.g., local or remote JJParser). */
export type PrettyPrintFormatterResult =
  | { kind: 'success'; output: string }
  | { kind: 'source-error'; message: string }
  | { kind: 'failure'; message: string };

/** The result of applying the local-first, remote-fallback formatting policy. */
export type PrettyPrintOutcome =
  | {
      kind: 'formatted';
      output: string;
      formatter: PrettyPrintFormatter;
    }
  | {
      kind: 'source-error';
      message: string;
      location?: PrettyPrintSourceErrorLocation;
      formatter: PrettyPrintFormatter;
    }
  | {
      kind: 'formatter-error';
      message: string;
      formatter: PrettyPrintFormatter;
    };

export type PrettyPrintFormatterFunction = (
  sourceText: string
) => Promise<PrettyPrintFormatterResult>;
