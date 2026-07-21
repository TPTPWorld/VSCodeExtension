const test = require('node:test');
const assert = require('node:assert/strict');

const {
  formatTypeCheckStatusMessage,
  getLeoIIITypeErrors
} = require('../out/typeCheck/errors');

test('formatTypeCheckStatusMessage removes the temporary file from syntax errors', () => {
  const message =
    "Parse error in file '/tmp/9wGGhEopjp/SOT_zt320r' in line 14:5. Expected COMMA but read LOWERWORD 'f'";

  assert.equal(
    formatTypeCheckStatusMessage('SyntaxError', message),
    "Parse error in line 14:5. Expected COMMA but read LOWERWORD 'f'"
  );
});

test('formatTypeCheckStatusMessage discards the generic type-error message', () => {
  assert.equal(
    formatTypeCheckStatusMessage('TypeError', 'Problem is not well-typed'),
    ''
  );
});

test('getLeoIIITypeErrors extracts every reported formula and location', () => {
  const output = [
    'Illtyped formula first_formula in line 29:1.',
    'Some unrelated output.',
    'Illtyped formula \'formula with spaces\' in line 42:17.'
  ].join('\n');

  assert.deepEqual(getLeoIIITypeErrors(output), [
    {
      formulaName: 'first_formula',
      line: 29,
      character: 1,
      message: 'Illtyped formula first_formula in line 29:1.'
    },
    {
      formulaName: "'formula with spaces'",
      line: 42,
      character: 17,
      message: "Illtyped formula 'formula with spaces' in line 42:17."
    }
  ]);
});

test('getLeoIIITypeErrors ignores malformed and non-positive locations', () => {
  const output = [
    'Illtyped formula missing_period in line 3:4',
    'Illtyped formula zero_line in line 0:4.',
    'Illtyped formula zero_character in line 3:0.'
  ].join('\n');

  assert.deepEqual(getLeoIIITypeErrors(output), []);
});
