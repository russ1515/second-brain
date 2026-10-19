'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  autopilotProfessorDirective,
  assertAutopilotWorkArtifact,
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
    assert.match(directive, /Exception for verbatim source metadata/);
    assert.match(directive, /workEvidence\.requirement must remain in the exact language and words of the supplied instructions/);
    assert.match(directive, /workEvidence\.excerpt in the exact words of draft/);
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
