const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { setTimeout: delay } = require('node:timers/promises');
const vm = require('node:vm');
const { Worker } = require('node:worker_threads');
const {
  CancellationToken,
  CancellationTokenSource,
  LSPErrorCodes,
} = require('vscode-languageserver/node');

const { parseTptpDocumentInWorker } = require('../out/parser/tptpAntlrWorkerRunner');

test('parses valid text in a worker', async () => {
  const result = await parseTptpDocumentInWorker('fof(valid,axiom,p).', CancellationToken.None);

  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.summary.syntaxErrorCount, 0);
});

test('returns source diagnostics from the worker', async () => {
  const result = await parseTptpDocumentInWorker(
    '% invalid formula\ntff(bad,axiom,$less(20,)).\n',
    CancellationToken.None
  );

  assert.equal(result.ok, false);
  assert.equal(result.summary.syntaxErrorCount, result.diagnostics.length);
  assert.equal(result.diagnostics[0].range.start.line, 1);
  assert.equal(result.diagnostics[0].source, 'tptp-antlr');
  assert.match(result.diagnostics[0].message, /^TPTP ANTLR parser:/);
});

test('runs either grammar in the worker and reports syntax errors', async t => {
  for (const useOptimizedGrammar of [true, false]) {
    await t.test(useOptimizedGrammar ? 'optimized' : 'original', async () => {
      const result = await parseTptpDocumentInWorker(
        'tff(a,axiom,(p => q)).', CancellationToken.None, useOptimizedGrammar
      );
      assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
      assert.deepEqual(result.diagnostics, []);

      const malformed = await parseTptpDocumentInWorker(
        '% invalid formula\ntff(a,axiom,1).', CancellationToken.None, useOptimizedGrammar
      );
      assert.equal(malformed.ok, false);
      assert.ok(malformed.summary.syntaxErrorCount > 0);
      assert.equal(malformed.diagnostics[0].range.start.line, 1);
      assert.match(malformed.diagnostics[0].message, /^TPTP ANTLR parser:/);
    });
  }
});

test('rejects an already cancelled request without parsing', async () => {
  await assert.rejects(
    parseTptpDocumentInWorker('fof(valid,axiom,p).', CancellationToken.Cancelled),
    error => error.code === LSPErrorCodes.RequestCancelled
  );
});

test('parses deeply nested TFF implications in a worker', { timeout: 10000 }, async t => {
  const source = new CancellationTokenSource();
  t.after(() => {
    source.cancel();
    source.dispose();
  });
  const text = 'tff(nested,axiom,' + '(p => '.repeat(107) + 'q' + ')'.repeat(107) + ').';
  const result = await parseTptpDocumentInWorker(text, source.token);

  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.summary.syntaxErrorCount, 0);
  assert.deepEqual(result.diagnostics, []);

  const malformed = await parseTptpDocumentInWorker(text.slice(0, -1), source.token);
  assert.equal(malformed.ok, false);
  assert.ok(malformed.summary.syntaxErrorCount > 0);
  assert.match(malformed.diagnostics[0].message, /^TPTP ANTLR parser:/);
});

test('keeps the server event loop responsive and terminates a cancelled parse', { timeout: 10000 }, async () => {
  // Use a busy real worker so cancellation never depends on grammar performance.
  let markStarted;
  const started = new Promise(resolve => { markStarted = resolve; });
  let workerData;
  class BusyWorker extends Worker {
    constructor(_filename, options) {
      super('while (true) {}', { eval: true });
      workerData = options.workerData;
      this.once('online', markStarted);
    }
  }
  const filename = require.resolve('../out/parser/tptpAntlrWorkerRunner');
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    exports: module.exports,
    module,
    __dirname: path.dirname(filename),
    require(id) {
      return id === 'worker_threads' ? { Worker: BusyWorker } : require(id);
    },
  }, { filename });

  const source = new CancellationTokenSource();
  let settled = false;
  const parsing = module.exports.parseTptpDocumentInWorker('fof(valid,axiom,p).', source.token, false);
  const cancelled = assert.rejects(parsing, error => {
    assert.equal(error.code, LSPErrorCodes.RequestCancelled);
    return true;
  });
  void parsing.then(() => { settled = true; }, () => { settled = true; });

  try {
    await started;
    // This timer must run while the worker is busy with synchronous work.
    await delay(20);
    assert.equal(settled, false);
    assert.equal(workerData.text, 'fof(valid,axiom,p).');
    assert.equal(workerData.useOptimizedGrammar, false);
  } finally {
    source.cancel();
    await cancelled;
    source.dispose();
  }

  const result = await parseTptpDocumentInWorker('fof(next,axiom,q).', CancellationToken.None);
  assert.equal(result.ok, true);
});
