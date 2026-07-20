const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getSzsOutput,
  getSzsStatus,
  getSzsStatusMessage
} = require('../out/systemB4TptpOutput');

test('getSzsStatus extracts a success status', () => {
  const output = [
    '% [INFO] Parsing done.',
    '% SZS status Success for problem : Type check succeeded'
  ].join('\n');

  assert.equal(getSzsStatus(output), 'Success');
});

test('getSzsStatus extracts a type-error status', () => {
  const output =
    '% SZS status TypeError for problem : Problem is not well-typed';

  assert.equal(getSzsStatus(output), 'TypeError');
});

test('getSzsStatusMessage extracts all text after the first colon', () => {
  const outputs = [
    [
      '% SZS status TypeError for /tmp/SwwGaHgmBe/SOT_Lh8QMt : Problem is not well-typed',
      'Problem is not well-typed'
    ],
    [
      "% SZS status SyntaxError for /tmp/N0V9SIj94_/SOT_BHhD5F : Parse error in file '/tmp/N0V9SIj94_/SOT_BHhD5F' in line 11:40. Unrecognized token '<~'",
      "Parse error in file '/tmp/N0V9SIj94_/SOT_BHhD5F' in line 11:40. Unrecognized token '<~'"
    ],
    [
      "% SZS status SyntaxError for /tmp/lHM9ZFyxij/SOT_dlgIer : Parse error in file '/tmp/lHM9ZFyxij/SOT_dlgIer' in line 10:1. Expected DOT but read LOWERWORD 'tff'",
      "Parse error in file '/tmp/lHM9ZFyxij/SOT_dlgIer' in line 10:1. Expected DOT but read LOWERWORD 'tff'"
    ]
  ];

  for (const [output, expected] of outputs) {
    assert.equal(getSzsStatusMessage(output), expected);
  }
});

test('getSzsStatusMessage returns undefined when the status has no message', () => {
  assert.equal(getSzsStatusMessage('% SZS status Success for problem'), undefined);
});

test('getSzsStatus returns undefined when there is no status line', () => {
  assert.equal(getSzsStatus('% [INFO] Parsing done.'), undefined);
});

test('getSzsStatus ignores a status line within an SZS output block', () => {
  const output = [
    '% START OF SYSTEM OUTPUT',
    '% [INFO] \t Parsing problem /tmp/SwwGaHgmBe/SOT_Lh8QMt ...',
    '% [INFO] \t Parsing done (133ms).',
    '',
    '% SZS output start LogicalData for /tmp/SwwGaHgmBe/SOT_Lh8QMt',
    'Illtyped formula distinct_cats in line 18:1.',
    'Illtyped formula jon_owns_garfields_lovers in line 29:5.',
    '',
    '% SZS status TypeError for /tmp/SwwGaHgmBe/SOT_Lh8QMt : Problem is not well-typed',
    '',
    '% SZS output end LogicalData for /tmp/SwwGaHgmBe/SOT_Lh8QMt',
    '',
    '% END OF SYSTEM OUTPUT'
  ].join('\n');

  assert.equal(getSzsStatus(output), undefined);
});

test('getSzsStatus extracts a status after an SZS output block', () => {
  const output = [
    '% SZS output start LogicalData for problem',
    '% SZS status TypeError for nested-output',
    '% SZS output end LogicalData for problem',
    '% SZS status Success for problem'
  ].join('\r\n');

  assert.equal(getSzsStatus(output), 'Success');
});

test('getSzsOutput extracts multiline output and preserves blank lines', () => {
  const output = [
    '% START OF SYSTEM OUTPUT',
    '% SZS output start LogicalData for problem',
    'Test: multi-line output',
    '',
    'Illtyped formula example in line 29:1.',
    '% SZS output end LogicalData for problem',
    '% END OF SYSTEM OUTPUT'
  ].join('\n');

  assert.equal(
    getSzsOutput(output),
    'Test: multi-line output\n\nIlltyped formula example in line 29:1.'
  );
});

test('getSzsOutput extracts content between the outermost duplicated markers', () => {
  const output = [
    '% SZS output start LogicalData for outer',
    '% SZS output start LogicalData for inner',
    'Test: multi-line output',
    '',
    'Illtyped formula example in line 29:1.',
    '% SZS output end LogicalData for inner',
    '% SZS output end LogicalData for outer'
  ].join('\n');

  const expected = [
    '% SZS output start LogicalData for inner',
    'Test: multi-line output',
    '',
    'Illtyped formula example in line 29:1.',
    '% SZS output end LogicalData for inner'
  ].join('\n');

  assert.equal(getSzsOutput(output), expected);
});

test('getSzsOutput supports CRLF line endings', () => {
  const output = [
    '% SZS output start LogicalData for problem',
    'First line',
    '',
    'Second line',
    '% SZS output end LogicalData for problem'
  ].join('\r\n');

  assert.equal(getSzsOutput(output), 'First line\r\n\r\nSecond line');
});

test('getSzsOutput returns undefined when the start marker is missing', () => {
  const output = [
    'Illtyped formula example in line 29:1.',
    '% SZS output end LogicalData for problem'
  ].join('\n');

  assert.equal(getSzsOutput(output), undefined);
});

test('getSzsOutput returns undefined when the end marker is missing', () => {
  const output = [
    '% SZS output start LogicalData for problem',
    'Illtyped formula example in line 29:1.'
  ].join('\n');

  assert.equal(getSzsOutput(output), undefined);
});
