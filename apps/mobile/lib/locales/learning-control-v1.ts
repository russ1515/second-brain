import { extendLocale } from '../i18n';

/** Source copy for coherent lesson/session/goal deletion. Other reviewed locale
 * overlays are layered by the global i18n delivery step. */
extendLocale('en', {
  'learningControl.delete': 'Delete',
  'learningControl.deleteGoal': 'Delete this goal',
  'learningControl.openDetails': 'Open details',
  'learningControl.previewLoading': 'Calculating the exact impact…',
  'learningControl.previewFailed': 'The impact could not be verified. Nothing was deleted.',
  'learningControl.impact': 'This action will remove:',
  'learningControl.count.sessions': '{count} session(s)',
  'learningControl.count.lessons': '{count} lesson(s)',
  'learningControl.count.studySessions': '{count} guided study session(s)',
  'learningControl.count.messages': '{count} teacher message(s)',
  'learningControl.count.exercises': '{count} exercise/homework item(s)',
  'learningControl.count.reviews': '{count} review item(s) and related reminder(s)',
  'learningControl.count.cards': '{count} flashcard(s)',
  'learningControl.count.documents': '{count} generated document(s)',
  'learningControl.count.reminders': '{count} calendar reminder(s)',
  'learningControl.count.references': '{count} saved reference(s)',
  'learningControl.count.recommendations': '{count} active recommendation(s)',
  'learningControl.documentsTrash': 'Generated documents are moved to Library Trash and remain excluded until an explicit restore.',
  'learningControl.sharedPreserved': '{count} shared source(s) remain available because they are still used elsewhere.',
});

extendLocale('fr', {
  'learningControl.delete': 'Supprimer',
  'learningControl.deleteGoal': 'Supprimer cet objectif',
  'learningControl.openDetails': 'Ouvrir le détail',
  'learningControl.previewLoading': 'Calcul du périmètre exact…',
  'learningControl.previewFailed': 'Le périmètre n’a pas pu être vérifié. Rien n’a été supprimé.',
  'learningControl.impact': 'Cette action retirera :',
  'learningControl.count.sessions': '{count} session(s)',
  'learningControl.count.lessons': '{count} leçon(s)',
  'learningControl.count.studySessions': '{count} session(s) d’étude guidée',
  'learningControl.count.messages': '{count} message(s) du Professeur',
  'learningControl.count.exercises': '{count} exercice(s) ou devoir(s)',
  'learningControl.count.reviews': '{count} élément(s) de révision et rappel(s) associé(s)',
  'learningControl.count.cards': '{count} carte(s) mémoire',
  'learningControl.count.documents': '{count} document(s) généré(s)',
  'learningControl.count.reminders': '{count} rappel(s) calendrier',
  'learningControl.count.references': '{count} référence(s) enregistrée(s)',
  'learningControl.count.recommendations': '{count} recommandation(s) active(s)',
  'learningControl.documentsTrash': 'Les documents générés sont placés dans la Corbeille et restent exclus jusqu’à une restauration explicite.',
  'learningControl.sharedPreserved': '{count} source(s) partagée(s) restent disponibles car elles sont encore utilisées ailleurs.',
});
