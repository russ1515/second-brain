const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createWorkspaceFinalSnapshot,
  inferWorkspaceTextDirection,
  initialWorkspaceCompletionState,
  renderWorkspaceExportHtml,
  renderWorkspaceMarkdown,
  sanitizeWorkspaceMarkdown,
  workspaceExportFileName,
  workspaceFinalizationBlockers,
} = require('../dist/workspace-completion');

const SHELLS = [
  ['assignment', 'assignment'],
  ['thesis', 'memoire'],
  ['dissertation', 'dissertation'],
  ['article', 'article'],
  ['report', 'report'],
  ['general', 'other'],
];

function input(overrides = {}) {
  return {
    snapshotId: 'snapshot-1',
    logicalVersion: 1,
    workspaceId: 'workspace-1',
    template: 'assignment',
    shell: 'assignment',
    title: 'Analyse académique',
    brief: { version: 1, fields: { subject: 'Sujet' } },
    plan: [{ id: 'step-1', title: 'Introduction', order: 0, completed: true }],
    draft: {
      format: 'markdown',
      content: '## Introduction\n\nTexte final.',
      revision: 4,
      updatedAt: '2026-10-15T10:00:00.000Z',
    },
    sources: [{ kind: 'document', id: 'document-1', title: 'Source' }],
    sourceStates: [{ kind: 'document', id: 'document-1', title: 'Source', availability: 'available' }],
    citations: [{
      sourceType: 'document',
      sourceId: 'document-1',
      documentId: 'document-1',
      title: 'Source vérifiée',
      page: 7,
      url: 'https://example.org/source',
      retrievedAt: '2026-10-15',
      snippet: 'Passage cité.',
      citationLabel: '[1]',
      relevance: 0.91,
    }],
    checks: [
      { id: 'draft', passed: true, required: true },
      { id: 'submission', passed: true, required: true },
    ],
    phase: 'FINALIZATION',
    revision: 4,
    createdAt: '2026-10-15T10:01:00.000Z',
    ...overrides,
  };
}

test('creates deterministic final snapshots for all six shells', () => {
  for (const [shell, template] of SHELLS) {
    const snapshot = createWorkspaceFinalSnapshot(input({ shell, template }));
    assert.equal(snapshot.shell, shell);
    assert.equal(snapshot.template, template);
    assert.equal(snapshot.formatVersion, 1);
    assert.equal(snapshot.revision, 4);
  }
});

test('copies snapshot data so later draft/source mutations cannot rewrite it', () => {
  const mutable = input();
  const snapshot = createWorkspaceFinalSnapshot(mutable);
  mutable.draft.content = 'Changed later';
  mutable.brief.fields.subject = 'Changed later';
  mutable.plan[0].title = 'Changed later';
  mutable.citations[0].title = 'Changed later';
  assert.equal(snapshot.draft.content, '## Introduction\n\nTexte final.');
  assert.equal(snapshot.brief.fields.subject, 'Sujet');
  assert.equal(snapshot.plan[0].title, 'Introduction');
  assert.equal(snapshot.citations[0].title, 'Source vérifiée');
});

test('rejects stale revisions, invalid phases and failed required controls', () => {
  assert.throws(
    () => createWorkspaceFinalSnapshot(input({ revision: 5 })),
    (error) => error.code === 'revision-mismatch',
  );
  assert.throws(
    () => createWorkspaceFinalSnapshot(input({ phase: 'WORK' })),
    (error) => error.code === 'invalid-phase',
  );
  assert.throws(
    () => createWorkspaceFinalSnapshot(input({
      checks: [{ id: 'draft', passed: false, required: true }],
    })),
    (error) => error.code === 'finalization-blocked',
  );
});

test('reports source blockers only when the source control is mandatory', () => {
  const unavailable = [{ kind: 'document', id: 'gone', title: 'Supprimée', availability: 'unavailable' }];
  assert.deepEqual(workspaceFinalizationBlockers({
    phase: 'FINALIZATION',
    draftContent: 'Texte',
    checks: [{ id: 'sources', passed: false, required: false }],
    sourceStates: unavailable,
  }), []);
  assert.deepEqual(workspaceFinalizationBlockers({
    phase: 'FINALIZATION',
    draftContent: 'Texte',
    checks: [{ id: 'sources', passed: true, required: true }],
    sourceStates: unavailable,
  }), [{ code: 'source-unavailable', sourceId: 'gone' }]);
});

