'use strict';

const SOURCE_CONTEXT = 'La pompe solaire réduit la consommation de carburant pendant les heures ensoleillées. '
  + 'Le débit dépend toutefois de l’ensoleillement et les données fournies ne mesurent pas les coûts annuels.';
const SOURCE_CITATION = {
  sourceType: 'document', sourceId: 'technical-source', documentId: 'technical-source',
  title: 'Note technique de test', citationLabel: 'W1', snippet: SOURCE_CONTEXT, relevance: 1,
};
const CURRENT_PLAN = [{ id: 'current-section-1', title: 'Section demandée', order: 0, completed: false, stepId: 'draft' }];
const UNIVERSAL_TASKS = [
  {
    name: 'a real summary requested inside an article Workspace', template: 'article', taskIntent: 'article-summary', outputKind: 'SUMMARY_DRAFT',
    operation: 'transform', sourceRequirement: 'provided-content',
    instructions: 'Résume le passage fourni en deux phrases en conservant son avantage et sa limite.',
    draft: 'La pompe solaire réduit le recours au carburant lorsqu’il y a du soleil [W1]. Son débit dépend de l’ensoleillement et le texte ne chiffre pas le coût annuel [W1].',
    requirements: ['en deux phrases', 'son avantage et sa limite'],
    excerpts: ['La pompe solaire réduit le recours au carburant lorsqu’il y a du soleil [W1].', 'Son débit dépend de l’ensoleillement et le texte ne chiffre pas le coût annuel [W1].'],
    sourceContext: SOURCE_CONTEXT, citations: [SOURCE_CITATION],
  },
  {
    name: 'a sourced investigation using available AW-6 evidence', template: 'other', taskIntent: 'research-task', outputKind: 'SOURCED_RESEARCH_DRAFT',
    operation: 'produce', sourceRequirement: 'cited-evidence',
    instructions: 'Produis une recherche sourcée sur la pompe solaire en distinguant le constat et les limites des preuves fournies.',
    draft: '# Constat\n\nLa note relie la pompe solaire à une baisse du carburant pendant l’ensoleillement [W1].\n\n# Limites\n\nElle ne mesure ni le débit sur une année ni les coûts annuels ; on ne peut donc pas conclure à une économie annuelle chiffrée [W1].',
    requirements: ['recherche sourcée', 'les limites des preuves fournies'],
    excerpts: ['La note relie la pompe solaire à une baisse du carburant pendant l’ensoleillement [W1].', 'Elle ne mesure ni le débit sur une année ni les coûts annuels'],
    sourceContext: SOURCE_CONTEXT, citations: [SOURCE_CITATION],
  },
  {
    name: 'only the requested academic section', template: 'memoire', taskIntent: 'academic-section', outputKind: 'CURRENT_ACADEMIC_SECTION_DRAFT',
    operation: 'produce', scope: 'current-section',
    instructions: 'Rédige uniquement la section Limites de la méthode de ce mémoire, sans inventer de données.',
    draft: '# Limites de la méthode\n\nUne comparaison théorique dépend des hypothèses retenues. Sans observation empirique fournie, ses conclusions portent sur la cohérence des modèles, non sur une efficacité mesurée. Ces limites doivent accompagner toute généralisation.',
    requirements: ['la section Limites de la méthode', 'sans inventer de données'],
    excerpts: ['Une comparaison théorique dépend des hypothèses retenues.', 'Sans observation empirique fournie, ses conclusions portent sur la cohérence des modèles'],
  },
  {
    name: 'an actual argumentative paragraph', template: 'dissertation', taskIntent: 'argumentative-essay', outputKind: 'ARGUMENTATIVE_DRAFT',
    operation: 'produce',
    instructions: 'Rédige un paragraphe sur l’accès libre aux publications avec un argument, une objection et une réponse.',
    draft: 'L’accès libre facilite la consultation des publications par les lecteurs sans abonnement : il réduit un obstacle financier à la diffusion. Une objection est que la publication et l’évaluation ont un coût. Cette objection invite à financer ces services de manière transparente ; elle ne justifie pas à elle seule de réserver la lecture à ceux qui peuvent payer.',
    requirements: ['un argument', 'une objection', 'une réponse'],
    excerpts: ['il réduit un obstacle financier à la diffusion.', 'Une objection est que la publication et l’évaluation ont un coût.', 'Cette objection invite à financer ces services de manière transparente'],
  },
  {
    name: 'a theoretical scientific methods section without invented results', template: 'article', taskIntent: 'scientific-article', outputKind: 'SCIENTIFIC_DRAFT',
    operation: 'produce', scope: 'current-section',
    instructions: 'Rédige la section méthode d’un article théorique comparant deux modèles, sans présenter de résultat mesuré.',
    draft: '# Méthode\n\nLa comparaison théorique définit un même domaine d’application pour les deux modèles puis examine leurs hypothèses, variables et prédictions. Les critères retenus sont la cohérence interne et les limites de validité. Aucun résultat expérimental n’est rapporté, car aucune mesure n’a été fournie.',
    requirements: ['la section méthode', 'sans présenter de résultat mesuré'],
    excerpts: ['La comparaison théorique définit un même domaine d’application pour les deux modèles', 'Aucun résultat expérimental n’est rapporté, car aucune mesure n’a été fournie.'],
  },
  {
    name: 'a report separating supplied observations and recommendations', template: 'report', taskIntent: 'report', outputKind: 'REPORT_DRAFT',
    operation: 'produce',
    instructions: 'Rédige un rapport court : deux fichiers relus et une erreur corrigée dans un audit fictif de test. Sépare constat et recommandation.',
    draft: '# Constat\n\nDans cet audit fictif de test, deux fichiers ont été relus et une erreur a été corrigée. Aucune autre intervention n’est documentée.\n\n# Recommandation\n\nConserver une trace de la correction et vérifier le comportement concerné avant livraison.',
    requirements: ['deux fichiers relus et une erreur corrigée', 'constat et recommandation'],
    excerpts: ['deux fichiers ont été relus et une erreur a été corrigée.', 'Conserver une trace de la correction et vérifier le comportement concerné avant livraison.'],
  },
  {
    name: 'a requested procedure, not advice about producing one', template: 'other', taskIntent: 'general', outputKind: 'INTENT_MATCHED_DRAFT', operation: 'produce',
    instructions: 'Rédige une procédure pour sauvegarder un fichier et vérifier la copie.',
    draft: '1. Branche le disque de sauvegarde.\n2. Copie le fichier dans un dossier daté.\n3. Ouvre la copie et compare sa taille à celle du fichier original.\n4. Conserve l’original tant que la vérification n’est pas terminée.',
    requirements: ['sauvegarder un fichier', 'vérifier la copie'],
    excerpts: ['Copie le fichier dans un dossier daté.', 'Ouvre la copie et compare sa taille à celle du fichier original.'],
  },
  {
    name: 'a translation in a different writing system', template: 'other', taskIntent: 'general', outputKind: 'INTENT_MATCHED_DRAFT', operation: 'transform', sourceRequirement: 'provided-content',
    instructions: 'Traduis le passage fourni en japonais.', sourceContext: 'Good morning.',
    draft: 'おはようございます。', requirements: ['en japonais'], excerpts: ['おはようございます。'],
  },
  {
    name: 'an explicitly requested verbatim reproduction of source content', template: 'other', taskIntent: 'general', outputKind: 'INTENT_MATCHED_DRAFT', operation: 'reproduce', sourceRequirement: 'provided-content',
    instructions: 'Recopie exactement le passage fourni sans changement.', sourceContext: 'Texte technique de test : alpha, beta.',
    draft: 'Texte technique de test : alpha, beta.', requirements: ['Recopie exactement'], excerpts: ['Texte technique de test : alpha, beta.'],
  },
];

module.exports = { SOURCE_CONTEXT, SOURCE_CITATION, CURRENT_PLAN, UNIVERSAL_TASKS };
