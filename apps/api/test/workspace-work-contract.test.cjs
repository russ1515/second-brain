'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { WORKSPACE_WORK_INTENTS, WORKSPACE_WORK_OUTPUT_KINDS } = require('@second-brain/shared');
const {
  workContractFromIntent,
  workContractResponseSchema,
  workOutputKindForIntent,
} = require('../dist/workspaces/workspace-work-contract.js');
const {
  assertAutopilotWorkArtifact,
  parseAutopilotOutput,
  workspaceWorkOutputKind,
} = require('../dist/workspaces/workspace-autopilot.js');

const plan = [{ id: 'section-1', title: 'Current section', order: 0, completed: false }];
const cases = [
  { intent: 'assignment-exercise', template: 'assignment', type: 'ANSWER_DRAFT', task: 'Compute the total for two items at three euros each.', draft: '2 × 3 € = 6 €. The total price is six euros.' },
  { intent: 'article-summary', template: 'article', type: 'SUMMARY_DRAFT', task: 'Summarize the supplied text.', draft: 'The association opens its reading room every Saturday.', material: 'The local association opens its reading room on Saturdays for all residents.' },
  { intent: 'argumentative-essay', template: 'dissertation', type: 'ARGUMENTATIVE_DRAFT', task: 'Argue whether a public reading room is useful.', draft: 'A public reading room is useful because it makes books accessible. Although staffing has a cost, shared access benefits many readers. Its public value therefore justifies modest support.' },
  { intent: 'research-task', template: 'academic-research', type: 'SOURCED_RESEARCH_DRAFT', task: 'Explain the reading room schedule from the authorized source.', draft: 'The room opens on Saturdays, according to the authorized notice [W1].', source: true },
  { intent: 'academic-section', template: 'tfc', type: 'CURRENT_ACADEMIC_SECTION_DRAFT', task: 'Draft only the section describing the planned observation method.', draft: 'This section proposes observing the opening schedule and recording attendance. No attendance results have yet been collected.' },
];

function contractFor(item) {
  return workContractFromIntent(item.intent, item.template, item.task, plan,
    item.material ? { sourceMaterial: item.material } : undefined);
}

for (const item of cases) {
  test(`${item.intent}: explicit intent survives each orchestration phase and valid parser/validator to draft`, () => {
    const contract = contractFor(item);
    assert.equal(contract.outputKind, item.type);
    assert.equal(contract.taskIntent, item.intent);
    for (const phase of ['COMPREHENSION', 'METHOD', 'WORK']) {
      const response = workContractResponseSchema(phase, contract);
      assert.deepEqual(response.schema.properties.workContract.properties.taskIntent.enum, [item.intent]);
      assert.deepEqual(response.schema.properties.workContract.properties.outputKind.enum, [item.type]);
      const normalized = parseAutopilotOutput(JSON.stringify({
        text: 'Prepared.', workContract: contract, issues: [], needsInput: '',
        ...(phase === 'WORK' ? {
          draft: item.draft, workOutputKind: item.type,
          workEvidence: contract.criteria.map((criterion) => ({ requirement: criterion.requirement, excerpt: item.draft })),
        } : { briefFields: {}, plan: [] }),
      }));
      assert.equal(normalized.workContract.taskIntent, item.intent);
      assert.equal(normalized.workContract.outputKind, item.type);
      if (phase === 'WORK') {
        const accepted = assertAutopilotWorkArtifact(normalized, item.template, item.task, {
          contract, plan, sourceMaterial: item.material,
          ...(item.source ? { sourceContext: 'Authorized notice: open on Saturdays.', citations: [{ citationLabel: 'W1' }] } : {}),
        });
        assert.equal(accepted.outputKind, item.type);
        assert.equal(normalized.draft, item.draft);
      }
    }
  });
}

test('all eight canonical types remain unchanged and intent never becomes a shell classifier', () => {
  assert.equal(WORKSPACE_WORK_INTENTS.length, 8);
  assert.deepEqual(WORKSPACE_WORK_INTENTS.map(workOutputKindForIntent), WORKSPACE_WORK_OUTPUT_KINDS);
  for (const intent of WORKSPACE_WORK_INTENTS) {
    assert.equal(workOutputKindForIntent(intent), workspaceWorkOutputKind('other', { taskIntent: intent }));
  }
  const summary = workContractFromIntent('article-summary', 'article', 'Summarize the source.', plan, { sourceMaterial: 'The room opens on Saturdays.' });
  assert.equal(summary.outputKind, 'SUMMARY_DRAFT');
  assert.equal(summary.scope, 'entire-task');
  assert.notEqual(summary.outputKind, workspaceWorkOutputKind('article'));
});