test('renders UTF-8 Markdown with only real structured citation fields', () => {
  const snapshot = createWorkspaceFinalSnapshot(input({
    title: 'بحث — Étude',
    draft: { ...input().draft, content: '## المقدمة\n\nDonnées réelles.' },
  }));
  const markdown = renderWorkspaceMarkdown(snapshot, {
    labels: { referencesHeading: 'المراجع', page: 'صفحة' },
  });
  assert.match(markdown, /^# بحث — Étude/m);
  assert.match(markdown, /المقدمة/);
  assert.match(markdown, /Source vérifiée/);
  assert.match(markdown, /https:\/\/example\.org\/source/);
  assert.match(markdown, /صفحة 7/);
  assert.doesNotMatch(markdown, /document-1/);
  assert.doesNotMatch(markdown, /citationLabel/);
});

test('neutralizes hostile HTML and executable Markdown links', () => {
  const hostile = [
    '<script>alert(1)</script>',
    '<iframe src=x></iframe>',
    '<script\nsrc="https://example.org/hostile.js">',
    '[x](javascript:alert(2))',
    '[x [y]](javascript:alert(6))',
    '![x [y]](javascript:alert(7))',
    '[escaped](javascript\\:alert(8))',
    '[nested [escaped]](javascript\\:alert(9))',
    '[multiline](javascript\\:alert(13)\n "title")',
    '[quoted-title](javascript\\:alert(14) "title (")',
    '[quote-in-destination](javascript:alert(15)//")',
    '[reference]: javascript:alert(3)',
    '[escaped-reference]: javascript\\:alert(10)',
    '[foo\\]]: javascript\\:alert(11)',
    '[continued-reference]:',
    '  javascript\\:alert(12)',
    '[evil',
    ' label]: javascript:alert(17)',
    '',
    '[x][evil label]',
    '[entity]: java&#x73;cript:alert(4)',
    '[percent]: javas%63ript:alert(5)',
  ].join('\n');
  const sanitized = sanitizeWorkspaceMarkdown(hostile);
  assert.doesNotMatch(sanitized, /<script/i);
  assert.doesNotMatch(sanitized, /<iframe/i);
  assert.doesNotMatch(sanitized, /javascript:/i);
  assert.doesNotMatch(sanitized, /java&#x73;cript:/i);
  assert.doesNotMatch(sanitized, /javas%63ript:/i);

  const snapshot = createWorkspaceFinalSnapshot(input({
    title: '<img src=x onerror=alert(1)>',
    draft: { ...input().draft, content: hostile },
    citations: [{ ...input().citations[0], url: 'javascript:alert(3)' }],
  }));
  const html = renderWorkspaceExportHtml(snapshot);
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<iframe/i);
  assert.doesNotMatch(html, /<img src=x/i);
  assert.doesNotMatch(html, /javascript:/i);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /charset="utf-8"/);

  const defensiveFallback = sanitizeWorkspaceMarkdown('[fallback](javascript\\:alert(16)');
  assert.match(defensiveFallback, /\]\\\(javascript\\:alert/);
  assert.doesNotMatch(defensiveFallback, /\]\(javascript\\:alert/);
});

test('does not leak an internal source id as an unavailable-source title', () => {
  const internalId = '4c13329f-2a46-47b3-9f4a-91ce20bb73b0';
  const snapshot = createWorkspaceFinalSnapshot(input({
    sourceStates: [{
      kind: 'document',
      id: internalId,
      title: internalId,
      availability: 'unavailable',
      reason: 'deleted',
    }],
  }));
  assert.doesNotMatch(renderWorkspaceMarkdown(snapshot), new RegExp(internalId));
  assert.doesNotMatch(renderWorkspaceExportHtml(snapshot), new RegExp(internalId));
});

test('selects RTL without changing non-Latin content', () => {
  const snapshot = createWorkspaceFinalSnapshot(input({
    title: 'بحث أكاديمي',
    draft: { ...input().draft, content: 'هذه مقدمة عربية واضحة ومتكاملة.' },
  }));
  const html = renderWorkspaceExportHtml(snapshot, { locale: 'ar' });
  assert.equal(inferWorkspaceTextDirection(snapshot.draft.content), 'rtl');
  assert.match(html, /<html lang="ar" dir="rtl">/);
  assert.match(html, /هذه مقدمة عربية/);
});

test('builds filesystem-safe versioned names and empty additive state', () => {
  assert.equal(workspaceExportFileName('Mémoire : essai/2026', 'pdf', 2), 'Mémoire essai 2026-v2.pdf');
  assert.equal(workspaceExportFileName('بحث نهائي', 'markdown', 1), 'بحث نهائي.md');
  assert.deepEqual(initialWorkspaceCompletionState(), {
    version: 1,
    snapshots: [],
    operations: [],
    requestLedger: {},
  });
});
