import {
  parseJJParserError,
  type ParsedJJParserError
} from './jjParserErrors';
import type {
  PrettyPrintFormatter,
  PrettyPrintFormatterFunction,
  PrettyPrintFormatterResult,
  PrettyPrintOutcome
} from './prettyPrintTypes';

export interface PrettyPrintWorkflowDependencies {
  formatLocally: PrettyPrintFormatterFunction;
  formatRemotely: PrettyPrintFormatterFunction;
  onRemoteFallback?(localFailureMessage: string): void | Promise<void>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Ensures an adapter exception is represented by the same result type as other failures. */
async function callFormatter(
  formatter: PrettyPrintFormatterFunction,
  sourceText: string
): Promise<PrettyPrintFormatterResult> {
  try {
    return await formatter(sourceText);
  } catch (error: unknown) {
    return { kind: 'failure', message: errorMessage(error) };
  }
}

function sourceErrorOutcome(
  formatter: PrettyPrintFormatter,
  message: string,
  parsedError: ParsedJJParserError
): PrettyPrintOutcome {
  return {
    kind: 'source-error',
    formatter,
    message,
    location: parsedError.kind === 'syntax-error' ? parsedError.location : undefined,
  };
}

/**
 * Formats source locally when possible, falling back to SystemB4TPTP only when
 * the local formatter cannot produce a result or an actionable source error.
 */
export async function formatTptpWithFallback(
  sourceText: string,
  dependencies: PrettyPrintWorkflowDependencies
): Promise<PrettyPrintOutcome> {
  const localResult = await callFormatter(dependencies.formatLocally, sourceText);

  if (localResult.kind === 'success') {
    return {
      kind: 'formatted',
      formatter: 'local',
      output: localResult.output,
    };
  }

  if (localResult.kind === 'source-error') {
    const parsedError = parseJJParserError(localResult.message);
    if (parsedError.kind !== 'unlocated-error') {
      return sourceErrorOutcome('local', localResult.message, parsedError);
    }
  }

  await dependencies.onRemoteFallback?.(localResult.message);
  const remoteResult = await callFormatter(dependencies.formatRemotely, sourceText);

  if (remoteResult.kind === 'success') {
    return {
      kind: 'formatted',
      formatter: 'remote',
      output: remoteResult.output,
    };
  }

  if (remoteResult.kind === 'source-error') {
    return sourceErrorOutcome(
      'remote',
      remoteResult.message,
      parseJJParserError(remoteResult.message)
    );
  }

  return {
    kind: 'formatter-error',
    formatter: 'remote',
    message: remoteResult.message,
  };
}