test('criteria retain every original paragraph and size-bounded chunk without crossing field boundaries', () => {
  const first = 'A'.repeat(2_001);
  const second = 'Seconde obligation complète.';
  const contract = workContractFromIntent('general', 'other', `${first}\n\n${second}`, plan);
  assert.equal(contract.criteria.length, 3);
  assert.equal(contract.criteria.map((item) => item.requirement).join(''), first + second);
  assert.ok(contract.criteria.every((item) => item.requirement.length <= 2_000 && item.required));
  assert.equal(contract.criteria[2].requirement, second);
  assert.throws(() => workContractFromIntent('general', 'other', Array.from({ length: 101 }, (_, index) => `Obligation ${index}.`).join('\n\n'), plan));
  assert.throws(() => workContractFromIntent('general', 'other', '   ', plan));
});

test('summary never substitutes the request itself for source material', () => {
  const request = 'Summarize the attached article.';
  const missingMaterial = workContractFromIntent('article-summary', 'article', request, plan);
  assert.equal(missingMaterial.sourceRequirement, 'cited-evidence');
  assert.equal(missingMaterial.sourceExcerpt, undefined);
  const provided = workContractFromIntent('article-summary', 'article', request, plan, { sourceMaterial: 'The room is open every Saturday.' });
  assert.equal(provided.sourceRequirement, 'provided-content');
  assert.equal(provided.sourceExcerpt, 'The room is open every Saturday.');
});

function assertStrictSchema(schema) {
  assert.notEqual(schema.type, 'null');
  assert.equal(schema.anyOf, undefined);
  assert.equal(schema.allOf, undefined);
  if (schema.type === 'object') {
    assert.equal(schema.additionalProperties, false);
    assert.deepEqual(schema.required.slice().sort(), Object.keys(schema.properties).sort());
    Object.values(schema.properties).forEach(assertStrictSchema);
  }
  if (schema.items) assertStrictSchema(schema.items);
}

test('C/M/WORK use strict existing Responses schemas with no optional object keys or null sentinels', () => {
  for (const phase of ['COMPREHENSION', 'METHOD', 'WORK']) {
    const response = workContractResponseSchema(phase);
    assert.equal(response.strict, true);
    assert.match(response.name, /^workspace_[a-z]+_contract_v1$/);
    assertStrictSchema(response.schema);
    assert.ok(response.schema.required.includes('workContract'));
    assert.ok(response.schema.required.includes('needsInput'));
    if (phase === 'WORK') {
      assert.ok(response.schema.required.includes('draft'));
      assert.ok(response.schema.required.includes('workOutputKind'));
      assert.ok(response.schema.required.includes('workEvidence'));
    } else {
      assert.ok(response.schema.required.includes('plan'));
      assert.ok(response.schema.required.includes('briefFields'));
    }
  }
  assert.equal(workContractResponseSchema('CAPTURE'), undefined);
  assert.equal(workContractResponseSchema('VERIFICATION'), undefined);
  assert.equal(workContractResponseSchema('FINALIZATION'), undefined);
});

test('typed intent constrains the C/M schema before a full contract exists', () => {
  const response = workContractResponseSchema('COMPREHENSION', undefined, 'article-summary');
  assert.deepEqual(response.schema.properties.workContract.properties.taskIntent.enum, ['article-summary']);
  assert.deepEqual(response.schema.properties.workContract.properties.outputKind.enum, ['SUMMARY_DRAFT']);
});

test('known WORK schema pins type/intent but does not bypass existing artifact validation', () => {
  const item = cases[0];
  const contract = contractFor(item);
  const schema = workContractResponseSchema('WORK', contract).schema;
  assert.deepEqual(schema.properties.workOutputKind.enum, ['ANSWER_DRAFT']);
  const response = (draft, type = 'ANSWER_DRAFT') => parseAutopilotOutput(JSON.stringify({
    text: 'Prepared.', workContract: contract, draft, workOutputKind: type,
    workEvidence: [{ requirement: item.task, excerpt: draft }],
  }));
  assert.throws(() => assertAutopilotWorkArtifact(response(''), item.template, item.task, { contract, plan }));
  assert.throws(() => assertAutopilotWorkArtifact(response(item.task), item.template, item.task, { contract, plan }));
  assert.throws(() => assertAutopilotWorkArtifact(response(item.draft, 'REPORT_DRAFT'), item.template, item.task, { contract, plan }));
});
