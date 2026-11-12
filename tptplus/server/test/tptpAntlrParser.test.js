const assert = require('node:assert/strict');
const test = require('node:test');

const { parseTptpDocument } = require('../out/parser/tptpAntlrParser');

test('accepts the DAT016_1 conjecture with integer arithmetic and nested quantifiers', async () => {
  const result = await parseTptpDocument(`
% Includes axioms for arrays
include('Axioms/DAT001_0.ax').
tff(co1,conjecture,
    ! [U: array] :
      ( ! [V: $int] :
          ( ( $lesseq(20,V)
            & $lesseq(V,30) )
         => ( read(U,V) = $sum($product(2,V),3) ) )
     => ? [W: $int] : ( read(U,W) = 53 ) ) ).
`);

  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.summary.syntaxErrorCount, 0);
  assert.deepEqual(result.diagnostics, []);
});

test('reports a missing arithmetic argument at its source line', async () => {
  const result = await parseTptpDocument('% invalid formula\ntff(bad,axiom,$less(20,)).\n');

  assert.equal(result.ok, false);
  assert.ok(result.summary.syntaxErrorCount > 0);
  assert.equal(result.summary.syntaxErrorCount, result.diagnostics.length);
  assert.equal(result.diagnostics[0].source, 'tptp-antlr-experimental');
  assert.equal(result.diagnostics[0].range.start.line, 1);
  assert.match(result.diagnostics[0].message, /^TPTP ANTLR parser:/);
});

test('rejects invalid input after a complete formula', async () => {
  const result = await parseTptpDocument('fof(valid,axiom,p).\n@\n');

  assert.equal(result.ok, false);
  assert.ok(result.summary.syntaxErrorCount > 0);
  assert.equal(result.diagnostics[0].range.start.line, 1);
});
