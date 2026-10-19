'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { WORKSPACE_WORK_INTENTS, WORKSPACE_WORK_OUTPUT_KINDS } = require('@second-brain/shared');
const {
  workContractFromIntent,
  workContractResponseSchema,
  workOutputKindForIntent,
  prepareWorkContractCriteria,
  resolveWorkCriteriaApplicability,
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
          workEvidence: contract.criteria.map((criterion) => ({ criterionId: criterion.id, requirement: criterion.requirement, excerpt: item.draft })),
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

function assertStrictSchema(schema, isRoot = true) {
  assert.notEqual(schema.type, 'null');
  if (isRoot) assert.equal(schema.anyOf, undefined);
  if (schema.anyOf) schema.anyOf.forEach((variant) => assertStrictSchema(variant, false));
  assert.equal(schema.allOf, undefined);
  if (schema.type === 'object') {
    assert.equal(schema.additionalProperties, false);
    assert.deepEqual(schema.required.slice().sort(), Object.keys(schema.properties).sort());
    Object.values(schema.properties).forEach((property) => assertStrictSchema(property, false));
  }
  if (schema.items) assertStrictSchema(schema.items, false);
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

test('bootstrap uses obligation-field provenance and never promotes a title or test context', () => {
  // Captured request structure only: this is NOT reconstructed provider output.
  const brief = { version: 1, fields: {
    userInstructions: 'Calculate the price of three notebooks and one book. Include the calculation and conclusion.',
    requirements: 'Calculate the total price and state the amount to pay.',
    deliverable: 'A detailed calculation and conclusion in euros.',
    subject: 'Price calculation — short exercise',
    context: 'Technical account used only for validation.',
  } };
  const objective = 'Find the total cost with calculation and conclusion.';
  const canonical = [brief.fields.userInstructions, brief.fields.requirements, brief.fields.deliverable,
    objective, brief.fields.subject, brief.fields.context].join('\n\n');
  const contract = workContractFromIntent('assignment-exercise', 'assignment', canonical, plan, { brief, objective, sourceAvailable: false });
  assert.deepEqual(contract.criteria.map((criterion) => criterion.originField),
    ['userInstructions', 'requirements', 'deliverable', 'objective']);
  assert.equal(contract.criteria.length, 4);
  assert.ok(contract.criteria.every((criterion) => criterion.required && criterion.classification === 'REQUIRED'));
  assert.ok(!contract.criteria.some((criterion) => [brief.fields.subject, brief.fields.context].includes(criterion.requirement)));
  const { createHash } = require('node:crypto');
  assert.equal(contract.instructionFingerprint, createHash('sha256').update(canonical).digest('hex'));
  const titleOnly = { version: 1, fields: { subject: 'Title only', context: 'Context only' } };
  assert.throws(() => workContractFromIntent('general', 'other', 'Title only\n\nContext only', plan, { brief: titleOnly, objective: '' }));
});

test('provenance exclusion does not discard a genuine obligation merely repeated as the title', () => {
  const text = 'Calculate the total price.';
  const brief = { version: 1, fields: { userInstructions: text, subject: text } };
  const contract = workContractFromIntent('assignment-exercise', 'assignment', `${text}\n\n${text}`, plan, { brief, objective: '' });
  assert.equal(contract.criteria.length, 1);
  assert.equal(contract.criteria[0].originField, 'userInstructions');
  assert.equal(contract.criteria[0].required, true);
});

test('bounded autonomous source conditions are conditional, never unconditionally mandatory', () => {
  for (const sentence of ['Utilise une source si elle est disponible dans ma bibliothèque.', 'Use a source if available.']) {
    const instructions = `Calculate the total price. ${sentence}`;
    const unavailable = workContractFromIntent('assignment-exercise', 'assignment', instructions, plan, { sourceAvailable: false });
    assert.equal(unavailable.criteria.length, 2);
    assert.equal(unavailable.criteria[0].required, true);
    const conditional = unavailable.criteria[1];
    assert.equal(conditional.classification, 'CONDITIONAL');
    assert.equal(conditional.condition, 'SOURCE_AVAILABLE');
    assert.equal(conditional.required, true);
    assert.equal(conditional.applicable, false);
    const available = resolveWorkCriteriaApplicability(unavailable, true).criteria[1];
    assert.equal(available.required, true);
    assert.equal(available.applicable, true);
    const unknown = resolveWorkCriteriaApplicability(unavailable).criteria[1];
    assert.equal(unknown.required, true);
    assert.equal(unknown.applicable, 'UNKNOWN');
  }
});

test('ambiguous conditional conjunctions are retained and UNKNOWN rather than waived', () => {
  const instructions = 'Compute the total. Use a source if available and explain all calculation steps.';
  const contract = workContractFromIntent('assignment-exercise', 'assignment', instructions, plan, { sourceAvailable: false });
  const conditional = contract.criteria.find((criterion) => criterion.classification === 'CONDITIONAL');
  assert.ok(conditional);
  assert.equal(conditional.condition, 'UNRESOLVED');
  assert.equal(conditional.applicable, 'UNKNOWN');
  assert.equal(conditional.required, true);
  assert.match(conditional.requirement, /explain all calculation steps/);
});

test('OPTIONAL can be omitted but explicit FORMAT and STYLE remain blocking when required', () => {
  const instructions = 'Compute the total.\n\nOptional: add a second example.\n\nFormat: include an introduction and a conclusion.\n\nStyle: use accessible wording.';
  const contract = workContractFromIntent('assignment-exercise', 'assignment', instructions, plan, { sourceAvailable: false });
  assert.deepEqual(contract.criteria.map((criterion) => [criterion.classification, criterion.required]),
    [['REQUIRED', true], ['OPTIONAL', false], ['FORMAT', true], ['STYLE', true]]);
  const optional = contract.criteria[1];
  assert.equal(optional.applicable, false);
  const contradictory = { ...contract, criteria: [{ ...optional, required: true }] };
  assert.throws(() => resolveWorkCriteriaApplicability(contradictory, false));
  assert.throws(() => resolveWorkCriteriaApplicability({ ...contract, criteria: [{ ...contract.criteria[0], required: false }] }, false));
});

test('server applicability ignores a supplied false flag and validates obligation anchors', () => {
  const brief = { version: 1, fields: { userInstructions: 'Use a source if available.', requirements: 'Compute the total.' } };
  const instructions = `${brief.fields.userInstructions}\n\n${brief.fields.requirements}`;
  const contract = workContractFromIntent('assignment-exercise', 'assignment', instructions, plan, { brief, objective: '', sourceAvailable: false });
  const prepared = prepareWorkContractCriteria({ ...contract, criteria: contract.criteria.map((criterion) => ({ ...criterion, applicable: false })) }, brief, '', true);
  assert.equal(prepared.criteria[0].applicable, true);
  assert.equal(prepared.criteria[0].required, true);
  assert.equal(prepared.criteria[1].applicable, true);
  assert.equal(prepared.criteria[1].required, true);
  assert.throws(() => prepareWorkContractCriteria({ ...contract, criteria: [{ id: 'invented', requirement: 'Only technical context.', required: true }] }, brief, '', false));
});

test('known WORK schema binds evidence by ID and pins classification without accepting applicability from the provider', () => {
  const contract = workContractFromIntent('assignment-exercise', 'assignment', 'Compute the total. Use a source if available.', plan, { sourceAvailable: false });
  const schema = workContractResponseSchema('WORK', contract).schema;
  assertStrictSchema(schema);
  assert.ok(schema.properties.workEvidence.items.required.includes('criterionId'));
  assert.deepEqual(schema.properties.workEvidence.items.properties.criterionId.enum, contract.criteria.map((criterion) => criterion.id));
  const variants = schema.properties.workContract.properties.criteria.items.anyOf;
  assert.equal(variants.length, contract.criteria.length);
  for (const [index, variant] of variants.entries()) {
    assert.deepEqual(variant.properties.id.enum, [contract.criteria[index].id]);
    assert.deepEqual(variant.properties.classification.enum, [contract.criteria[index].classification]);
    assert.deepEqual(variant.properties.required.enum, [contract.criteria[index].required]);
    assert.equal(variant.properties.applicable, undefined);
  }
});
