'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const shared = require('../dist/index.js');

test('Tutor message blocks preserve plain text and classify explicit teaching sections', () => {
  const blocks = shared.parseTutorMessageBlocks([
    'A short introduction.',
    '',
    '## Example',
    'A concrete case.',
    '',
    '## Exercise',
    'Try this yourself.',
    '',
    '## Summary',
    'The essential idea.',
    '',
    '## Next step',
    'Apply it once more.',
  ].join('\n'));
  assert.deepEqual(blocks.map((block) => block.kind), [
    'TEXT', 'EXAMPLE', 'EXERCISE', 'SUMMARY', 'ACTION',
  ]);
  assert.equal(blocks[0].content, 'A short introduction.');
});

test('Tutor citations become interactive source blocks without replacing the answer', () => {
  const citation = {
    documentId: 'doc-1', documentTitle: 'Biology notes', chunkIndex: 2, score: 0.91,
  };
  const blocks = shared.parseTutorMessageBlocks('Grounded explanation.', [citation]);
  assert.equal(blocks[0].kind, 'TEXT');
  assert.equal(blocks[1].kind, 'SOURCE');
  assert.deepEqual(blocks[1].citation, citation);
});

test('French headings map to the same stable message vocabulary', () => {
  const blocks = shared.parseTutorMessageBlocks('## Explication\nIdée.\n## Question de compréhension\nPourquoi ?');
  assert.deepEqual(blocks.map((block) => block.kind), ['TEACHING_BLOCK', 'QUESTION']);
});
