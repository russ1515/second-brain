'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  autopilotProfessorDirective,
  assertAutopilotWorkArtifact,
  parseAutopilotOutput,
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

function artifact(overrides = {}) {
  return {
    text: 'Le brouillon contient les définitions, formules, unités, calcul et conclusion demandés.',
    draft: PHYSICS_DRAFT,
    workOutputKind: 'ANSWER_DRAFT',
    workEvidence: [
      { requirement: 'énergie cinétique', excerpt: 'L’énergie cinétique est liée au mouvement d’un objet.' },
      { requirement: 'énergie potentielle', excerpt: 'L’énergie potentielle est liée à sa position ou à sa configuration.' },
      { requirement: '2 kg', excerpt: 'm = 2 kg et v = 5 m/s' },
      { requirement: '5 m/s', excerpt: 'Ec = 1/2 × 2 × 25 = 25 J.' },
    ],
    ...overrides,
  };
}

test('WORK maps the existing templates onto six distinct output contracts without another engine', () => {
  const expected = {
    assignment: 'ANSWER_DRAFT', memoire: 'CURRENT_SECTION_DRAFT', tfc: 'CURRENT_SECTION_DRAFT',
    dissertation: 'ARGUMENTATIVE_DRAFT', article: 'SCIENTIFIC_SECTION_DRAFT', report: 'REPORT_SECTION_DRAFT',
    other: 'ADAPTIVE_DRAFT', 'academic-research': 'ADAPTIVE_DRAFT',
  };
  assert.equal(new Set(Object.values(expected)).size, 6);
  for (const [template, kind] of Object.entries(expected)) {
    assert.equal(workspaceWorkOutputKind(template), kind);
    assert.doesNotThrow(() => assertAutopilotWorkArtifact(artifact({ workOutputKind: kind }), template, PHYSICS_INSTRUCTIONS));
    const directive = autopilotProfessorDirective('WORK', template);
    assert.match(directive, /Exception for verbatim source metadata/);
    assert.match(directive, /workEvidence\.requirement must remain in the exact language and words of the supplied instructions/);
    assert.match(directive, /workEvidence\.excerpt in the exact words of draft/);
    assert.match(directive, /text and draft still use the learner locale/);
  }
});

test('WORK accepts the real physics answer, not a predefined production answer', () => {
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
  });
  assert.doesNotThrow(() => assertAutopilotWorkArtifact(unrelated, 'assignment', 'Explique un réseau local et un réseau étendu avec un exemple.'));
});

test('WORK rejects rephrasing, advice and method-only drafts even when a correct kind and literal evidence are supplied', () => {
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
    artifact({ workOutputKind: 'SCIENTIFIC_SECTION_DRAFT' }),
    artifact({ workEvidence: [] }),
    artifact({ workEvidence: [{ requirement: 'An instruction never supplied by the learner', excerpt: 'Ec = 1/2 × 2 × 25 = 25 J.' }] }),
    artifact({ workEvidence: [{ requirement: '2 kg', excerpt: 'A passage not found in the draft.' }] }),
  ];
  for (const output of invalid) assert.throws(() => assertAutopilotWorkArtifact(output, 'assignment', PHYSICS_INSTRUCTIONS));
});

test('WORK rejects an unrelated greeting even with a valid shape and literal evidence', () => {
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
    const output = artifact({
      draft,
      workOutputKind: workspaceWorkOutputKind(template),
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
      workEvidence: [{ requirement: fixture.requirement, excerpt: fixture.draft }],
    });
    assert.doesNotThrow(() => assertAutopilotWorkArtifact(output, 'assignment', fixture.instructions));
  }
});
