import * as fs from 'fs';
import * as path from 'path';
import createTPTP4X from '../resources/wasm/tptp4X_wasm.js';

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
  print(): void;
  printErr(): void;
  quit(status: number, error: unknown): never;
  wasmBinary: ArrayBuffer | ArrayBufferView;
}) => Promise<TPTP4XModule>;

function readStdin(): string {
  return fs.readFileSync(0, 'utf8');
}

/**
 * Copies a JavaScript string into WASM memory
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

function statusFromError(error: unknown): number {
  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as { status?: unknown }).status === 'number'
  ) {
    return (error as { status: number }).status || 1;
  }
  return 1;
}

async function main(): Promise<void> {
  const wasmDirectory = path.join(__dirname, '..', 'resources', 'wasm');
  const module = await createTPTP4X({
    locateFile: (file: string) => path.join(wasmDirectory, file),
    // print and printErr are silenced because stdout is reserved for the formatted TPTP output
    print: () => undefined,
    printErr: () => undefined,
    quit: (status: number, error: unknown): never => {
      const throwable = error instanceof Error ? error : new Error(`WASM exited with status ${status}`);
      (throwable as Error & { status?: number }).status = status;
      throw throwable;
    },
    wasmBinary: fs.readFileSync(path.join(wasmDirectory, 'tptp4X_wasm.wasm')),
  });

  let inputPointer = 0;
  let outputPointer = 0;

  try {
    inputPointer = writeString(module, readStdin());
    outputPointer = module._tptp4x_pretty_print_tptp(inputPointer);

    if (!outputPointer) {
      process.exit(1);
    }

    process.stdout.write(module.UTF8ToString(outputPointer));
  } finally {
    if (outputPointer) {
      module._tptp4x_free_string(outputPointer);
    }
    if (inputPointer) {
      module._free(inputPointer);
    }
  }
}

main().catch((error: unknown) => {
  process.exit(statusFromError(error));
});
