'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  autopilotProfessorDirective,
  assertAutopilotWorkArtifact,
  AUTOPILOT_DIAGNOSTIC_REASONS,
  createAutopilotDiagnosticException,
  criterionEvidenceMatrix,
  getAutopilotDiagnosticReason,
  parseAutopilotOutput,
  taskFulfillmentIssues,
  validateAutopilotWorkContract,
  workspaceWorkOutputKind,
} = require('../dist/workspaces/workspace-autopilot.js');

const PHYSICS_INSTRUCTIONS = 'Explique la différence entre l’énergie cinétique et l’énergie potentielle. '
  + 'Donne la formule de chacune. Un objet de masse 2 kg se déplace à 5 m/s. '
  + 'Calcule son énergie cinétique et explique ta méthode. '
  + 'Structure avec introduction, méthode, calcul, conclusion.';
const PHYSICS_DRAFT = '# Introduction\n\n'
  + 'L’énergie cinétique est liée au mouvement d’un objet. L’énergie potentielle est liée à sa position ou à sa configuration. '
  + 'Pour la gravitation, elle est définie par rapport à une hauteur de référence.\n\n'
  + '# Méthode\n\n'
  + 'La formule de l’énergie cinétique est Ec = 1/2 mv². Pour l’énergie potentielle de gravitation, Ep = mgh. '
  + 'Les données fournies sont m = 2 kg et v = 5 m/s. La substitution de ces données dans la formule de Ec donne un résultat en joules.\n\n'
  + '# Calcul\n\n'
  + 'v² = 5² = 25 m²/s². Ec = 1/2 × 2 × 25 = 25 J. '
  + 'Aucune hauteur n’est fournie : Ep reste donc symbolique et aucune valeur numérique n’est inventée.\n\n'
  + '# Conclusion\n\n'
  + 'L’objet possède 25 J d’énergie cinétique. Le mouvement détermine ici cette énergie, tandis que l’énergie potentielle dépend de la position ou de la configuration.';

function contractFor(instructions, overrides = {}) {
  return {
    version: 1, taskIntent: 'assignment-exercise', outputKind: 'ANSWER_DRAFT', operation: 'produce',
    scope: 'entire-task', task: instructions,
    criteria: [{ id: 'required-task', requirement: instructions, required: true }],
    sourceRequirement: 'none',
    ...overrides,
  };
}

const PHYSICS_CONTRACT = contractFor(PHYSICS_INSTRUCTIONS, {
  criteria: ['énergie cinétique', 'énergie potentielle', '2 kg', '5 m/s'].map((requirement, index) => ({ id: `physics-${index}`, requirement, required: true })),
});

function artifact(overrides = {}) {
  return {
    text: 'Le brouillon contient les définitions, formules, unités, calcul et conclusion demandés.',
    draft: PHYSICS_DRAFT,
    workOutputKind: 'ANSWER_DRAFT',
    workContract: PHYSICS_CONTRACT,
    workEvidence: [
      { requirement: 'énergie cinétique', excerpt: 'L’énergie cinétique est liée au mouvement d’un objet.' },
      { requirement: 'énergie potentielle', excerpt: 'L’énergie potentielle est liée à sa position ou à sa configuration.' },
      { requirement: '2 kg', excerpt: 'm = 2 kg et v = 5 m/s' },
      { requirement: '5 m/s', excerpt: 'Ec = 1/2 × 2 × 25 = 25 J.' },
    ],
    ...overrides,
  };
}

test('WORK selects eight canonical contracts from the actual task instead of treating the template as the intention', () => {
  const expected = [
    ['assignment', 'assignment-exercise', 'ANSWER_DRAFT'],
    ['article', 'article-summary', 'SUMMARY_DRAFT'],
    ['other', 'research-task', 'SOURCED_RESEARCH_DRAFT'],
    ['memoire', 'academic-section', 'CURRENT_ACADEMIC_SECTION_DRAFT'],
    ['dissertation', 'argumentative-essay', 'ARGUMENTATIVE_DRAFT'],
    ['article', 'scientific-article', 'SCIENTIFIC_DRAFT'],
    ['report', 'report', 'REPORT_DRAFT'],
    ['other', 'general', 'INTENT_MATCHED_DRAFT'],
  ];
  assert.equal(new Set(expected.map((entry) => entry[2])).size, 8);
  for (const [template, taskIntent, outputKind] of expected) {
    const contract = contractFor(PHYSICS_INSTRUCTIONS, { taskIntent, outputKind });
    assert.equal(workspaceWorkOutputKind(template, contract), outputKind);
    const directive = autopilotProfessorDirective('WORK', template, contract);
    assert.match(directive, /criterionId must remain the exact supplied ID/);
    assert.match(directive, /Equivalent criterion wording is associated by stable ID/);
    assert.match(directive, /workEvidence\.excerpt must remain in the exact words of draft/);
    assert.match(directive, /text and draft still use the learner locale/);
  }
});

