const assert = require('node:assert/strict');
const test = require('node:test');
const { setTimeout: delay } = require('node:timers/promises');
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
  assert.equal(result.diagnostics[0].source, 'tptp-antlr-experimental');
  assert.match(result.diagnostics[0].message, /^TPTP ANTLR parser:/);
});

test('rejects an already cancelled request without parsing', async () => {
  await assert.rejects(
    parseTptpDocumentInWorker('fof(valid,axiom,p).', CancellationToken.Cancelled),
    error => error.code === LSPErrorCodes.RequestCancelled
  );
});

test('keeps the server event loop responsive and terminates a cancelled parse', { timeout: 10000 }, async () => {
  const source = new CancellationTokenSource();
  const text = 'tff(nested,axiom,' + '(p => '.repeat(300) + 'q' + ')'.repeat(300) + ').';
  let settled = false;
  const parsing = parseTptpDocumentInWorker(text, source.token);
  const cancelled = assert.rejects(parsing, error => {
    assert.equal(error.code, LSPErrorCodes.RequestCancelled);
    return true;
  });
  void parsing.then(() => { settled = true; }, () => { settled = true; });

  try {
    // This timer must run while the expensive parse is still pending.
    await delay(100);
    assert.equal(settled, false);
  } finally {
    source.cancel();
    await cancelled;
    source.dispose();
  }

  const result = await parseTptpDocumentInWorker('fof(next,axiom,q).', CancellationToken.None);
  assert.equal(result.ok, true);
});
