import { spawn } from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';

const LOCAL_PRETTY_PRINT_TIMEOUT_MS = 10000;

export async function formatTptpLocally(
  context: vscode.ExtensionContext,
  input: string
): Promise<string | undefined> {
  const runnerPath = context.asAbsolutePath(path.join('client', 'out', 'localPrettyPrinterProcess.js'));

  return new Promise(resolve => {
    let stdout = '';
    let settled = false; // prevent the promise from resolving twice
    const child = spawn(process.execPath, [runnerPath], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
      },
      // parent can write to and read from child process; stderr is discarded
      stdio: ['pipe', 'pipe', 'ignore'],
    });

    function finish(output: string | undefined): void {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(output);
    }

    const timeout = setTimeout(() => {
      child.kill();
      finish(undefined);
    }, LOCAL_PRETTY_PRINT_TIMEOUT_MS);

    child.on('error', () => finish(undefined));
    child.on('close', code => {
      finish(code === 0 && stdout.length > 0 ? stdout : undefined);
    });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      stdout += chunk;
    });

    child.stdin.on('error', () => undefined);
    child.stdin.end(input, 'utf8');
  });
}
