const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const research = fs.readFileSync(path.join(root, 'app', 'research.tsx'), 'utf8');
const scan = fs.readFileSync(path.join(root, 'app', 'scan.tsx'), 'utf8');
const markdown = fs.readFileSync(path.join(root, 'components', 'markdown.tsx'), 'utf8');

test('research presents real source cards before the cited answer and bounds follow-ups to three', () => {
  const resultLayout = research.indexOf('{sourceStrip}');
  const citedAnswer = research.indexOf('<ResearchResultView result={result}');

  assert.ok(resultLayout >= 0, 'source strip is rendered');
  assert.ok(citedAnswer > resultLayout, 'sources are rendered before the answer');
  assert.match(research, /followUpQuestions[^\n]*\.slice\(0, 3\)/);
  assert.match(research, /testID="research-follow-ups"/);
  assert.match(research, /<SourceCitation/);
  assert.match(research, /<SourcePreview/);
  assert.match(research, /<Markdown text=\{result\.synthesis\} citations=\{result\.citations\} onCitation=\{onCitation\}/);
  assert.match(markdown, /accessibilityRole="link"/);
  assert.match(markdown, /onPress=\{\(\) => onCitation/);
});

test('research keeps unavailable providers discreet inside their filters', () => {
  assert.match(research, /disabled \? ' ⚠' : ''/);
  assert.doesNotMatch(research, /<Alert[^>]+research10\.webUnavailable/);
  assert.doesNotMatch(research, /<Alert[^>]+research10\.externalUnavailable/);
});

test('research universal input reuses document ingestion, scan and speech transcription', () => {
  assert.match(research, /pickDocuments\(false, false\)/);
  assert.match(research, /uploadPickedDocument\(picked/);
  assert.match(research, /\['documents' as const, \.\.\.current\]\.slice\(0, 4\)/);
  assert.match(research, /apiUpload<TranscriptionResult>\('\/speech\/stt'/);
  assert.match(research, /source: 'research'/);
  assert.match(scan, /testID="scan-return-to-research"/);
  assert.match(scan, /pathname: '\/research'/);
  assert.match(scan, /documentId: done\.id/);
  assert.match(scan, /captureStatus: done\.status/);
  assert.match(research, /attachedSourceReady/);
  assert.match(research, /isTerminalDocumentStatus/);
});

test('research prefers real document pages before internal chunk indexes', () => {
  assert.match(research, /citation\.pageNumber !== undefined/);
  assert.ok(research.indexOf('citation.pageNumber !== undefined') < research.indexOf('citation.chunkIndex !== undefined'));
});
