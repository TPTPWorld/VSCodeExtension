import { spawn } from 'child_process';
import * as path from 'path';
import type * as vscode from 'vscode';
import type { PrettyPrintFormatterResult } from './prettyPrintTypes';

const RUNNER_PATH = path.join('client', 'out', 'prettyPrint', 'localPrettyPrintProcess.js');
const LOCAL_PRETTY_PRINT_TIMEOUT_MS = 10000;  // TODO: make this configurable

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
): Promise<PrettyPrintFormatterResult> {

  // // debugging: uncomment this to simulate a failure of the local JJParser
  // return { kind: 'source-error', message: '(This is an error message for debugging that does not point to any specific location in source file.)' };
  // return { kind: 'failure', message: 'unknown error' };

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

    function finish(result: PrettyPrintFormatterResult): void {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(result);
    }

    const timeout = setTimeout(() => {
      child.kill();
      finish({
        kind: 'failure',
        message: `timeout after ${LOCAL_PRETTY_PRINT_TIMEOUT_MS} ms`
      });
    }, LOCAL_PRETTY_PRINT_TIMEOUT_MS);

    child.on('error', error => finish({ kind: 'failure', message: error.message }));
    child.on('close', exitCode => {
      if (exitCode === 0) {
        finish({ kind: 'success', output: stdout });
      } else {
        const parserError = readParserError(stderr);
        finish(parserError ?
          { kind: 'source-error', message: parserError } :
          { kind: 'failure', message: 'unknown error' }
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
