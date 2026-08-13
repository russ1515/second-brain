import { registerLocale } from '../i18n';

/**
 * Spanish UI locale (Sprint 10.5 — proof of extensibility).
 *
 * A PARTIAL catalog: only the highest-visibility keys are translated. Everything
 * else falls back to English automatically, so the language is usable from day
 * one and grows over time. Adding this language required NO change to the i18n
 * engine — just this resource plus one `registerLocale` call. The AI content
 * locale ("es" → Spanish) is already supported server-side, so switching here
 * also makes the AI teacher speak Spanish.
 */
const es: Record<string, string> = {
  'app.today': 'Hoy',
  'app.signOut': 'Cerrar sesión',
  'app.back': 'Volver a hoy',
  'app.tryAgain': 'Reintentar',
  'app.language': 'Idioma de la app',

  'home.greeting': 'Hola',
  'classroom.streak': 'días seguidos',

  'mentor.why': 'Por qué te lo propongo',
  'mentor.act': '¡Vamos!',
  'mentor.dismiss': 'Ahora no',

  'sync.title': 'Centro de sync',
  'sync.online': 'En línea',
  'sync.offline': 'Sin conexión',
  'sync.pending': 'Cambios pendientes',
  'sync.last': 'Última sync',
  'sync.never': 'Nunca',
  'sync.now': 'Sincronizar',

  'mon.title': 'Supervisión',

  'coachp.title': 'Mi coach académico',
  'dna.title': 'ADN de aprendizaje',
  'risk.title': 'Anticipación',
  'reco.title': 'Para ti',
  'ment.title': 'Mentor IA',
  'ic.title': 'Centro de inteligencia',
  'succ.title': 'Predictor de éxito',

  'lm.title': 'Idiomas',
};

registerLocale('es', 'Español', es);
