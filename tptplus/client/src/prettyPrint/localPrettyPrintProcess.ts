import * as fs from 'fs';
import * as path from 'path';
import createTPTP4X from '../../resources/wasm/tptp4X_wasm.js';
import { isDuplicateFormulaNameError } from './prettyPrintErrors';

const WASM_DIR = path.join(__dirname, '..', '..', 'resources', 'wasm');
const WASM_BIN_PATH = path.join(WASM_DIR, 'tptp4X_wasm.wasm');

export type TPTP4XModule = {
  lengthBytesUTF8(value: string): number;
  stringToUTF8(value: string, pointer: number, maxBytesToWrite: number): void;
  UTF8ToString(pointer: number): string;
  _malloc(size: number): number;
  _free(pointer: number): void;
  _tptp4x_pretty_print_tptp(inputPointer: number): number;
  _tptp4x_free_string(pointer: number): void;
};

export type CreateTPTP4X = (options: {
  locateFile(file: string): string;
  print(message?: string): void;
  printErr(message?: string): void;
  quit(status: number, error: unknown): never;
  wasmBinary: ArrayBuffer | ArrayBufferView;
}) => Promise<TPTP4XModule>;

const wasmDiagnostics: string[] = [];

function readStdin(): string {
  return fs.readFileSync(0, 'utf8');
}

function captureWasmDiagnostic(message?: string): void {
  if (message && message.trim()) {
    wasmDiagnostics.push(message);
  }
}

function parserDiagnosticMessage(): string | undefined {
  const diagnosticStart = wasmDiagnostics.findIndex(message =>
    /^ERROR:\s/.test(message) || /^%\s*SZS status\s+\S+\s*:/.test(message)
  );

  if (diagnosticStart < 0) {
    return undefined;
  }

  const message = wasmDiagnostics.slice(diagnosticStart).join('\n');
  if (isDuplicateFormulaNameError(message)) {
    return message.trim();
  }

  const errorMatch = message.match(/^ERROR:\s*(.*)$/s);
  if (errorMatch) {
    return errorMatch[1].trim();
  }

  const szsMatch = message.match(/^%\s*SZS status\s+(\S+)\s*:\s*(.*)$/s);
  if (szsMatch) {
    return `${szsMatch[1]}: ${szsMatch[2].trim()}`;
  }

  return undefined;
}

function writeParserDiagnostic(): void {
  const message = parserDiagnosticMessage();

  if (!message) {
    return;
  }

  process.stderr.write(`${JSON.stringify({
    kind: 'jjparser',
    message,
  })}\n`);
}

/**
 * Copies a JavaScript string into WASM memory.
 * @param value - the string to be copied
 * @returns pointer to the copy in WASM memory
 */
function writeString(module: TPTP4XModule, value: string): number {
  const length = module.lengthBytesUTF8(value) + 1;
  const pointer = module._malloc(length);

  if (!pointer) {
    throw new Error('Unable to allocate wasm memory for TPTP input');
  }

  module.stringToUTF8(value, pointer, length);
  return pointer;
}

/**
 * Returns a non-zero exit code (default = 1) by parsing an error of unknown type.
 */
function statusFromError(error: unknown): number {
  if (error !== null && typeof error === 'object' &&
    'status' in error && typeof error.status === 'number'
  ) {
    return error.status || 1;
  }
  return 1;
}

async function main(): Promise<void> {
  let wasmExited = false;
  const module = await createTPTP4X({
    locateFile: (file: string) => path.join(WASM_DIR, file),
    print:    captureWasmDiagnostic,
    printErr: captureWasmDiagnostic,
    quit: (status: number, error: unknown): never => {
      wasmExited = true;
      const throwable = error instanceof Error ? error : new Error(`WASM exited with status ${status}`);
      (throwable as Error & { status?: number }).status = status;
      throw throwable;
    },
    wasmBinary: fs.readFileSync(WASM_BIN_PATH),
  });

  let inputPointer = 0;
  let outputPointer = 0;

  try {
    inputPointer = writeString(module, readStdin());
    outputPointer = module._tptp4x_pretty_print_tptp(inputPointer);

    if (!outputPointer) {
      writeParserDiagnostic();
      process.exitCode = 1;
      return;
    }

    process.stdout.write(module.UTF8ToString(outputPointer));
  } finally {
    if (outputPointer && !wasmExited) {
      module._tptp4x_free_string(outputPointer);
    }
    if (inputPointer && !wasmExited) {
      module._free(inputPointer);
    }
  }
}

main().catch((error: unknown) => {
  writeParserDiagnostic();
  process.exit(statusFromError(error));
});
