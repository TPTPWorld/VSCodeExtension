const assert = require('node:assert/strict');
const test = require('node:test');

const { parseTptpDocument } = require('../out/parser/tptpAntlrParser');

test('loads and caches the requested parser independently for each grammar', async () => {
  const { default: OriginalParser } = await import('../parser/vendor/tptp-antlr/original/TPTPParser.js');
  const { default: OptimizedParser } = await import('../parser/vendor/tptp-antlr/optimized/TPTPParser.js');
  const calls = [];
  const original = OriginalParser.prototype.tptp_file;
  const optimized = OptimizedParser.prototype.tptp_file;
  OriginalParser.prototype.tptp_file = function () {
    calls.push('original');
    return original.call(this);
  };
  OptimizedParser.prototype.tptp_file = function () {
    calls.push('optimized');
    return optimized.call(this);
  };

  try {
    for (const useOptimizedGrammar of [true, false, true, false]) {
      const result = await parseTptpDocument('tff(a,axiom,(p => q)).', useOptimizedGrammar);
      assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
    }
    assert.deepEqual(calls, ['optimized', 'original', 'optimized', 'original']);
  } finally {
    OriginalParser.prototype.tptp_file = original;
    OptimizedParser.prototype.tptp_file = optimized;
  }
});

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
  assert.equal(result.diagnostics[0].source, 'tptp-antlr');
  assert.equal(result.diagnostics[0].range.start.line, 1);
  assert.match(result.diagnostics[0].message, /^TPTP ANTLR parser:/);
});

test('rejects invalid input after a complete formula', async () => {
  const result = await parseTptpDocument('fof(valid,axiom,p).\n@\n');

  assert.equal(result.ok, false);
  assert.ok(result.summary.syntaxErrorCount > 0);
  assert.equal(result.diagnostics[0].range.start.line, 1);
});

test('accepts TFF constructs preserved by the factoring pass', async t => {
  for (const formula of [
    'X',
    '1 = 2',
    '1 != 2',
    '[] = [p,q]',
    '(p & q) = r',
    'p = (~q)',
    'f(p & q)',
    'f(! [X:$i] : p(X))',
    'p == q',
    '([p] --> [q])',
    'p & q & r',
    'p | q | r',
    '! [X:$i] : p(X) & q',
    '[.] p',
  ]) {
    await t.test(formula, async () => {
      const result = await parseTptpDocument(`tff(a,axiom,(${formula})).`);

      assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
      assert.equal(result.summary.syntaxErrorCount, 0);
      assert.deepEqual(result.diagnostics, []);
    });
  }
});

test('rejects invalid TFF operands and connective scopes after factoring', async t => {
  for (const formula of [
    '1',
    '[]',
    'p | q & r',
    'p => q => r',
    'p = q = r',
    'p = ~q',
    '~p = q',
    'X == q',
    '(p) == q',
  ]) {
    await t.test(formula, async () => {
      const result = await parseTptpDocument(`tff(a,axiom,(${formula})).`);

      assert.equal(result.ok, false, formula);
      assert.ok(result.summary.syntaxErrorCount > 0);
      assert.equal(result.summary.syntaxErrorCount, result.diagnostics.length);
      for (const diagnostic of result.diagnostics) {
        assert.match(diagnostic.message, /^TPTP ANTLR parser:/);
      }
    });
  }
});
