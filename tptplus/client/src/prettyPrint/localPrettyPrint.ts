import { spawn } from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';

const RUNNER_PATH = path.join('client', 'out', 'prettyPrint', 'localPrettyPrintProcess.js');
const LOCAL_PRETTY_PRINT_TIMEOUT_MS = 10000;  // TODO: make this configurable

export type LocalPrettyPrintResult =
  | { kind: 'success'; output: string }
  | { kind: 'parser-error'; message: string }
  | { kind: 'unknown-error' };

function readParserError(stderr: string): string | undefined {
  for (const line of stderr.trim().split(/\r?\n/).reverse()) {
    if (!line.trim()) {
      continue;
    }

    try {
      const diagnostic = JSON.parse(line) as { kind?: unknown; message?: unknown };
      if (diagnostic.kind === 'jjparser' && typeof diagnostic.message === 'string') {
        return diagnostic.message;
      }
    } catch {
      // Ignore non-JSON stderr from the child process.
    }
  }

  return undefined;
}

export async function formatTptpLocally(
  context: vscode.ExtensionContext,
  input: string
): Promise<LocalPrettyPrintResult> {

  // // debugging: uncomment this to simulate a failure of the local JJParser
  // return { kind: 'parser-error', message: '(This is an error message for debugging that does not point to any specific location in source file.)' };
  // return { kind: 'unknown-error' };

  if (!input.trim()) { // a whitespace-only TPTP file should become empty
    return { kind: 'success', output: '' };
  }

  return new Promise(resolve => {
    let stdout = '';
    let stderr = '';
    let settled = false; // prevent the promise from resolving twice
    const child = spawn(process.execPath, [context.asAbsolutePath(RUNNER_PATH)], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
      },
      stdio: ['pipe', 'pipe', 'pipe'],  // stdin, stdout, stderr
    });

    function finish(result: LocalPrettyPrintResult): void {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(result);
    }

    const timeout = setTimeout(() => {
      child.kill();
      finish({
        kind: 'parser-error',
        message: `timeout after ${LOCAL_PRETTY_PRINT_TIMEOUT_MS} ms`
      });
    }, LOCAL_PRETTY_PRINT_TIMEOUT_MS);

    child.on('error', () => finish({ kind: 'unknown-error' }));
    child.on('close', exitCode => {
      if (exitCode === 0) {
        finish({ kind: 'success', output: stdout });
      } else {
        const parserError = readParserError(stderr);
        finish(parserError ?
          { kind: 'parser-error', message: parserError } :
          { kind: 'unknown-error' }
        );
      }
    });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.stdin.on('error', () => undefined);
    child.stdin.end(input, 'utf8');
  });
}