test('WORK preserves the physics answer as a non-regression fixture, not a universal production answer key', () => {
  const output = parseAutopilotOutput(JSON.stringify(artifact({ workArtifactValidated: true })));
  assert.equal(output.workArtifactValidated, undefined, 'provider JSON cannot certify its own artifact');
  assert.doesNotThrow(() => assertAutopilotWorkArtifact(output, 'assignment', PHYSICS_INSTRUCTIONS));
  for (const required of [/mouvement/, /position ou.*configuration/, /Ec = 1\/2 mv²/, /Ep = mgh/, /m = 2 kg/, /v = 5 m\/s/, /25 J/, /# Méthode/, /# Conclusion/]) {
    assert.match(output.draft, required);
  }
  assert.match(output.draft, /Aucune hauteur n’est fournie/);

  // An unrelated valid artefact must also pass: the production guard is not a physics solver.
  const unrelated = artifact({
    draft: '# Définition\n\nUn réseau local relie des équipements sur une zone limitée, par exemple une salle de classe. '
      + 'Un réseau étendu relie plusieurs zones distantes. Internet est un ensemble de réseaux interconnectés. '
      + 'La distinction porte sur l’étendue et l’interconnexion ; elle ne permet pas, à elle seule, de déduire un débit ou un coût précis.',
    workEvidence: [{ requirement: 'réseau local', excerpt: 'Un réseau local relie des équipements sur une zone limitée' }],
    workContract: contractFor('Explique un réseau local et un réseau étendu avec un exemple.', {
      criteria: [{ id: 'network', requirement: 'réseau local', required: true }],
    }),
  });
  assert.doesNotThrow(() => assertAutopilotWorkArtifact(unrelated, 'assignment', 'Explique un réseau local et un réseau étendu avec un exemple.'));
});

test('WORK rejects incomplete criterion evidence even when a rephrasing or advice draft declares the correct kind', () => {
  const invalidDrafts = [
    'Le devoir demande de distinguer les deux énergies, de présenter les formules et de calculer le cas fourni. '
      + 'Le travail attendu comprend une introduction, une méthode, un calcul et une conclusion. '
      + 'La consigne prévoit une masse de 2 kg et une vitesse de 5 m/s, et demande une explication du raisonnement suivi.',
    'Tu devrais expliquer les notions dans une introduction. Tu devrais ensuite présenter les deux formules. '
      + 'Tu devrais remplacer les données dans la formule et calculer le résultat. '
      + 'Tu devrais vérifier les unités. Tu devrais terminer par une conclusion qui reprend la différence entre les deux énergies.',
    'Voici les étapes : identifier les données et l’inconnue. Ensuite choisir la formule adaptée. '
      + 'Puis substituer les nombres, effectuer les opérations et vérifier les unités. '
      + 'Enfin rédiger la réponse avec une introduction, une méthode et une conclusion. '
      + 'Cette démarche permettra de résoudre le problème lorsque le travail sera rédigé.',
    'You should introduce the topic. You should explain the formulas. You should insert the data into the chosen formula. '
      + 'You should calculate the requested quantity. You should check the units. '
      + 'You should conclude by summarizing the difference between the two concepts and explaining the method.',
    // Exact bad WORK output from the real six-call acceptance, not only a contrived advice fixture.
    'The assignment asks for explanations of kinetic and potential energy along with their formulas. '
      + 'For kinetic energy, calculate the energy of a 2 kg mass moving at 5 m/s, including the calculation steps, units, and a concluding statement. '
      + 'For potential energy, provide only the formula Ep = mgh without performing any calculation, since the height is not given. '
      + 'The instructions stress the importance of not inventing missing data, ensuring accuracy and scientific rigor by working strictly with the provided information. '
      + 'The draft will present clear explanations, the kinetic energy calculation, and the potential energy formula, followed by a brief explanation of the approach.',
    PHYSICS_INSTRUCTIONS,
  ];
  for (const draft of invalidDrafts) {
    const output = artifact({ draft, workEvidence: [{ requirement: 'méthode', excerpt: draft.slice(0, 100) }] });
    assert.throws(() => assertAutopilotWorkArtifact(output, 'assignment', PHYSICS_INSTRUCTIONS), undefined, draft);
    const spoofed = parseAutopilotOutput(JSON.stringify({ ...output, workArtifactValidated: true }));
    assert.equal(spoofed.workArtifactValidated, undefined);
    assert.throws(() => assertAutopilotWorkArtifact(spoofed, 'assignment', PHYSICS_INSTRUCTIONS));
  }
});

test('WORK rejects a missing draft, wrong shell kind and unsupported evidence anchors', () => {
  const invalid = [
    artifact({ draft: undefined }),
    artifact({ draft: '' }),
    artifact({ workOutputKind: 'SCIENTIFIC_DRAFT' }),
    artifact({ workEvidence: [] }),
    artifact({ workEvidence: [{ requirement: 'An instruction never supplied by the learner', excerpt: 'Ec = 1/2 × 2 × 25 = 25 J.' }] }),
    artifact({ workEvidence: [{ requirement: '2 kg', excerpt: 'A passage not found in the draft.' }] }),
  ];
  for (const output of invalid) assert.throws(() => assertAutopilotWorkArtifact(output, 'assignment', PHYSICS_INSTRUCTIONS));
});

test('WORK rejects a greeting whose evidence does not cover the required task criteria', () => {
  const draft = 'Bonjour ! Je suis heureux de t’accompagner dans ton apprentissage. Tu peux revenir lorsque tu le souhaites.';
  const output = artifact({
    draft,
    workEvidence: [{ requirement: 'énergie cinétique', excerpt: 'Bonjour ! Je suis heureux de t’accompagner dans ton apprentissage.' }],
  });
  assert.throws(() => assertAutopilotWorkArtifact(output, 'assignment', PHYSICS_INSTRUCTIONS));
});

test('WORK accepts an imperative procedure when the learner explicitly requested that artifact', () => {
  const instructions = 'Rédige une procédure de sauvegarde de fichiers sur un disque externe avec vérification et éjection sûre.';
  const draft = '# Procédure de sauvegarde\n\n'
    + '1. Branche le disque externe et vérifie son espace libre.\n'
    + '2. Crée un dossier daté sur le disque externe, puis copie les fichiers à conserver.\n'
    + '3. Ouvre plusieurs fichiers copiés et compare leur taille avec les originaux pour vérifier la copie.\n'
    + '4. Ferme les fichiers puis utilise l’éjection sûre du système avant de débrancher le disque.\n'
    + '5. Si la vérification échoue, conserve les originaux et recommence seulement la copie concernée.';
  for (const template of ['assignment', 'other']) {
    const workContract = contractFor(instructions, {
      taskIntent: 'general', outputKind: 'INTENT_MATCHED_DRAFT',
      criteria: [{ id: 'safe-copy', requirement: 'vérification', required: true }],
    });
    const output = artifact({
      draft,
      workOutputKind: workContract.outputKind, workContract,
      workEvidence: [{ requirement: 'vérification', excerpt: 'Ouvre plusieurs fichiers copiés et compare leur taille avec les originaux pour vérifier la copie.' }],
    });
    assert.doesNotThrow(() => assertAutopilotWorkArtifact(output, template, instructions));
  }
});

test('WORK accepts short factual, numerical and cross-script answers without a subject-language word-overlap rule', () => {
  for (const fixture of [
    { instructions: 'Quelle est la capitale de la France ?', requirement: 'capitale de la France', draft: 'Paris.' },
    { instructions: 'Calcule 2 + 2.', requirement: '2 + 2', draft: '4.' },
    { instructions: 'Traduis bonjour en japonais.', requirement: 'bonjour', draft: 'こんにちは。' },
  ]) {
    const output = artifact({
      draft: fixture.draft,
      workContract: contractFor(fixture.instructions, { criteria: [{ id: 'short-answer', requirement: fixture.requirement, required: true }] }),
      workEvidence: [{ requirement: fixture.requirement, excerpt: fixture.draft }],
    });
    assert.doesNotThrow(() => assertAutopilotWorkArtifact(output, 'assignment', fixture.instructions));
  }
});

const { SOURCE_CONTEXT, SOURCE_CITATION, CURRENT_PLAN, UNIVERSAL_TASKS } = require('./fixtures/workspace-universal-fixtures.cjs');

function universalArtifact(fixture) {
  const criteria = fixture.requirements.map((requirement, index) => ({ id: `criterion-${index}`, requirement, required: true }));
  const workContract = contractFor(fixture.instructions, {
    taskIntent: fixture.taskIntent, outputKind: fixture.outputKind, operation: fixture.operation,
    scope: fixture.scope || 'entire-task', sourceRequirement: fixture.sourceRequirement || 'none', criteria,
    ...(fixture.sourceContext ? { sourceExcerpt: fixture.sourceContext } : {}),
    ...(fixture.scope === 'current-section' ? { sectionPlanItemId: CURRENT_PLAN[0].id } : {}),
  });
  return artifact({
    text: 'Le livrable demandé est enregistré dans le brouillon.', draft: fixture.draft,
    workOutputKind: fixture.outputKind, workContract,
    workEvidence: fixture.requirements.map((requirement, index) => ({ requirement, excerpt: fixture.excerpts[index] })),
  });
}

for (const fixture of UNIVERSAL_TASKS) {
  test(`Universal WORK accepts ${fixture.name}`, () => {
    const output = universalArtifact(fixture);
    const context = { contract: output.workContract, sourceContext: fixture.sourceContext || '', citations: fixture.citations || [], plan: CURRENT_PLAN };
    assert.doesNotThrow(() => validateAutopilotWorkContract(output.workContract, fixture.template, fixture.instructions, CURRENT_PLAN));
    assert.doesNotThrow(() => assertAutopilotWorkArtifact(output, fixture.template, fixture.instructions, context));
    const review = {
      taskFulfillment: {
        fulfilled: true, contractMatchesTask: true, scope: output.workContract.scope,
        criterionReviews: output.workContract.criteria.map((criterion, index) => ({ criterionId: criterion.id, fulfilled: true, excerpt: fixture.excerpts[index] })),
        citationLabels: (fixture.citations || []).map((citation) => citation.citationLabel),
      },
    };
    assert.deepEqual(taskFulfillmentIssues(review, output.workContract, fixture.draft, fixture.citations || []), []);
  });
}

test('Universal WORK sourced research refuses missing evidence and invented labels instead of becoming an unsourced answer', () => {
  const fixture = UNIVERSAL_TASKS.find((item) => item.taskIntent === 'research-task');
  const output = universalArtifact(fixture);
  assert.throws(() => assertAutopilotWorkArtifact(output, fixture.template, fixture.instructions, { contract: output.workContract, citations: [], sourceContext: '' }));
  const forged = {
    ...output, draft: output.draft.replace(/W1/g, 'W99'),
    workEvidence: output.workEvidence.map((item) => ({ ...item, excerpt: item.excerpt.replace(/W1/g, 'W99') })),
  };
  assert.throws(() => assertAutopilotWorkArtifact(forged, fixture.template, fixture.instructions, { contract: output.workContract, citations: [SOURCE_CITATION], sourceContext: SOURCE_CONTEXT }));
});

test('Universal WORK distinguishes a faithful source excerpt from an instruction echo', () => {
  const fixture = UNIVERSAL_TASKS[0];
  const output = universalArtifact(fixture);
  const draft = `${SOURCE_CONTEXT} [W1]`;
  const extractive = {
    ...output, draft,
    workEvidence: fixture.requirements.map((requirement) => ({ requirement, excerpt: SOURCE_CONTEXT })),
  };
  assert.doesNotThrow(() => assertAutopilotWorkArtifact(extractive, fixture.template, fixture.instructions, {
    contract: output.workContract, citations: [SOURCE_CITATION],
    sourceContext: `${SOURCE_CONTEXT} Le document présente ensuite des variantes techniques non nécessaires au résumé demandé.`,
  }));
  const echoed = { ...extractive, draft: fixture.instructions, workEvidence: fixture.requirements.map((requirement) => ({ requirement, excerpt: fixture.instructions })) };
  assert.throws(() => assertAutopilotWorkArtifact(echoed, fixture.template, fixture.instructions, {
    contract: output.workContract, citations: [SOURCE_CITATION], sourceContext: SOURCE_CONTEXT,
  }));
  for (const contract of [
    { ...output.workContract, sourceExcerpt: undefined },
    { ...output.workContract, sourceExcerpt: 'An excerpt not present in any authorized input.' },
  ]) assert.throws(() => assertAutopilotWorkArtifact({ ...output, workContract: contract }, fixture.template, fixture.instructions, {
    contract, citations: [SOURCE_CITATION], sourceContext: SOURCE_CONTEXT,
  }));
});

test('Universal WORK verification rejects absent, mismatched or false criterion reviews despite lexical evidence', () => {
  const fixture = UNIVERSAL_TASKS[0];
  const output = universalArtifact(fixture);
  const good = {
    fulfilled: true, contractMatchesTask: true, scope: output.workContract.scope,
    criterionReviews: output.workContract.criteria.map((criterion, index) => ({ criterionId: criterion.id, fulfilled: true, excerpt: fixture.excerpts[index] })),
  };
  for (const taskFulfillment of [
    undefined, { ...good, contractMatchesTask: false }, { ...good, fulfilled: false },
    { ...good, criterionReviews: [] },
    { ...good, scope: 'current-section' },
    { ...good, criterionReviews: good.criterionReviews.map((review) => ({ ...review, fulfilled: false })) },
    { ...good, criterionReviews: good.criterionReviews.map((review) => ({ ...review, excerpt: 'A sentence not present in this draft.' })) },
    { ...good, criterionReviews: [...good.criterionReviews, { criterionId: 'invented-id', fulfilled: true, excerpt: fixture.excerpts[0] }] },
  ]) assert.ok(taskFulfillmentIssues({ taskFulfillment }, output.workContract, fixture.draft, fixture.citations).length > 0);
});

test('Universal WORK parses canonical kinds and legacy aliases without accepting server proof fields from a provider', () => {
  for (const [legacy, canonical] of [
    ['CURRENT_SECTION_DRAFT', 'CURRENT_ACADEMIC_SECTION_DRAFT'], ['SCIENTIFIC_SECTION_DRAFT', 'SCIENTIFIC_DRAFT'],
    ['REPORT_SECTION_DRAFT', 'REPORT_DRAFT'], ['ADAPTIVE_DRAFT', 'INTENT_MATCHED_DRAFT'],
  ]) assert.equal(parseAutopilotOutput(JSON.stringify(artifact({ workOutputKind: legacy }))).workOutputKind, canonical);
  const output = parseAutopilotOutput(JSON.stringify(artifact({
    workArtifactValidated: true, workContract: { ...PHYSICS_CONTRACT, instructionFingerprint: 'forged' },
    taskFulfillment: { fulfilled: true, contractMatchesTask: true, scope: 'entire-task', criterionReviews: [], reviewedDraftFingerprint: 'forged' },
  })));
  assert.equal(output.workArtifactValidated, undefined);
  assert.equal(output.workContract.instructionFingerprint, undefined);
  assert.equal(output.taskFulfillment.reviewedDraftFingerprint, undefined);
});

test('Universal task contracts cannot erase required criteria or substitute an unrelated instruction', () => {
  for (const contract of [
    { ...PHYSICS_CONTRACT, criteria: [] },
    { ...PHYSICS_CONTRACT, criteria: PHYSICS_CONTRACT.criteria.map((item) => ({ ...item, required: false })) },
    { ...PHYSICS_CONTRACT, criteria: [{ id: 'unrelated', requirement: 'A condition never present in this task.', required: true }] },
    { ...PHYSICS_CONTRACT, outputKind: 'SUMMARY_DRAFT' },
    { ...PHYSICS_CONTRACT, criteria: [PHYSICS_CONTRACT.criteria[0], PHYSICS_CONTRACT.criteria[0]] },
  ]) assert.throws(() => validateAutopilotWorkContract(contract, 'assignment', PHYSICS_INSTRUCTIONS, CURRENT_PLAN));
});

function assertDiagnostic(action, expected, publicCode = 'workspace_autopilot_invalid_result') {
  assert.throws(action, (error) => {
    assert.equal(error.getStatus(), 503);
    assert.equal(error.getResponse().code, publicCode);
    assert.equal(getAutopilotDiagnosticReason(error), expected);
    assert.ok(AUTOPILOT_DIAGNOSTIC_REASONS.includes(expected));
    assert.deepEqual(Object.keys(error.getResponse()).sort(), ['code', 'message']);
    assert.equal(Object.hasOwn(error, 'internalDiagnosticReason'), false);
    assert.doesNotMatch(JSON.stringify(error), new RegExp(expected));
    assert.doesNotMatch(JSON.stringify(error.getResponse()), /SECRET_FIXTURE|private learner passage/);
    return true;
  });
}

test('Runtime parser reports the precise normalization or JSON shape failure without returning the raw content', () => {
  assertDiagnostic(() => parseAutopilotOutput('SECRET_FIXTURE { invalid'), 'PARSE_INVALID_JSON');
  for (const root of [null, [], true, 17, 'SECRET_FIXTURE']) {
    assertDiagnostic(() => parseAutopilotOutput(JSON.stringify(root)), 'PARSE_ROOT_NOT_OBJECT');
  }
  for (const [value, expected] of [
    [{ draft: 'private learner passage' }, 'PARSE_TEXT_MISSING'],
    [{ text: 3 }, 'PARSE_TEXT_INVALID_TYPE'],
    [{ text: '  ' }, 'PARSE_TEXT_EMPTY'],
    [{ text: 'a'.repeat(20_001) }, 'PARSE_TEXT_TOO_LONG'],
    [{ text: 'Result', workOutputKind: 'SECRET_FIXTURE' }, 'PARSE_WORK_OUTPUT_KIND_INVALID'],
    [{ text: 'Result', workEvidence: {} }, 'PARSE_WORK_EVIDENCE_INVALID'],
    [{ text: 'Result', workEvidence: [{ requirement: 'private learner passage' }] }, 'PARSE_WORK_EVIDENCE_ITEM_INVALID'],
    [{ text: 'Result', draft: {} }, 'PARSE_TEXT_FIELD_INVALID'],
    [{ text: 'Result', issues: {} }, 'PARSE_LIST_FIELD_INVALID'],
    [{ text: 'Result', briefFields: [] }, 'PARSE_BRIEF_FIELDS_INVALID'],
    [{ text: 'Result', briefFields: { subject: 2 } }, 'PARSE_BRIEF_FIELD_INVALID'],
    [{ text: 'Result', plan: {} }, 'PARSE_PLAN_INVALID'],
    [{ text: 'Result', plan: [{ title: '' }] }, 'PARSE_PLAN_ITEM_INVALID'],
    [{ text: 'Result', taskFulfillment: {} }, 'PARSE_TASK_FULFILLMENT_INVALID'],
  ]) assertDiagnostic(() => parseAutopilotOutput(JSON.stringify(value)), expected);
  const normalized = parseAutopilotOutput(`  \`\`\`json\n${JSON.stringify(artifact())}\n\`\`\`  `);
  assert.equal(normalized.draft, PHYSICS_DRAFT);
  assert.equal(normalized.workOutputKind, 'ANSWER_DRAFT');
  assert.equal(getAutopilotDiagnosticReason(new Error('SECRET_FIXTURE')), undefined);
});

test('Runtime diagnostic reasons remain server-private and cannot be forged through an HTTP response property', () => {
  const error = createAutopilotDiagnosticException('WORK_CONTRACT_MISSING', {
    code: 'workspace_autopilot_work_artifact_required', message: 'Your work is saved.',
  });
  assert.equal(getAutopilotDiagnosticReason(error), 'WORK_CONTRACT_MISSING');
  assert.deepEqual(error.getResponse(), {
    code: 'workspace_autopilot_work_artifact_required', message: 'Your work is saved.',
  });
  assert.doesNotMatch(JSON.stringify(error), /WORK_CONTRACT_MISSING|internalDiagnosticReason/);
  const forged = new (require('@nestjs/common').ServiceUnavailableException)({
    code: 'workspace_autopilot_invalid_result', message: 'Your work is saved.',
    internalDiagnosticReason: 'PARSE_INVALID_JSON',
  });
  assert.equal(getAutopilotDiagnosticReason(forged), undefined);
  assert.equal(getAutopilotDiagnosticReason(JSON.parse(JSON.stringify(error))), undefined);
});

test('Runtime contract parser distinguishes absent fields, malformed criteria and invalid canonical kinds', () => {
  const badContracts = [
    [null, 'PARSE_CONTRACT_NOT_OBJECT'],
    [{ ...PHYSICS_CONTRACT, version: 2 }, 'PARSE_CONTRACT_VERSION_INVALID'],
    [{ ...PHYSICS_CONTRACT, taskIntent: 'SECRET_FIXTURE' }, 'PARSE_CONTRACT_INTENT_INVALID'],
    [{ ...PHYSICS_CONTRACT, operation: 'SECRET_FIXTURE' }, 'PARSE_CONTRACT_OPERATION_INVALID'],
    [{ ...PHYSICS_CONTRACT, scope: 'SECRET_FIXTURE' }, 'PARSE_CONTRACT_SCOPE_INVALID'],
    [{ ...PHYSICS_CONTRACT, sourceRequirement: 'SECRET_FIXTURE' }, 'PARSE_CONTRACT_SOURCE_REQUIREMENT_INVALID'],
    [{ ...PHYSICS_CONTRACT, task: '' }, 'PARSE_CONTRACT_TASK_INVALID'],
    [{ ...PHYSICS_CONTRACT, sourceExcerpt: {} }, 'PARSE_CONTRACT_SOURCE_EXCERPT_INVALID'],
    [{ ...PHYSICS_CONTRACT, criteria: [] }, 'PARSE_CONTRACT_CRITERIA_INVALID'],
    [{ ...PHYSICS_CONTRACT, criteria: [{ id: 'criterion', requirement: 'private learner passage' }] }, 'PARSE_CONTRACT_CRITERION_INVALID'],
    [{ ...PHYSICS_CONTRACT, criteria: [PHYSICS_CONTRACT.criteria[0], PHYSICS_CONTRACT.criteria[0]] }, 'PARSE_CONTRACT_CRITERION_ID_DUPLICATE'],
    [{ ...PHYSICS_CONTRACT, outputKind: 'SECRET_FIXTURE' }, 'PARSE_CONTRACT_OUTPUT_KIND_INVALID'],
  ];
  for (const [workContract, expected] of badContracts) {
    assertDiagnostic(() => parseAutopilotOutput(JSON.stringify(artifact({ workContract }))), expected);
  }
});

test('Runtime WORK structural diagnostic preserves rejection gates and never guesses a semantic method-only reason', () => {
  const check = (output, expected, context = {}, instructions = PHYSICS_INSTRUCTIONS) => {
    assertDiagnostic(() => assertAutopilotWorkArtifact(output, 'assignment', instructions, context), expected, 'workspace_autopilot_work_artifact_required');
  };
  check(artifact({ workContract: undefined }), 'WORK_CONTRACT_MISSING');
  check(artifact({ draft: '' }), 'WORK_DRAFT_MISSING');
  check(artifact({ workOutputKind: 'SCIENTIFIC_DRAFT' }), 'WORK_OUTPUT_KIND_MISMATCH');
  check(artifact({ workEvidence: [] }), 'WORK_EVIDENCE_MISSING');
  check(artifact({ draft: PHYSICS_INSTRUCTIONS }), 'WORK_EXACT_INSTRUCTION_ECHO');
  check(artifact({ workEvidence: [{ requirement: 'SECRET_FIXTURE', excerpt: PHYSICS_DRAFT }] }), 'WORK_EVIDENCE_REQUIREMENT_UNANCHORED');
  check(artifact({ workEvidence: [{ requirement: '2 kg', excerpt: 'private learner passage' }] }), 'WORK_EVIDENCE_DRAFT_EXCERPT_UNANCHORED');
  check(artifact({ workEvidence: [artifact().workEvidence[0]] }), 'WORK_REQUIRED_CRITERION_EVIDENCE_MISSING');
  check(artifact(), 'WORK_INSTRUCTIONS_MISSING', {}, '');
  check(artifact({ workContract: { ...PHYSICS_CONTRACT, criteria: [{ id: 'unrelated', requirement: 'SECRET_FIXTURE', required: true }] } }), 'WORK_CRITERION_NOT_IN_INSTRUCTIONS');
  check(artifact({ workContract: { ...PHYSICS_CONTRACT, criteria: PHYSICS_CONTRACT.criteria.map((item) => ({ ...item, required: false })) } }), 'WORK_REQUIRED_CRITERION_MISSING');
  check(artifact({ workContract: { ...PHYSICS_CONTRACT, outputKind: 'SUMMARY_DRAFT' } }), 'WORK_CONTRACT_KIND_INTENT_MISMATCH');

  // The known commentary guard rejects advice-only production before persistence.
  // It is not a universal correctness grader: existing verification still judges
  // actual task fulfillment and examination restrictions.
  const methodDraft = 'Pour calculer, tu devrais identifier les données puis choisir une formule.';
  const method = artifact({
    draft: methodDraft, workContract: contractFor('Calculer le résultat.'),
    workEvidence: [{ requirement: 'Calculer le résultat.', excerpt: methodDraft }],
  });
  check(method, 'WORK_COMMENTARY_ONLY', {}, 'Calculer le résultat.');
  assert.deepEqual(taskFulfillmentIssues({ taskFulfillment: {
    fulfilled: false, contractMatchesTask: true, scope: 'entire-task',
    criterionReviews: [{ criterionId: 'required-task', fulfilled: false, reason: 'Only a method; no requested result.' }],
  } }, method.workContract, methodDraft), ['task-not-fulfilled', 'task-criterion-unfulfilled']);
});

test('Runtime WORK diagnostics distinguish missing sources, unknown citations and unanchored provided content', () => {
  const research = UNIVERSAL_TASKS.find((item) => item.taskIntent === 'research-task');
  const output = universalArtifact(research);
  const check = (candidate, expected, context) => assertDiagnostic(
    () => assertAutopilotWorkArtifact(candidate, research.template, research.instructions, context),
    expected, 'workspace_autopilot_work_artifact_required',
  );
  check(output, 'WORK_SOURCE_CONTEXT_MISSING', { citations: [SOURCE_CITATION] });
  const withoutCitation = {
    ...output, draft: output.draft.replace(/\[W1\]/g, ''),
    workEvidence: output.workEvidence.map((item) => ({ ...item, excerpt: item.excerpt.replace(/\[W1\]/g, '') })),
  };
  check(withoutCitation, 'WORK_SOURCE_CITATION_MISSING', { sourceContext: SOURCE_CONTEXT, citations: [SOURCE_CITATION] });
  check(output, 'WORK_SOURCE_CITATION_UNKNOWN', { sourceContext: SOURCE_CONTEXT, citations: [] });
  const summary = UNIVERSAL_TASKS.find((item) => item.taskIntent === 'article-summary');
  const summaryOutput = universalArtifact(summary);
  assertDiagnostic(() => assertAutopilotWorkArtifact({ ...summaryOutput, workContract: { ...summaryOutput.workContract, sourceExcerpt: 'private learner passage' } },
    summary.template, summary.instructions, { sourceContext: SOURCE_CONTEXT }), 'WORK_SOURCE_EXCERPT_UNANCHORED', 'workspace_autopilot_work_artifact_required');
});

test('Runtime valid fixtures traverse raw normalization, parse and validator without changing all eight canonical kinds', () => {
  const seenKinds = new Set();
  const assignment = parseAutopilotOutput(`\`\`\`json\n${JSON.stringify(artifact())}\n\`\`\``);
  assert.doesNotThrow(() => assertAutopilotWorkArtifact(assignment, 'assignment', PHYSICS_INSTRUCTIONS));
  seenKinds.add(assignment.workOutputKind);
  for (const fixture of UNIVERSAL_TASKS) {
    const expected = universalArtifact(fixture);
    const output = parseAutopilotOutput(`\`\`\`json\n${JSON.stringify(expected)}\n\`\`\``);
    const validated = assertAutopilotWorkArtifact(output, fixture.template, fixture.instructions, {
      sourceContext: fixture.sourceContext || '', citations: fixture.citations || [], plan: CURRENT_PLAN,
    });
    assert.equal(output.workOutputKind, fixture.outputKind);
    assert.equal(output.draft, fixture.draft);
    assert.equal(validated.outputKind, fixture.outputKind);
    seenKinds.add(output.workOutputKind);
  }
  assert.deepEqual([...seenKinds].sort(), [
    'ANSWER_DRAFT', 'SUMMARY_DRAFT', 'SOURCED_RESEARCH_DRAFT', 'CURRENT_ACADEMIC_SECTION_DRAFT',
    'ARGUMENTATIVE_DRAFT', 'SCIENTIFIC_DRAFT', 'REPORT_DRAFT', 'INTENT_MATCHED_DRAFT',
  ].sort());
});

// These are explicitly synthetic transport regressions. The former provider
// response was not retained in full and is never reconstructed here.
function identifiedArtifact(overrides = {}) {
  const output = artifact();
  return { ...output, workEvidence: output.workEvidence.map((evidence, index) => ({
    ...evidence, criterionId: output.workContract.criteria[index].id,
    requirement: `Equivalent description of criterion ${index + 1}`,
  })), ...overrides };
}

test('Stable criterion IDs associate equivalent requirement wording while every excerpt stays in the actual produced draft', () => {
  const output = parseAutopilotOutput(JSON.stringify(identifiedArtifact()));
  assert.doesNotThrow(() => assertAutopilotWorkArtifact(output, 'assignment', PHYSICS_INSTRUCTIONS));
  const rows = criterionEvidenceMatrix(output, output.workContract, PHYSICS_INSTRUCTIONS);
  assert.equal(rows.length, PHYSICS_CONTRACT.criteria.length);
  assert.ok(rows.every((row) => row.status === 'PASS' && row.evidence[0].association === 'ID'));
  assert.ok(rows.every((row) => row.evidence[0].requirementAnchored === false && row.evidence[0].excerptAnchored === true));

  const unknown = identifiedArtifact({ workEvidence: [{ criterionId: 'not-in-contract', requirement: 'Equivalent description', excerpt: PHYSICS_DRAFT }] });
  assertDiagnostic(() => assertAutopilotWorkArtifact(unknown, 'assignment', PHYSICS_INSTRUCTIONS),
    'WORK_EVIDENCE_CRITERION_UNKNOWN', 'workspace_autopilot_work_artifact_required');
  const falseQuotation = identifiedArtifact();
  falseQuotation.workEvidence[0].excerpt = 'A result not contained in the real draft.';
  assertDiagnostic(() => assertAutopilotWorkArtifact(falseQuotation, 'assignment', PHYSICS_INSTRUCTIONS),
    'WORK_EVIDENCE_DRAFT_EXCERPT_UNANCHORED', 'workspace_autopilot_work_artifact_required');
});

test('Stable IDs accept unit, mathematical notation, Markdown and natural conclusion variants without a physics-specific equivalence table', () => {
  const replacements = (value) => value.replaceAll('Ec', 'E_k').replaceAll('mv²', 'm v^2').replaceAll('25 J', '25 joules').replaceAll('# Conclusion', '');
  const output = identifiedArtifact();
  output.draft = replacements(output.draft);
  output.workEvidence = output.workEvidence.map((evidence) => ({ ...evidence, excerpt: replacements(evidence.excerpt) }));
  assert.doesNotThrow(() => assertAutopilotWorkArtifact(parseAutopilotOutput(JSON.stringify(output)), 'assignment', PHYSICS_INSTRUCTIONS));
  assert.ok(criterionEvidenceMatrix(output, output.workContract, PHYSICS_INSTRUCTIONS).every((row) => row.status === 'PASS'));

  // Identity matches semantics; quotations still prove provenance. No numeric
  // answer, variable-name equivalence or unit-conversion heuristic is invented.
  const alteredQuotation = { ...output, workEvidence: output.workEvidence.map((evidence, index) => index === 3 ? { ...evidence, excerpt: '25 J' } : evidence) };
  assertDiagnostic(() => assertAutopilotWorkArtifact(alteredQuotation, 'assignment', PHYSICS_INSTRUCTIONS),
    'WORK_EVIDENCE_DRAFT_EXCERPT_UNANCHORED', 'workspace_autopilot_work_artifact_required');
  assert.match(output.draft, /25 joules/);
  assert.match(output.draft, /E_k = 1\/2 m v\^2/);
  assert.doesNotMatch(output.draft, /# Conclusion/);
});

test('Stable ID association never grants a missing mandatory criterion and preserves the legacy association gate', () => {
  const partial = identifiedArtifact();
  partial.workEvidence = partial.workEvidence.slice(0, -1);
  const matrix = criterionEvidenceMatrix(partial, partial.workContract, PHYSICS_INSTRUCTIONS);
  assert.deepEqual(matrix.filter((row) => row.status === 'MISSING').map((row) => row.criterionId), ['physics-3']);
  assert.deepEqual(matrix.at(-1).evidence, []);
  assertDiagnostic(() => assertAutopilotWorkArtifact(partial, 'assignment', PHYSICS_INSTRUCTIONS),
    'WORK_REQUIRED_CRITERION_EVIDENCE_MISSING', 'workspace_autopilot_work_artifact_required');

  // A legacy response without IDs must retain its old exact criterion identity.
  const legacy = artifact();
  legacy.workEvidence = legacy.workEvidence.map((evidence, index) => index === 3 ? { ...evidence, requirement: '5 m' } : evidence);
  assertDiagnostic(() => assertAutopilotWorkArtifact(legacy, 'assignment', PHYSICS_INSTRUCTIONS),
    'WORK_REQUIRED_CRITERION_EVIDENCE_MISSING', 'workspace_autopilot_work_artifact_required');
});

function classifiedFixture() {
  const instructions = 'Réponds à la question. Ajoute une conclusion. Utilise une source si disponible. Tu peux proposer une variante. Ton concis.';
  const draft = 'La réponse traite la question posée. En somme, le résultat répond au besoin annoncé.';
  const workContract = contractFor(instructions, { criteria: [
    { id: 'answer', requirement: 'Réponds à la question.', required: true, classification: 'REQUIRED', condition: 'NONE' },
    { id: 'closing', requirement: 'Ajoute une conclusion.', required: true, classification: 'FORMAT', condition: 'NONE' },
    { id: 'source', requirement: 'Utilise une source si disponible.', required: true, classification: 'CONDITIONAL', condition: 'SOURCE_AVAILABLE' },
    { id: 'variant', requirement: 'Tu peux proposer une variante.', required: false, classification: 'OPTIONAL', condition: 'NONE' },
    { id: 'tone', requirement: 'Ton concis.', required: true, classification: 'STYLE', condition: 'NONE' },
  ] });
  const output = { text: 'Le brouillon de test est enregistré.', draft, workOutputKind: 'ANSWER_DRAFT', workContract,
    workEvidence: [
      { criterionId: 'answer', requirement: 'Answer the question', excerpt: 'La réponse traite la question posée.' },
      { criterionId: 'closing', requirement: 'Natural closing paragraph', excerpt: 'En somme, le résultat répond au besoin annoncé.' },
      { criterionId: 'tone', requirement: 'Concise phrasing', excerpt: 'La réponse traite la question posée.' },
    ] };
  return { instructions, output };
}

test('Criterion matrix distinguishes required, explicit format, optional and unavailable source-conditional criteria', () => {
  const { instructions, output } = classifiedFixture();
  const context = { sourceContext: '', citations: [] };
  const parsed = parseAutopilotOutput(JSON.stringify(output));
  assert.doesNotThrow(() => assertAutopilotWorkArtifact(parsed, 'assignment', instructions, context));
  const rows = criterionEvidenceMatrix(parsed, parsed.workContract, instructions, context);
  assert.deepEqual(rows.map((row) => [row.criterionId, row.type, row.applicable, row.status]), [
    ['answer', 'REQUIRED', true, 'PASS'], ['closing', 'FORMAT', true, 'PASS'],
    ['source', 'CONDITIONAL', false, 'NOT_APPLICABLE'], ['variant', 'OPTIONAL', false, 'NOT_APPLICABLE'],
    ['tone', 'STYLE', true, 'PASS'],
  ]);
  const missingFormat = { ...parsed, workEvidence: parsed.workEvidence.slice(0, 1) };
  assertDiagnostic(() => assertAutopilotWorkArtifact(missingFormat, 'assignment', instructions, context),
    'WORK_REQUIRED_CRITERION_EVIDENCE_MISSING', 'workspace_autopilot_work_artifact_required');
});

test('Conditional applicability is server-derived, unknown fails closed and available sources restore the obligation', () => {
  const { instructions, output } = classifiedFixture();
  output.workContract.criteria[2].applicable = false;
  const parsed = parseAutopilotOutput(JSON.stringify(output));
  assert.equal(parsed.workContract.criteria[2].applicable, undefined, 'a provider cannot certify applicability');
  const unknown = criterionEvidenceMatrix(parsed, parsed.workContract, instructions);
  assert.equal(unknown[2].status, 'UNKNOWN');
  assertDiagnostic(() => assertAutopilotWorkArtifact(parsed, 'assignment', instructions),
    'WORK_CRITERION_APPLICABILITY_UNKNOWN', 'workspace_autopilot_work_artifact_required');
  assertDiagnostic(() => assertAutopilotWorkArtifact(parsed, 'assignment', instructions, { sourceAvailable: true }),
    'WORK_REQUIRED_CRITERION_EVIDENCE_MISSING', 'workspace_autopilot_work_artifact_required');
  assert.doesNotThrow(() => assertAutopilotWorkArtifact(parsed, 'assignment', instructions, { sourceAvailable: false }));
  const unresolved = { ...parsed, workContract: { ...parsed.workContract, criteria: parsed.workContract.criteria.map((criterion) => criterion.id === 'source' ? { ...criterion, condition: 'UNRESOLVED' } : criterion) } };
  assertDiagnostic(() => assertAutopilotWorkArtifact(unresolved, 'assignment', instructions, { sourceAvailable: false }),
    'WORK_CRITERION_APPLICABILITY_UNKNOWN', 'workspace_autopilot_work_artifact_required');
});

test('Existing verification uses the same conditional applicability and never requires an unavailable optional source', () => {
  const { output } = classifiedFixture();
  const review = { taskFulfillment: { fulfilled: true, contractMatchesTask: true, scope: 'entire-task',
    criterionReviews: output.workEvidence.map((evidence) => ({ criterionId: evidence.criterionId, fulfilled: true, excerpt: evidence.excerpt })) } };
  assert.deepEqual(taskFulfillmentIssues(review, output.workContract, output.draft, [], { sourceAvailable: false }), []);
  assert.ok(taskFulfillmentIssues(review, output.workContract, output.draft, [], { sourceAvailable: true }).includes('task-criterion-unfulfilled'));
  assert.ok(taskFulfillmentIssues(review, output.workContract, output.draft).includes('task-criterion-applicability-unknown'));
});

test('Known method-only, prompt-rephrasing and partial productions remain rejected with stable criterion IDs', () => {
  const method = identifiedArtifact();
  method.draft = 'Tu devrais expliquer les notions. Tu devrais présenter les formules. Tu devrais calculer le résultat puis vérifier les unités. Tu devrais conclure.';
  method.workEvidence = method.workEvidence.map((evidence) => ({ ...evidence, excerpt: method.draft }));
  assertDiagnostic(() => assertAutopilotWorkArtifact(method, 'assignment', PHYSICS_INSTRUCTIONS),
    'WORK_COMMENTARY_ONLY', 'workspace_autopilot_work_artifact_required');
  const rephrased = identifiedArtifact();
  rephrased.draft = 'Le devoir demande de présenter les notions. Le devoir demande les formules. Le devoir demande un calcul et une explication. Le devoir demande une conclusion.';
  rephrased.workEvidence = rephrased.workEvidence.map((evidence) => ({ ...evidence, excerpt: rephrased.draft }));
  assertDiagnostic(() => assertAutopilotWorkArtifact(rephrased, 'assignment', PHYSICS_INSTRUCTIONS),
    'WORK_COMMENTARY_ONLY', 'workspace_autopilot_work_artifact_required');
  const partial = identifiedArtifact();
  partial.workEvidence = partial.workEvidence.slice(0, 2);
  assertDiagnostic(() => assertAutopilotWorkArtifact(partial, 'assignment', PHYSICS_INSTRUCTIONS),
    'WORK_REQUIRED_CRITERION_EVIDENCE_MISSING', 'workspace_autopilot_work_artifact_required');
  assert.doesNotThrow(() => assertAutopilotWorkArtifact(identifiedArtifact(), 'assignment', PHYSICS_INSTRUCTIONS));
});

test('Malformed or contradictory criterion classification and evidence IDs cannot weaken the parser', () => {
  for (const criterion of [
    { ...PHYSICS_CONTRACT.criteria[0], classification: 'OPTIONAL', required: true },
    { ...PHYSICS_CONTRACT.criteria[0], classification: 'REQUIRED', required: false },
    { ...PHYSICS_CONTRACT.criteria[0], classification: 'CONDITIONAL', condition: 'SOURCE_AVAILABLE', required: false },
    { ...PHYSICS_CONTRACT.criteria[0], classification: 'FORMAT', required: false },
    { ...PHYSICS_CONTRACT.criteria[0], classification: 'STYLE', required: false },
    { ...PHYSICS_CONTRACT.criteria[0], classification: 'SECRET_FIXTURE' },
  ]) assertDiagnostic(() => parseAutopilotOutput(JSON.stringify(artifact({ workContract: { ...PHYSICS_CONTRACT, criteria: [criterion] } }))), 'PARSE_CONTRACT_CRITERION_CLASSIFICATION_INVALID');
  for (const condition of ['SECRET_FIXTURE', 'SOURCE_AVAILABLE']) {
    const criterion = { ...PHYSICS_CONTRACT.criteria[0], classification: 'REQUIRED', condition };
    assertDiagnostic(() => parseAutopilotOutput(JSON.stringify(artifact({ workContract: { ...PHYSICS_CONTRACT, criteria: [criterion] } }))), 'PARSE_CONTRACT_CRITERION_CONDITION_INVALID');
  }
  assertDiagnostic(() => parseAutopilotOutput(JSON.stringify(identifiedArtifact({ workEvidence: [{ criterionId: '', requirement: 'Description', excerpt: PHYSICS_DRAFT }] }))), 'PARSE_WORK_EVIDENCE_ITEM_INVALID');
});
