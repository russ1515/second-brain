'use strict';

// Exact retained technical acceptance projections, not reconstructed provider
// content. WORK: deliverables/universal-work-instrumented-20261020/browser-proof.json
// VERIFICATION: deliverables/verification-evidence-hotfix-20261020/retained-verification.json
// No personal account, credential, token or invented historical timestamp.
const SOURCE_SHA = '5912ed56aaba642f0afd3c42a3da26fb07aad983';
const WORKSPACE_ID = '8c292995-080e-4890-aef5-9e6087f4326e';
const RUN_ID = '59195a00-8d06-48b0-a42c-46a359b3beeb';
const DRAFT_SHA256 = '83920a788b8e1f44ae0dc89e0f0bba44ba2be7a494a87b6397e41f0853e92c63';
const INSTRUCTIONS = 'Petit exercice de calcul de prix : trois cahiers coûtent chacun 4 euros et un livre coûte 7 euros. Calcule le prix total. Écris le calcul détaillé et une conclusion avec la somme à payer. Produis la réponse réelle, pas seulement une méthode ni une reformulation.';
const DRAFT = 'Trois cahiers coûtent chacun 4 euros, donc le prix total des cahiers est :\n'
  + '3 × 4 € = 12 €\n\nUn livre coûte 7 euros.\n\n'
  + 'Le prix total à payer est la somme du prix des cahiers et du livre :\n'
  + '12 € + 7 € = 19 €\n\n'
  + 'Conclusion : Le prix total à payer pour les trois cahiers et le livre est de 19 euros.';
const REQUIREMENTS = [
  ['required-1', 'userInstructions', INSTRUCTIONS],
  ['required-2', 'requirements', 'Calculer le prix total. Écris le calcul détaillé et une conclusion avec la somme à payer.'],
  ['required-3', 'deliverable', 'Réponse détaillée avec calcul et conclusion en euros.'],
  ['required-4', 'objective', 'Calculer le prix total de trois cahiers à 4 euros et un livre à 7 euros, avec calcul et conclusion.'],
];
const CONTRACT = {
  task: `${INSTRUCTIONS}\n\n${REQUIREMENTS[1][2]}\n\n${REQUIREMENTS[2][2]}\n\n${REQUIREMENTS[3][2]}\n\nCalcul de prix — exercice court\n\nExercice scolaire de calcul, réalisé sur un compte technique pour validation.`,
  scope: 'entire-task', origin: 'explicit-intent', version: 1,
  criteria: REQUIREMENTS.map(([id, originField, requirement]) => ({ id, required: true, condition: 'NONE',
    originField, requirement, classification: 'REQUIRED' })),
  operation: 'produce', outputKind: 'ANSWER_DRAFT', taskIntent: 'assignment-exercise', sourceRequirement: 'none',
  instructionFingerprint: 'c25505f6836692acf09593048a69b74bf574c9bff384975419356503cfb10e1e',
};
const WORK_OUTPUT = {
  // Only the retained fields used by evidence binding are projected here; no
  // historical Professor commentary is invented or used as answer evidence.
  draft: DRAFT, workContract: CONTRACT,
  workEvidence: REQUIREMENTS.map(([criterionId, , requirement]) => ({ excerpt: DRAFT, criterionId, requirement })),
  workOutputKind: 'ANSWER_DRAFT', workArtifactValidated: true,
};
const VERIFICATION_OUTPUT = {
  text: 'Let\'s verify the coherence of the current draft against the instructions and rubric. The draft correctly calculates the total price of three notebooks at 4 euros each by multiplying 3 × 4 € = 12 €. It then states the price of the book as 7 €. Next, it adds these amounts: 12 € + 7 € = 19 €, which is the correct total. Finally, it concludes with a clear sentence stating the total amount to pay, including the unit "euros." This matches the requirement to provide a detailed calculation and a conclusion with the sum to pay, respecting the units and clarity. The draft is coherent, accurate, and complete for the given task.',
  taskFulfillment: {
    scope: 'entire-task', fulfilled: true, citationLabels: [],
    criterionReviews: [
      {
        reason: 'The draft fully meets the requirement of calculating the total price with detailed steps and a concluding sentence including units.',
        excerpt: 'Trois cahiers coûtent chacun 4 euros, donc le prix total des cahiers est : 3 × 4 € = 12 € Un livre coûte 7 euros. Le prix total à payer est la somme du prix des cahiers et du livre : 12 € + 7 € = 19 € Conclusion : Le prix total à payer pour les trois cahiers et le livre est de 19 euros.',
        fulfilled: true, criterionId: 'required-1',
      },
      {
        reason: 'Detailed calculation and conclusion with the sum to pay are present.',
        excerpt: '3 × 4 € = 12 € ... 12 € + 7 € = 19 € ... Conclusion : Le prix total à payer pour les trois cahiers et le livre est de 19 euros.',
        fulfilled: true, criterionId: 'required-2',
      },
      {
        reason: 'The response is detailed and includes units.',
        excerpt: 'The draft includes the detailed calculation and conclusion in euros as required.',
        fulfilled: true, criterionId: 'required-3',
      },
      {
        reason: 'The draft directly addresses the objective with correct calculation and conclusion.',
        excerpt: REQUIREMENTS[3][2], fulfilled: true, criterionId: 'required-4',
      },
    ],
    contractMatchesTask: true, uncoveredRequirements: [],
  },
  issues: [], checkedPlanItemIds: ['auto-45a7fd20-2ffd-4bfd-b8af-f5bc50b55e75'],
};

function realVerificationFixture() {
  return {
    sourceSha: SOURCE_SHA, workspaceId: WORKSPACE_ID, runId: RUN_ID,
    workRevision: 2, currentRevision: 3, instructions: INSTRUCTIONS, draft: DRAFT, draftFingerprint: DRAFT_SHA256,
    contract: structuredClone(CONTRACT), workOutput: structuredClone(WORK_OUTPUT),
    verificationOutput: structuredClone(VERIFICATION_OUTPUT),
    workReplyId: '2e678309-35cd-403d-94b5-8dfc97e61bc0',
    verificationReplyId: 'dd56e6c7-42c0-4044-bed7-b63364c769ad',
    history: [{
      id: '2e678309-35cd-403d-94b5-8dfc97e61bc0', role: 'assistant', professorPhase: 'WORK',
      autopilot: { runId: RUN_ID, output: structuredClone(WORK_OUTPUT) },
    }],
  };
}

module.exports = { realVerificationFixture };
