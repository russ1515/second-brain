import { registerLocale } from '../i18n';

/** Danish UI locale — machine-generated (Step 2), review recommended.
 *  Regenerate/extend with: node scripts/translate-locale.mjs da */
const da: Record<string, string> = {
  "app.today": "I dag",
  "app.signOut": "Log ud",
  "app.back": "Tilbage til i dag",
  "app.tryAgain": "Prøv igen",
  "app.language": "App-sprog",
  "auth.title": "Dit klasseværelse",
  "auth.subtitle": "En privat lærer, der husker hver eneste lektion, fejl og succes.",
  "auth.name": "Navn (valgfrit)",
  "auth.email": "E-mail",
  "auth.password": "Adgangskode",
  "auth.start": "Start med at lære",
  "auth.signIn": "Log ind",
  "auth.haveAccount": "Jeg har allerede en konto",
  "auth.createAccount": "Opret en konto",
  "auth.headline": "Aktivér din digitale tvilling",
  "auth.emailPh": "dig@eksempel.dk",
  "auth.namePh": "Dit navn",
  "auth.createBtn": "Opret min konto",
  "auth.forgot": "Glemt adgangskode?",
  "auth.noAccount": "Ingen konto endnu?",
  "auth.otpTitle": "Bekræft din e-mail",
  "auth.otpSubtitle": "Indtast den 6-cifrede kode sendt til {email}.",
  "auth.verify": "Bekræft",
  "auth.notReceived": "Modtog du den ikke?",
  "auth.resend": "Send kode igen",
  "auth.resendIn": "Send igen om {n}s",
  "auth.skip": "Spring dette trin over",
  "auth.expired": "Koden er udløbet – anmod om en ny.",
  "auth.otpError": "Ugyldig kode. Prøv igen.",
  "auth.forgotTitle": "Glemt adgangskode",
  "auth.forgotSubtitle": "Indtast din e-mail, så sender vi en nulstillingskode.",
  "auth.sendCode": "Send kode",
  "auth.back": "Tilbage",
  "auth.resetTitle": "Nulstil adgangskode",
  "auth.resetSubtitle": "Indtast koden og din nye adgangskode.",
  "auth.newPassword": "Ny adgangskode",
  "auth.reset": "Nulstil",
  "auth.resetSent": "Hvis der findes en konto for {email}, er der sendt en nulstillingskode.",
  "auth.resetOk": "Adgangskode nulstillet – log ind.",
  "auth.codeSent": "En kode blev sendt til {email}.",
  "auth.newCodeSent": "Ny kode sendt.",
  "auth.2faTitle": "Trinvis bekræftelse",
  "auth.2faSubtitle": "Indtast koden fra din authenticator-app.",
  "auth.useRecovery": "Brug en gendannelseskode",
  "auth.recoveryPh": "Gendannelseskode",
  "classroom.opening": "Åbner dit klasseværelse…",
  "classroom.streak": "dages stime",
  "classroom.milestone": "Ny milepæl",
  "classroom.emptyTitle": "Intet planlagt endnu",
  "classroom.emptyDetail": "Din dag er bygget op omkring rigtigt arbejde. Scan en side af dit kursus eller start en diskussion, så planlægger klasseværelset ud fra det.",
  "classroom.replan": "Planlæg i dag igen",
  "classroom.offlineTitle": "Kan ikke få fat i dit klasseværelse",
  "classroom.offlineDetail": "Du er stadig logget ind – serveren svarer bare ikke. Tjek, at API'et kører, og prøv igen.",
  "classroom.start": "Start",
  "classroom.done": "Færdig",
  "classroom.skip": "Spring over",
  "classroom.isDone": "✓ Færdig",
  "classroom.isSkipped": "Trukte over",
  "slot.morning": "Morgen · gennemgå i går",
  "slot.afternoon": "Eftermiddag · dagens lektion",
  "slot.evening": "Aften · øvelse",
  "slot.night": "Før søvn · hurtig gentagelse",
  "nav.teacher": "Spørg din lærer",
  "nav.scan": "📷 Scan et kursus",
  "nav.languages": "Sprog",
  "nav.revision": "Gentagelseskø",
  "nav.progress": "Fremskridt",
  "tab.home": "Hjem",
  "tab.learn": "Lær",
  "tab.brain": "Min Hjerne",
  "tab.study": "Studér",
  "tab.profile": "Profil",
  "learn.title": "Lær",
  "learn.intro": "Hvor du tilegner dig ny viden.",
  "learn.teacher.title": "Spørg din lærer",
  "learn.teacher.detail": "Diskuter hvad som helst — besvaret ud fra dine egne noter, via stemme eller tekst.",
  "learn.languages.title": "Sprog",
  "learn.languages.detail": "Ordforråd, samtale og udtale på det sprog, du lærer.",
  "learn.scan.title": "Scan et kursus",
  "learn.scan.detail": "Fotografer en side eller dine noter, og gem dem i din hukommelse.",
  "brain.title": "Min Hjerne",
  "brain.intro": "Alt hvad du har lært, og hvor godt du kender det.",
  "brain.progress.title": "Fremskridt og mestring",
  "brain.progress.detail": "Din streak, retention, mestrede koncepter og milepæle.",
  "study.title": "Studér",
  "study.intro": "Øv på det rette tidspunkt, planlagt med spaced repetition.",
  "study.revision.title": "Gentagelseskø",
  "study.revision.detail": "Gennemgå de kort, der skal tages nu.",
  "profile.title": "Profil",
  "profile.account": "Konto",
  "profile.health.title": "Systemstatus",
  "profile.health.detail": "Kontroller, at tjenesterne bag dit klasseværelse kører.",
  "home.greeting": "Hej",
  "home.objective": "Dagens mål",
  "home.objectiveNone": "Intet planlagt endnu — scan et kursus eller start en diskussion.",
  "home.teacher": "Din AI-lærer",
  "home.continue": "Fortsæt din sidste lektion",
  "home.continueNone": "Ingen lektion endnu — din første vil vises her.",
  "home.priority": "Prioriteret gentagelse",
  "home.cardsDue": "kort forfalden",
  "home.reviewNow": "Gennemgå nu",
  "home.nothingDue": "Intet forfalden lige nu — du er helt ajour.",
  "home.plan": "Dagens plan",
  "home.progress": "Fremskridt",
  "home.retention": "retention",
  "home.mastered": "mestrede",
  "home.recommendations": "AI-anbefalinger",
  "home.recommendWork": "Arbejd på",
  "home.recommendNone": "Tilføj koncepter eller dokumenter, og anbefalinger vil vises her.",
  "home.open": "Åbn",
  "teacher.streak": "Flot vedholdenhed — hold din streak i gang!",
  "teacher.due": "Du har ventende gentagelser. Start med dem.",
  "teacher.first": "Klar til din første lektion? Scan et kursus eller spørg mig om alt.",
  "teacher.default": "Klar til at lære noget nyt i dag?",
  "soon.badge": "Kommer snart",
  "soon.detail": "Data vises efter tilstrækkelige læringssessioner.",
  "learn.library": "Bibliotek",
  "learn.ocr": "OCR-scanner",
  "learn.documents": "Dokumenter",
  "learn.exercises": "Øvelser",
  "learn.assessments": "Vurderinger",
  "learn.assessments.detail": "Læreren som eksaminator: Flervalgsoppgaver, essays, casestudier, prøveeksamener — bedømt med forklaringer og råd.",
  "learn.writing.title": "Skrivecoach",
  "learn.writing.detail": "Indsend et essay, en rapport eller et speciale — gennemgået for struktur, logik, klarhed, grammatik og argumentation.",
  "learn.reading.title": "Læsecoach",
  "learn.reading.detail": "Niveau-tilpassede tekster med læseforståelsesspørgsmål — sværhedsgraden tilpasses, efterhånden som du bliver bedre.",
  "study.planning": "Planlægning",
  "study.fsrs": "FSRS",
  "study.fsrs.detail": "Gennemgå alt med FSRS",
  "study.goals": "Mål",
  "study.exams": "Eksamener",
  "study.notifications": "Notifikationer",
  "brain.twin": "Digital Twin",
  "brain.twin.detail": "Din læringsprofil",
  "brain.memory": "Learning Memory",
  "brain.memory.detail": "Alt, hvad AI'en husker",
  "brain.mastery": "ConceptMastery",
  "brain.mastery.detail": "En score for hvert enkelt koncept",
  "brain.graph": "Vidensgraf",
  "brain.graph.detail": "Hvordan dine koncepter hænger sammen",
  "brain.dna": "Lærings-DNA",
  "brain.score": "Læringsscore",
  "brain.strengths": "Styrker",
  "brain.strengths.detail": "Hvad du er god til",
  "brain.weaknesses": "Svagheder",
  "brain.weaknesses.detail": "Hvad der halter bagud",
  "brain.insights": "AI-indsigter",
  "brain.insights.detail": "Hvorfor AI'en foreslår dette",
  "brain.recommend": "Anbefalinger",
  "brain.recommend.detail": "Hvad du skal gøre nu",
  "brain.dash.tagline": "Et sind der lærer — alt hvad Second Brain ved om dig, live.",
  "brain.dash.memories": "hukommelser",
  "brain.dash.concepts": "koncepter",
  "brain.dash.links": "links",
  "brain.dash.none": "Intet endnu",
  "revEng.title": "Revision Engine",
  "revEng.intro": "Én FSRS-kø til det hele — lektioner, øvelser, quizzer, lektier, sprog.",
  "revEng.loading": "Bygger din genopfriskningskø…",
  "revEng.empty": "Intet at gennemgå endnu — studer noget, så bliver det planlagt her.",
  "revEng.next": "næste",
  "revEng.now": "nu",
  "revEng.tomorrow": "i morgen",
  "revEng.days": "dage",
  "revEng.again": "Igen",
  "revEng.hard": "Svært",
  "revEng.good": "Godt",
  "revEng.easy": "Nemt",
  "plan.title": "Studieplanlægger",
  "plan.tileDetail": "Din dag, sammensat af AI'en",
  "plan.intro": "Dirigenten. Den opbygger intet selv — den sammensætter din dag fra de andre motorer.",
  "plan.loading": "Sammensætter din dag…",
  "plan.assembled": "Sammensat af",
  "plan.live": "Live-plan — den ændrer sig i løbet af dagen.",
  "plan.replan": "🔄 Planlæg igen fra nu",
  "plan.items": "elementer",
  "plan.k.revision": "Revision",
  "plan.k.lesson": "Lektion",
  "plan.k.discussion": "Diskussion",
  "plan.k.practical": "Praktisk",
  "plan.k.quiz": "Quiz",
  "plan.k.summary": "Resumé",
  "plan.k.break": "Pause",
  "plan.k.end": "Slut",
  "daily.title": "Daglig session",
  "daily.start": "🎓 Start dagens session",
  "daily.loading": "Opsætter dit klasseværelse…",
  "daily.noRevision": "Intet at gentage lige nu — direkte til dagens læring.",
  "daily.revisionIntro": "Først lader vi os friske op på det, der forfalder:",
  "daily.discussionIntro": "Spørg din lærer om hvad som helst om dette emne — lige her.",
  "daily.ask": "💬 Spørg lærer",
  "daily.askMore": "💬 Spørg igen",
  "daily.askPrompt": "Kan du forklare hovedtanken i dette emne på en simpel måde?",
  "daily.askError": "Læreren er utilgængelig lige nu — prøv igen om lidt.",
  "daily.checkIntro": "Svar med egne ord — jeg tjekker din forståelse og hjælper, hvor det er nødvendigt.",
  "daily.check.placeholder": "Dit svar…",
  "daily.check.btn": "Tjek min forståelse",
  "daily.check.again": "Tjek igen",
  "daily.check.understood": "Forstået!",
  "daily.check.partial": "Næsten — lad os finpudse det",
  "daily.check.confused": "Lad os gennemgå dette igen",
  "daily.check.reexplain": "Her er en anden måde at se det på",
  "daily.planningIntro": "Her er, hvad jeg har planlagt til dig næste gang:",
  "daily.p.welcome": "Velkommen",
  "daily.p.objectives": "Mål",
  "daily.p.revision": "Revision",
  "daily.p.lesson": "Lektion",
  "daily.p.questions": "Spørgsmål",
  "daily.p.discussion": "Diskussion",
  "daily.p.exercises": "Øvelser",
  "daily.p.homework": "Praktisk / Lektie",
  "daily.p.correction": "Rettelse",
  "daily.p.quiz": "Quiz",
  "daily.p.summary": "Resumé",
  "daily.p.flashcards": "Flashcards",
  "daily.p.brain": "Hjerneopdatering",
  "daily.p.planning": "Auto-planlægning",
  "cal.title": "Smart Kalender",
  "cal.tileDetail": "Eksaminer, revisioner og mere — automatisk genereret",
  "cal.intro": "Automatisk genereret ud fra alt det, AI'en har planlagt. Tilføj dine egne eksaminer og mål; AI'en opretholder prioriteten.",
  "cal.loading": "Bygger din kalender…",
  "cal.add": "Tilføj din egen",
  "cal.titlePlaceholder": "f.eks. Matematikeksamen",
  "cal.addBtn": "➕ Tilføj til kalender",
  "cal.todayTag": "I dag",
  "cal.nothing": "Intet planlagt",
  "cal.today": "I dag",
  "cal.tomorrow": "I morgen",
  "cal.in3": "Om 3 dage",
  "cal.in7": "Om en uge",
  "cal.k.exam": "Eksamen",
  "cal.k.homework": "Lektie",
  "cal.k.practical": "Praktisk",
  "cal.k.language": "Sprog",
  "cal.k.aiSession": "AI-session",
  "cal.k.revision": "Revision",
  "cal.k.quiz": "Quiz",
  "cal.k.objective": "Mål",
  "cal.k.deadline": "Deadline",
  "pred.title": "Prædiktiv revision",
  "pred.tileDetail": "Forudse glemmeriet, før det sker",
  "pred.intro": "Et lag oven på FSRS. FSRS siger, hvad der skal gentages nu; dette forudser, hvad du vil glemme — så AI'en handler før.",
  "pred.loading": "Beregner dine glemme-kurver…",
  "pred.fsrs": "FSRS: “Du skal til revision i dag.”",
  "pred.predictive": "Prædiktiv: “Om et par dage overskrides din glemme-tærskel.”",
  "pred.empty": "Alt er stabilt — intet er i fare for at blive glemt foreløbig.",
  "pred.in": "Om",
  "pred.forgettingPass": "vil din glemme-kurve overskride",
  "pred.now": "nu",
  "pred.today": "i dag",
  "pred.oneDay": "1 dag",
  "pred.days": "dage",
  "pred.reviewAhead": "🔁 Gentag nu for at være på forkant",
  "notif.title": "Smarte notifikationer",
  "notif.tileDetail": "Pædagogiske, altid begrundede",
  "notif.loading": "Forbereder dine notifikationer…",
  "notif.hello": "Hej",
  "notif.helloNoName": "Hej.",
  "notif.empty": "Intet at bemærke lige nu — du er på rette vej.",
  "notif.review": "En kort gennemgang på {m} minutter af {s} i dag vil øge din mstring med {p}%.",
  "notif.exam": "Din eksamen “{s}” er om {d} dage. Jeg har automatisk omstruktureret din plan.",
  "notif.unlock": "Flot arbejde. Vi kan nu starte på {next}.",
  "notif.forecast": "Om {d} dage vil din genkaldelse af {s} falde, og det at glemme vil overskride {p}%. En hurtig gennemgang nu forhindrer det.",
  "notif.src.mastery": "Baseret på din nuværende mestring",
  "notif.src.calendar": "Fra din kalender",
  "notif.src.path": "Fra din læringssti",
  "notif.src.forecast": "Fra forudsigende revision",
  "notif.cta.review": "🔁 Start gennemgangen",
  "notif.cta.exam": "📅 Se min plan",
  "notif.cta.unlock": "🎓 Start nu",
  "notif.cta.forecast": "🔮 Gentag på forhånd",
  "apath.title": "Tilpasset sti",
  "apath.tileDetail": "AI'en bestemmer din læringsrekkefølge",
  "apath.intro": "Fortæl mig, hvad du vil lære. Jeg tjekker vidensgraffen og din mestring og beslutter derefter den rette rækkefølge.",
  "apath.loading": "Indlæser dine begreber…",
  "apath.thinking": "Beregner den bedste rækkefølge…",
  "apath.pickGoal": "Jeg vil lære…",
  "apath.noConcepts": "Ingen begreber endnu — studer noget først, og sæt derefter et mål.",
  "apath.verdictConsolidate": "Før du starter {target}, lad os konsolidere {list}. Du vil forstå det, der følger efter, meget bedre.",
  "apath.verdictReady": "Alt er klar — du kan starte {target} med det samme!",
  "apath.and": "og",
  "apath.a.ready": "Mestret",
  "apath.a.consolidate": "Til konsolidering",
  "apath.a.target": "Mål",
  "profile.preferences": "Præferencer",
  "profile.languages": "Sprog",
  "profile.subscription": "Abonnement",
  "profile.aiSettings": "AI-indstillinger",
  "profile.notifications": "Notifikationer",
  "aiteacher.continue": "I dag fortsætter vi",
  "aiteacher.work": "I dag arbejder vi på",
  "aiteacher.reviewFirst": "Men først tager vi en hurtig gennemgang",
  "aiteacher.startLesson": "Start lektionen",
  "aiteacher.empty": "Jeg er din lærer. Fortæl mig, hvad du vil lære, eller scan et kursus for at begynde.",
  "aiteacher.ready": "Når du er klar.",
  "aiteacher.talkTitle": "Tal med din lærer",
  "aiteacher.topicPlaceholder": "Hvad vil du tale om?",
  "aiteacher.talk": "Start samtale",
  "aiteacher.resume": "💬 Fortsæt vores samtale",
  "aiteacher.twinPick": "Lad din lærer vælge dit svage punkt",
  "aiteacher.recent": "Seneste diskussioner",
  "aiteacher.messages": "beskeder",
  "aiteacher.focusedOn": "fokuseret på",
  "aiteacher.untitled": "Unavngivet diskussion",
  "aiteacher.open": "Åbn",
  "aiteacher.finishedLesson": "I går afsluttede vi lektionen om",
  "aiteacher.todayReview": "I dag foreslår jeg at gennemgå",
  "aiteacher.difficulties": "fordi jeg bemærkede nogle vanskeligheder.",
  "aiteacher.todayDiscover": "I dag går vi i gang med",
  "aiteacher.thenNext": "Derefter går vi videre til",
  "aiteacher.sessionCard": "Dagens session",
  "aiteacher.objective": "Mål",
  "aiteacher.duration": "Estimeret tid",
  "aiteacher.levelLabel": "Niveau",
  "aiteacher.minutes": "min",
  "aiteacher.objReview": "Gennemgå og konsolider",
  "aiteacher.objDiscover": "Forstå",
  "aiteacher.readyQ": "Klar?",
  "aiteacher.start": "▶  Start",
  "level.beginner": "Begynder",
  "level.intermediate": "Mellem",
  "level.advanced": "Avanceret",
  "lesson.opening": "Åbner din lektion…",
  "lesson.pitchedAt": "niveau, tilpasset til dig",
  "lesson.objectives": "Mål",
  "lesson.introduction": "Introduktion",
  "lesson.concept": "Koncept",
  "lesson.explanation": "Forklaring",
  "lesson.objectiveLabel": "Mål",
  "lesson.example": "Eksempel",
  "lesson.keyPoints": "Nøglepointer",
  "lesson.examples": "Eksempler",
  "lesson.questions": "Spørgsmål",
  "lesson.exercises": "Øvelser",
  "lesson.correction": "Rettelse",
  "lesson.summary": "Opsummering",
  "lesson.flashcards": "Notat- og huskekort",
  "lesson.revision": "Revision",
  "lesson.homework": "Hjemmearbejde",
  "lesson.reflect": "Overvej disse, før du går videre.",
  "lesson.readAloud": "Læs dette højt for mig",
  "lesson.yourAnswer": "Dit svar",
  "lesson.submit": "Indsend svar",
  "lesson.answerAgain": "Svar igen",
  "lesson.correct": "✓ Korrekt",
  "lesson.notQuite": "✗ Ikke helt",
  "lesson.feedback": "Feedback",
  "lesson.rootCause": "Årsag",
  "lesson.showCorrections": "Vis eksempelsvarene",
  "lesson.hideCorrections": "Skjul eksempelsvarene",
  "lesson.reveal": "Tryk for at afsløre",
  "lesson.noFlashcards": "Ingen huskekort til denne lektion.",
  "lesson.cardsScheduled": "huskekort er planlagt i din revisionskø.",
  "lesson.reviewNow": "Gennemgå nu",
  "lesson.savePdf": "📄 Gem som PDF",
  "lesson.doHomework": "📝 Lav mit hjemmearbejde",
  "lesson.step": "Trin",
  "lesson.of": "af",
  "lesson.continue": "Fortsæt",
  "lesson.previous": "Tilbage",
  "lesson.finish": "Afslut lektionen",
  "lesson.finishSession": "Afslut sessionen",
  "lesson.why": "Hvorfor?",
  "lesson.how": "Hvordan?",
  "lesson.errorMade": "Hvilken fejl?",
  "lesson.howToAvoid": "Hvordan undgår man den?",
  "exercise.qcm": "Flere svarmuligheder",
  "exercise.open": "Åbent spørgsmål",
  "exercise.exercise": "Øvelse",
  "exercise.case": "Praktisk case",
  "lesson.scheduleIn": "Jeg planlægger denne repetition om",
  "lesson.days": "dage",
  "lesson.day": "dag",
  "lesson.scheduleWhy": "Hvorfor? Fordi spazierepetition forudsiger, hvornår du glemmer – og minder dig om det lige inden.",
  "lesson.scheduleNow": "Disse kort er klar. Gennemgå dem, så planlægger jeg det næste præcis i det øjeblik, du er ved at glemme det.",
  "aiteacher.yesterday": "I går gennemgik vi",
  "aiteacher.beforeContinuing": "Før vi fortsætter, lad os gennemgå de vigtigste ideer.",
  "lang.dialogue": "Dialog",
  "lang.dialogueHelp": "En kort, skrevet samtale til studiebrug.",
  "lang.scenarioPlaceholder": "Scenarie (valgfrit) – f.eks. på markedet",
  "lang.generateDialogue": "Opret en dialog",
  "lang.essay": "Ret min tekst",
  "lang.essayHelp": "Skriv et par sætninger, så retter jeg dem som en lærer.",
  "lang.essayPlaceholder": "Skriv din tekst her…",
  "lang.correctEssay": "Ret den",
  "lang.assessment": "Vurdering",
  "lang.correctedVersion": "Rettet version",
  "lang.noMistakes": "Ingen fejl – godt gået!",
  "coach.title": "Din coach",
  "coach.suggestToday": "I dag foreslår jeg:",
  "coach.min": "min",
  "coach.why": "Hvorfor?",
  "mentor.why": "Hvorfor jeg foreslår dette",
  "mentor.act": "Lad os gøre det",
  "mentor.dismiss": "Ikke nu",
  "coachp.title": "Min akademiske coach",
  "coachp.tileDetail": "Tempo, sværhedsgrad og metode – tilpasset dig",
  "coachp.loading": "Læser dine læringsvaner…",
  "coachp.state": "Hvor du står",
  "coachp.streak": "Stribe",
  "coachp.discipline": "Disciplin",
  "coachp.week": "Denne uge",
  "coachp.mastery": "Mestring",
  "coachp.goals": "Mål",
  "coachp.pace": "Tempo",
  "coachp.difficulty": "Sværhedsgrad",
  "coachp.method": "Metode",
  "coachp.session": "Sessionslængde",
  "coachp.byCoach": "Coach",
  "coachp.byYou": "Dit valg",
  "coachp.reset": "Giv den tilbage til coachen",
  "coachp.pace.gentle": "Skånsom",
  "coachp.pace.steady": "Jævn",
  "coachp.pace.intensive": "Intensiv",
  "coachp.diff.beginner": "Begynder",
  "coachp.diff.intermediate": "Mellem",
  "coachp.diff.advanced": "Avanceret",
  "coachp.method.practice": "Øvelse",
  "coachp.method.reading": "Læsning",
  "coachp.method.socratic": "Sokratisk",
  "coachp.method.mixed": "Blandet",
  "coachp.disc.strong": "Stærk",
  "coachp.disc.building": "Opbygger",
  "coachp.disc.irregular": "Uregelmæssig",
  "coach.forgetting": "Du er gradvist ved at glemme",
  "risk.title": "Fremsyn",
  "risk.tileDetail": "Risici forude — før de opstår",
  "risk.loading": "Læser vejen forude…",
  "risk.intro": "Jeg kigger fremad og markerer risiciene på din vej — så vi handler, før de bliver til problemer.",
  "risk.calm": "Ingen presserende risici lige nu — du er på rette vej.",
  "risk.cause": "Sandsynlig årsag",
  "risk.action": "Anbefalet handling",
  "risk.why": "Signaler bag dette",
  "risk.kind.dropout": "Risiko for at droppe ud",
  "risk.kind.difficulty": "Sværhedsgrad forude",
  "risk.kind.overload": "Overbelastning",
  "risk.kind.motivation": "Motivationsdyk",
  "risk.kind.forgetting": "Sandsynlig glemning",
  "risk.level.low": "Lav",
  "risk.level.moderate": "Moderat",
  "risk.level.high": "Høj",
  "reco.title": "Til dig",
  "reco.tileDetail": "Lektioner, øvelser, læsestof — udvalgt til dig",
  "reco.loading": "Finder det, der passer til dig…",
  "reco.intro": "Personlige forslag til alt, hvad du kan gøre næste gang — hver med en begrundelse.",
  "reco.empty": "Intet at foreslå lige nu — kom tilbage efter lidt mere studering.",
  "reco.accept": "Lad os gøre det",
  "reco.dismiss": "Ikke nu",
  "reco.kind.lesson": "Ny lektion",
  "reco.kind.exercise": "Øvelser",
  "reco.kind.reading": "Læsning",
  "reco.kind.review": "Repetition",
  "reco.kind.practical": "Praktisk",
  "reco.kind.document": "Dokument",
  "ment.title": "AI Mentor",
  "ment.tileDetail": "Ærlig vejledning i, hvordan det reelt går dig",
  "ment.loading": "Træder tilbage for at se det store billede…",
  "ment.intro": "Ud over dagens lektion — en ærlig vurdering af din succes, eksamensforberedelse, organisation, metode og selvtillid.",
  "ment.focus": "Fokus",
  "ment.why": "Hvad jeg baserer dette på",
  "ment.dim.success": "Akademisk succes",
  "ment.dim.exams": "Eksamensforberedelse",
  "ment.dim.organization": "Organisation",
  "ment.dim.method": "Arbejdsmetode",
  "ment.dim.confidence": "Selvtillid",
  "ment.rating.good": "På sporet",
  "ment.rating.building": "Opbygger",
  "ment.rating.concern": "Kræver indsats",
  "succ.title": "Succesprædiktor",
  "succ.tileDetail": "Dine chancer pr. eksamen — og hvordan du øger dem",
  "succ.loading": "Beregner din eksamensparathed…",
  "succ.intro": "For hver eksamen: hvor forberedt du er, dine estimerede chancer, og hvor sikker jeg er.",
  "succ.note": "Målet er ikke at forudsige fremtiden — det er at hjælpe dig med at forberede dig bedre.",
  "succ.empty": "Ingen kommende eksaminer — tilføj en for at se din parathed.",
  "succ.preparation": "Forberedelse",
  "succ.probability": "Succeschancer",
  "succ.confidence": "Modelsikkerhed",
  "succ.advice": "Sådan forbereder du dig",
  "succ.why": "Faktorer",
  "succ.in": "om",
  "succ.days": "dage",
  "succ.today": "i dag",
  "succ.band.low": "lav",
  "succ.band.medium": "medium",
  "succ.band.high": "høj",
  "ic.title": "Intelligenscenter",
  "ic.metricValue": "Styrker, fremgang, næste skridt",
  "ic.loading": "Samler din intelligens…",
  "ic.intro": "Alt, hvad AI'en har lært om dig — styrker, svagheder, fremgang, vaner, præstation og områder, der kan forbedres. Altid med begrundelsen.",
  "ic.cat.strengths": "Styrker",
  "ic.cat.weaknesses": "Svagheder",
  "ic.cat.progress": "Fremgang",
  "ic.cat.habits": "Vaner",
  "ic.cat.performance": "Præstation",
  "ic.cat.improvement": "Områder der skal forbedres",
  "dna.title": "Lærings-DNA",
  "dna.metricValue": "Sådan lærer du bedst",
  "dna.loading": "Kortlægger dit Lærings-DNA…",
  "dna.intro": "Din dybe, stabile læringsprofil — hvordan du husker, hvornår du er bedst, hvilken modalitet og hvilke formater der passer til dig. Den skærpes, efterhånden som du lærer.",
  "dna.maturity": "DNA kortlagt",
  "dna.interactions": "interaktioner lært fra",
  "dna.trait.memory": "Sådan husker du",
  "dna.trait.peakTime": "Bedste tidspunkt",
  "dna.trait.modality": "Læringsmodalitet",
  "dna.trait.explanation": "Forklaringsdybde",
  "dna.trait.retentionFormat": "Bedste huskningsformat",
  "dna.band.emerging": "under udvikling",
  "dna.band.forming": "dannes",
  "dna.band.established": "etableret",
  "sync.title": "Synkroniseringscenter",
  "sync.tileDetail": "Arbejd offline — ændringer synkroniseres, når du er tilbage",
  "sync.intro": "Fortsæt med at arbejde uden forbindelse. Dine ændringer gemmes og synkroniseres automatisk, når du er online igen.",
  "sync.online": "Online",
  "sync.online.detail": "Forbundet — ændringer synkroniseres med det samme.",
  "sync.offline": "Offline",
  "sync.offline.detail": "Ingen forbindelse — ændringer gemmes og synkroniseres automatisk.",
  "sync.pending": "Afventende ændringer",
  "sync.last": "Seneste synkronisering",
  "sync.never": "Aldrig",
  "sync.now": "Synkroniser nu",
  "sync.note": "Læsninger cachen, så dine data forbliver synlige offline; skrivninger sættes i kø og afvikles i rækkefølge, når forbindringen genoprettes.",
  "mon.title": "Overvågning",
  "mon.tileDetail": "Systemets tilstand — trafik, latens, AI, cache",
  "mon.loading": "Læser systemets tilstand…",
  "mon.intro": "Platformens aktuelle sundhedstilstand baseret på in-process-metrikker (eksporteres også til Prometheus).",
  "mon.http": "HTTP-trafik",
  "mon.requests": "forespørgsler",
  "mon.errorRate": "fejrate",
  "mon.ai": "AI-kald",
  "mon.aiCalls": "kald",
  "mon.errors": "fejl",
  "mon.avgLatency": "gns. latens",
  "mon.byModel": "Pr. model",
  "mon.cache": "Cache",
  "mon.hitRate": "hitrate",
  "mon.hits": "hits",
  "mon.misses": "misses",
  "mon.process": "Proces",
  "mon.memory": "hukommelse",
  "mon.heap": "heap",
  "mon.uptime": "oppetid",
  "mon.note": "Fejl flyder også til Sentry/OpenTelemetry-integrationen (aktiv når en DSN er konfigureret). Prometheus skraber GET /metrics.",
  "lm.title": "Sprog",
  "lm.manage": "Administrer sprog",
  "lm.intro": "Hvert grænsefladesprog og hvor fuldstændigt det er. Skift af sprog ændrer også AI-lærerens sprog.",
  "lm.active": "Aktiv",
  "lm.translated": "oversat",
  "lm.fallback": "resten falder tilbage til engelsk",
  "lm.note": "Nye sprog tilføjes ved at indsætte en ressourcefil — ingen ændring af appens kode. Uoversatte nøgler falder automatisk tilbage til engelsk.",
  "aim.title": "AI-udbydere",
  "aim.tileDetail": "Multi-model-orkestrator — vælg bedste / billigste / hurtigste",
  "aim.loading": "Læser AI-in基础设施…",
  "aim.intro": "De tilgængelige AI-backends og strategien, der vælger imellem dem. Skift omdirigerer alle AI-kald.",
  "aim.strategy": "Strategi",
  "aim.active": "Aktiv udbyder",
  "aim.catalog": "Udbydere",
  "aim.ready": "Klar",
  "aim.off": "Fra",
  "aim.cost": "pris",
  "aim.speed": "hastighed",
  "aim.quality": "kvalitet",
  "aim.vision": "vision",
  "aim.strat.quality": "Bedste",
  "aim.strat.cost": "Billigste",
  "aim.strat.speed": "Hurtigste",
  "aim.strat.balanced": "Balanceret",
  "plg.title": "Udvidelser",
  "plg.tileDetail": "Rum, forbindelser & AI-motorer — køreplanen",
  "plg.loading": "Indlæser udvidelser…",
  "plg.intro": "Alt hvad Second Brain kan udvikle sig til — hver især et plugin, der registreres uden at berøre kernen.",
  "plg.active": "Aktiv",
  "plg.available": "Tilgængelig",
  "plg.planned": "Planlagt",
  "plg.requires": "Kræver",
  "plg.note": "Plugin-motoren gør det muligt at tilføje nye Brains, forbindelser og AI-motorer uden en større omskrivning — appen kan udvikle sig i årevis.",
  "coach.upToDate": "Du er helt ajour — intet halter bagefter lige nu.",
  "coach.score": "Læringsscore",
  "coach.wouldRaise": "Denne gentagelse vil hæve din læringsscore med",
  "coach.points": "point",
  "coach.newScore": "Ikke nok data endnu — start en lektion for at opbygge din score.",
  "briefing.hello": "Hej",
  "briefing.analyzed": "Jeg har analyseret dine fremskridt.",
  "briefing.recommend": "I dag anbefaler jeg:",
  "briefing.achievable": "Du kan nå dit mål på {n} minutter.",
  "briefing.start": "Start min session",
  "briefing.min": "min",
  "briefing.k.review": "Gentagelse",
  "briefing.k.lesson": "Ny lektion",
  "briefing.k.vocabulary": "Ordforråd",
  "briefing.upToDate": "Du er helt ajour — intet presserende i dag. En kort gentagelse hjælper stadig.",
  "homework.title": "Lektie",
  "homework.preparing": "Forbereder din personlige lektie…",
  "homework.focusLabel": "Hvorfor denne lektie",
  "homework.masteryAt": "Tilpasset dit aktuelle niveau:",
  "homework.exercises": "Øvelser",
  "homework.questions": "Spørgsmål",
  "homework.correction": "Retelse",
  "homework.reflect": "Tænker du disse igennem — ingen karakter, bare refleksion.",
  "homework.showAnswers": "Vis modelsvarene",
  "homework.hideAnswers": "Skjul modelsvarene",
  "homework.regenerate": "↻ Ny lektie",
  "homework.regenHint": "Generer den igen, tilpasset dine seneste fremskridt.",
  "homework.back": "Tilbage",
  "session.startGuided": "▶ Start min guidede session",
  "session.welcome": "Din session",
  "session.yourSession": "Dagens session",
  "session.defaultPlan": "Jeg guider dig igennem hele sessionen, trin for trin, og opdaterer din Digital Twin til sidst.",
  "session.thePlan": "Planen",
  "session.start": "▶ Start lektionen",
  "session.noLesson": "Denne session har ikke nogen lektion endnu.",
  "session.home": "Tilbage til start",
  "session.closing": "Afslutter din session og opdaterer din Digital Twin…",
  "session.done": "Session fuldført",
  "session.whatWeDid": "Hvad vi gjorde",
  "session.twinUpdate": "Opdatering af Digital Twin",
  "session.before": "Før",
  "session.after": "Efter",
  "session.points": "pts",
  "session.conceptMastery": "Beherskelse af dette koncept:",
  "session.nowTracked": "Din Digital Twin sporer nu dette koncept.",
  "session.results": "Resultater",
  "session.exercisesRight": "øvelser korrekte",
  "session.cardsScheduled": "flashcards planlagt (FSRS)",
  "session.nextReview": "Næste gennemgang:",
  "session.reviewNow": "🔁 Gennemse nu",
  "session.today": "i dag",
  "session.tomorrow": "i morgen",
  "session.inDays": "dage",
  "session.stageLesson": "Lektion",
  "session.stageQuestions": "Spørgsmål",
  "session.stageExercises": "Øvelser",
  "session.stageCorrection": "Rettelse",
  "session.stageSummary": "Resumé",
  "session.stageFlashcards": "Flashcards",
  "session.stageFsrs": "FSRS-planlægning",
  "session.stageTwin": "Opdatering af Digital Twin",
  "twin.title": "Digital Twin",
  "twin.intro": "Din læringsprofil – den udvikler sig efter hver interaktion.",
  "twin.loading": "Læser din Digital Twin…",
  "twin.notEnough": "Ikke nok data endnu",
  "twin.progress": "Samlede fremskridt",
  "twin.conceptsTracked": "koncepter sporet",
  "twin.lessons": "lektioner",
  "twin.evolves": "Lærir løbende",
  "twin.interactions": "interaktioner indtil videre",
  "twin.level": "Reelt niveau",
  "twin.speed": "Læringshastighed",
  "twin.subjects": "Yndlingsemner",
  "twin.style": "Læringsstil",
  "twin.depth": "Forklaringsdybde",
  "twin.language": "Foretrukne sprog",
  "twin.rhythm": "Arbejdsrytme",
  "twin.focus": "Fokustimer",
  "twin.band.new": "Lige startet",
  "twin.band.weak": "Sørgelig",
  "twin.band.building": "Opbygger",
  "twin.band.strong": "Stærk",
  "twin.speed.building": "Opbygning",
  "twin.speed.steady": "Jævn",
  "twin.speed.fast": "Hurtig",
  "twin.style.voice": "Talt",
  "twin.style.handsOn": "Praktisk",
  "twin.style.reading": "Læsning",
  "twin.depth.simple": "Enkel, trin for trin",
  "twin.depth.balanced": "Balanceret",
  "twin.depth.deep": "Dybdegående",
  "twin.rhythm.occasional": "Lejlighedsvis",
  "twin.rhythm.regular": "Regelmæssig",
  "twin.rhythm.intensive": "Intensiv",
  "twin.focus.morning": "Morgen",
  "twin.focus.afternoon": "Eftermiddag",
  "twin.focus.evening": "Aften",
  "twin.focus.night": "Nat",
  "memory.title": "Læringshukommelse",
  "memory.intro": "Alt, hvad du har gjort — så AI'en aldrig starter fra nul.",
  "memory.loading": "Åbner din læringshukommelse…",
  "memory.remembered": "hukommelser husket",
  "memory.timeline": "Tidslinje",
  "memory.empty": "Intet husket endnu — start en lektion, så vises den her.",
  "memory.exercises": "Øvelser",
  "memory.successes": "Succeser",
  "memory.errors": "Fejl",
  "memory.revisions": "Revisioner",
  "memory.conversations": "Samtaler",
  "memory.homework": "Lektier",
  "memory.reports": "Rapporter",
  "memory.documents": "Dokumenter",
  "memory.k.lesson": "Lektion",
  "memory.k.success": "Succes",
  "memory.k.error": "Fejl",
  "memory.k.revision": "Revision",
  "memory.k.conversation": "Samtale",
  "memory.k.homework": "Lektie",
  "memory.k.report": "Sessionsrapport",
  "memory.k.document": "Dokument",
  "mastery.title": "Konceptbeherskelse",
  "mastery.intro": "Hvert koncept får en score — det mest presserende revideres først.",
  "mastery.loading": "Scorer dine koncepter…",
  "mastery.empty": "Ingen koncepter endnu — studer en lektion knyttet til et koncept for at se det scoret.",
  "mastery.mastery": "Beherskelse",
  "mastery.confidence": "Tillid",
  "mastery.errors": "Fejl",
  "mastery.forgetting": "Glemmer",
  "mastery.priority": "Revisionsprioritet",
  "mastery.conf.low": "Lav",
  "mastery.conf.medium": "Mellem",
  "mastery.conf.high": "Høj",
  "mastery.err.none": "Ingen",
  "mastery.err.low": "Sjælden",
  "mastery.err.high": "Hyppig",
  "mastery.prio.low": "Lav",
  "mastery.prio.medium": "Mellem",
  "mastery.prio.high": "Høj",
  "mastery.prio.urgent": "Presserende",
  "graph.title": "Vidensgraf",
  "graph.intro": "Hvordan dine koncepter afhænger af hinanden — fundamentet først.",
  "graph.loading": "Kortlægger dine koncepter…",
  "graph.empty": "Ingen koncepter endnu — studer nogle, og link dem derefter for at se grafen.",
  "graph.s.mastered": "Behersket",
  "graph.s.in_progress": "I gang",
  "graph.s.ready": "Klar",
  "graph.s.at_risk": "I risikozone",
  "graph.s.blocked": "Blokeret",
  "sw.title": "Styrker og svagheder",
  "sw.intro": "Det, du er god til, og det, der halter — AI'en planlægger dine næste sessioner ud fra dette.",
  "sw.loading": "Vurderer dine begreber…",
  "sw.strengths": "Styrker",
  "sw.weaknesses": "Svagheder",
  "sw.noStrengths": "Ingen stærke begreber endnu — fortsæt bare!",
  "sw.noWeaknesses": "Ingenting halter lige nu. Godt arbejde!",
  "sw.aiNote": "AI'en vil fokusere dine næste sessioner på disse svage punkter først.",
  "sw.startWeakest": "▶ Arbejd på mine svage punkter",
  "rec.title": "Anbefalinger",
  "rec.intro": "Din mentors næste skridt — ikke bare analyse, men hvad du bør gøre nu.",
  "rec.loading": "Tænker på dit næste skridt…",
  "rec.empty": "Intet at anbefale endnu — studér lidt, så vil jeg guide dig.",
  "rec.review": "Jeg anbefaler en revision på {m} minutter af {s}.",
  "rec.consolidate": "Konsolider {s}, før du kaster dig over noget nyt.",
  "rec.levelUp": "Du har mestrer {s} — klar til næste niveau.",
  "rec.advance": "Alt er solidt — du er klar til at lære noget nyt.",
  "rec.cta.review": "🔁 Gennemgå nu",
  "rec.cta.consolidate": "🧱 Konsolider",
  "rec.cta.levelUp": "🎓 Nå et nyt niveau",
  "rec.cta.advance": "🚀 Lær noget nyt",
  "insight.title": "AI-indsigter",
  "insight.intro": "Hvorfor AI'en foreslår det, den gør — baseret på din reelle aktivitet.",
  "insight.loading": "Læser signalerne…",
  "insight.empty": "Ikke nok aktivitet endnu — studér lidt, så dukker der indsigter op.",
  "insight.days": "dage",
  "insight.interactions": "interaktioner",
  "insight.strengthA": "Du gør gode fremskridt i",
  "insight.forgetA": "Du har tendens til at glemme",
  "insight.forgetB": "efter ca.",
  "insight.atRiskA": "Du er ved at glemme",
  "insight.atRiskB": "— gennemgå det først.",
  "insight.focusA": "Du lærer bedst mellem",
  "insight.focusB": "og",
  "insight.accA": "Du svarer rigtigt på",
  "insight.accB": "af dine øvelser.",
  "insight.rhythmA": "Du har arbejdet",
  "insight.styleA": "Du lærer bedst ved",
  "insight.rhythm.occasional": "lejlighedsvis",
  "insight.rhythm.regular": "regelmæssigt",
  "insight.rhythm.intensive": "intensivt",
  "insight.style.voice": "at lytte",
  "insight.style.handsOn": "øvelse",
  "insight.style.reading": "at læse",
  "tutor.discussion": "Diskussion",
  "tutor.opening": "Åbner diskussionen…",
  "tutor.focusedOn": "Fokuseret på",
  "tutor.placeholder": "Spørg din lærer…",
  "tutor.send": "Send",
  "tutor.slower": "🐢 Langsommere",
  "tutor.faster": "🐇 Hurtigere",
  "tutor.slowerMsg": "Kan du sætte farten ned og forklare det mere enkelt?",
  "tutor.stopSend": "Stop og send",
  "tutor.cancel": "Annuller",
  "tutor.speak": "🎤 Tal i stedet",
  "tutor.voiceUnsupported": "Stemmefunktionen kræver en mikrofon — ikke tilgængelig i denne platformversion endnu.",
  "tutor.recording": "Optager… tal, og stop derefter.",
  "tutor.you": "Du",
  "tutor.teacher": "Lærer",
  "tutor.spoken": "🎤 talte",
  "tutor.transcribing": "Transkriberer, besvarer og skriver lektionen for denne tur efterlader…",
  "tutor.teacherSpeaking": "🔊 Læreren svarer højt…",
  "tutor.heard": "Hørt:",
  "tutor.filedA": "— en skrevet lektion",
  "tutor.filedInto": "blev gemt i din hukommelse med",
  "tutor.flashcards": "flashcards",
  "tutor.groundedPre": "Baseret på",
  "tutor.groundedPassage": "passage",
  "tutor.groundedPassages": "passager",
  "tutor.groundedPost": "fra dine noter:",
  "header.lesson": "Lektion",
  "header.newLesson": "Ny lektion",
  "header.aiTeacher": "AI-lærer",
  "header.teacher": "Lærer",
  "header.homework": "Hjemmearbejde",
  "header.session": "Studiession",
  "header.twin": "Digital Twin",
  "header.memory": "Læringshukommelse",
  "header.mastery": "ConceptMastery",
  "header.graph": "Vidensgraf",
  "header.strengths": "Styrker og svagheder",
  "header.insights": "AI-indsigter",
  "header.recommend": "Anbefalinger",
  "header.revEngine": "Revisionsmotor",
  "header.planner": "Studieplanlægger",
  "header.daily": "Daglig session",
  "header.calendar": "Smart kalender",
  "header.predictions": "Prædiktiv revision",
  "header.notifications": "Smarte notifikationer",
  "header.adaptivePath": "Adaptiv sti",
  "header.goals": "Mål",
  "header.exams": "Kommende eksamener",
  "header.library": "Bibliotek",
  "header.document": "Dokument",
  "header.ask": "Spørg mit bibliotek",
  "header.resource": "Studieressource",
  "header.workspace": "Akademisk arbejdsområde",
  "lib.title": "Bibliotek",
  "lib.tileDetail": "Dit levende, AI-organiserede bibliotek",
  "lib.intro": "Hvert dokument, du tilføjer, forstås af AI'en: resumé, emne, sprog, begreber og sværhedsgrad — alt sammen automatisk.",
  "lib.loading": "Åbner dit bibliotek…",
  "lib.all": "Alle",
  "lib.favorites": "Favoritter",
  "lib.recent": "Seneste",
  "lib.shared": "Delte",
  "lib.trash": "Papirkurv",
  "lib.subjects": "Emner",
  "lib.languages": "Sprog",
  "lib.collections": "Samlinger",
  "lib.empty": "Ingen dokumenter her endnu.",
  "lib.sharedSoon": "Deling kommer i et senere trin — intet delt endnu.",
  "lib.analysing": "AI'en analyserer stadig dette dokument…",
  "lib.pipelineRunning": "Automatisk behandling…",
  "lib.stage.cleaning": "Renser",
  "lib.stage.segmenting": "Segmenterer",
  "lib.stage.embedding": "Embeddinger",
  "lib.stage.indexing": "Indekserer",
  "lib.stage.graphing": "Vidensgraf",
  "lib.add": "＋ Tilføj",
  "lib.scan": "Scan",
  "lib.addText": "📝 Tekst",
  "lib.addUrl": "🔗 URL",
  "lib.addTitle": "Titel",
  "lib.addBody": "Indsæt dine noter / tekst her…",
  "lib.addBtn": "Føj til bibliotek",
  "lib.addFile": "📄 Importer en fil (PDF, txt, md)",
  "lib.addTextRequired": "En titel og noget tekst er påkrævet.",
  "lib.addUrlRequired": "En URL er påkrævet.",
  "lib.diff.beginner": "Begynder",
  "lib.diff.intermediate": "Mellem",
  "lib.diff.advanced": "Avanceret",
  "lib.status.pending": "I kø",
  "lib.status.processing": "Analyserer",
  "lib.status.ready": "Klar",
  "lib.status.failed": "Fejlede",
  "lib.summary": "AI-resumé",
  "lib.concepts": "Registrerede begreber",
  "lib.noConcepts": "Ingen begreber registreret endnu — tryk på \"Registrer begreber\".",
  "lib.content": "Indhold",
  "lib.unknown": "Ikke registreret",
  "lib.chars": "tegn",
  "lib.m.subject": "Emne",
  "lib.m.language": "Sprog",
  "lib.m.difficulty": "Sværhedsgrad",
  "lib.m.author": "Forfatter",
  "lib.m.collection": "Samling",
  "lib.m.added": "Tilføjet",
  "lib.m.size": "Størrelse",
  "lib.reanalyse": "🤖 Genanalyser",
  "lib.detectConcepts": "🧩 Registrer begreber",
  "lib.restore": "♻️ Gendan",
  "lib.moveToTrash": "🗑️ Flyt til papirkurv",
  "lib.deleteForever": "Slet permanent",
  "lib.askLibrary": "Spørg",
  "lib.askThisDoc": "❓ Spørg om dette dokument",
  "lib.ask.title": "Spørg i mit bibliotek",
  "lib.ask.intro": "Stil et spørgsmål — besvares kun ud fra dine egne dokumenter med kildehenvisninger. Intet opfindes.",
  "lib.ask.scope": "Søg i",
  "lib.ask.all": "Hele biblioteket",
  "lib.ask.thisDoc": "Dette dokument",
  "lib.ask.placeholder": "f.eks. Hvad er stadierne i fotosyntese?",
  "lib.ask.btn": "Spørg",
  "lib.ask.answer": "Svar",
  "lib.ask.noContext": "Intet relevant blev fundet inden for dette omfang — prøv et andet spørgsmål eller udvid omfanget.",
  "lib.ask.sources": "Kilder",
  "lib.u.title": "AI-forståelse",
  "lib.u.summarize": "Opsummer",
  "lib.u.rephrase": "Omformulér",
  "lib.u.simplify": "Forenklet",
  "lib.u.explain": "Forklar",
  "lib.u.adapted": "Tilpasset dit niveau:",
  "lib.u.compareTitle": "Sammenlign",
  "lib.u.compare": "Sammenlign med et andet dokument",
  "lib.u.noOther": "Ingen andre dokumenter at sammenligne med endnu.",
  "lib.u.prereqTitle": "Forudsætninger",
  "lib.u.reviewFirst": "Gennemgå disse før du studerer dette dokument:",
  "lib.u.untracked": "ikke sporet",
  "lib.level.new": "ny",
  "lib.level.beginner": "begynder",
  "lib.level.intermediate": "øvet",
  "lib.level.advanced": "avanceret",
  "lib.r.title": "Studieressourcer",
  "lib.r.saved": "Gemte ressourcer",
  "lib.r.summary": "Resumé",
  "lib.r.revisionSheet": "Repetitionsark",
  "lib.r.flashcards": "Flashcards",
  "lib.r.quiz": "Quiz",
  "lib.r.exercises": "Øvelser",
  "lib.r.openQuestions": "Åbne spørgsmål",
  "lib.r.coursePlan": "Kursusplan",
  "lib.r.mindmap": "Mindmap (kommer snart)",
  "lib.r.review": "🎴 Anmeld nu",
  "lib.workspace": "🎓 Akademisk arbejdsområde",
  "ws.title": "Akademisk arbejdsområde",
  "ws.analysing": "Læreren analyserer dette arbejde...",
  "ws.analysisTitle": "Analyse",
  "ws.levelAdapted": "tilpasset til:",
  "ws.objectives": "Mål",
  "ws.skills": "Evaluerede færdigheder",
  "ws.prerequisites": "Forudsætninger",
  "ws.successCriteria": "Succeskriterier",
  "ws.keyNotions": "Nøglebegreber",
  "ws.likelyHard": "Sandsynligvis svært for dig",
  "ws.chooseMode": "Vælg din støtte",
  "ws.mode.guide": "Vejledning",
  "ws.mode.accompany": "Løs sammen",
  "ws.mode.solve": "Fuld løsning",
  "ws.thinking": "Læreren tænker...",
  "ws.placeholder": "Spørg, svar eller del dit forsøg...",
  "ws.send": "Send",
  "ws.finishTitle": "Gør dette arbejde til læring",
  "ws.finishHint": "Generer et resumé, flashcards og en quiz fra dette arbejde — gemt i dit bibliotek og føjet til din repetition.",
  "ws.generate": "Generer studieressourcer",
  "ws.generated": "✅ Ressourcer genereret og gemt — tjek dokumentets ressourcer.",
  "lib.integ.title": "Hjernintegration",
  "lib.integ.summary": "Dette dokument tilføjede {c} begreb(er), {ch} hukommelsespassage(r) og {e} graflink(s) til din hjern.",
  "lib.integ.new": "Nye begreber",
  "lib.integ.known": "Allerede kendt (fra andre dok.)",
  "lib.integ.mastered": "Allerede mestret",
  "lib.integ.fragile": "Stadig skrøbelig",
  "lib.integ.prereq": "Forudsætninger",
  "lib.integ.dependents": "Bygger op mod",
  "lib.integ.links": "Links til eksisterende viden",
  "goals.tileDetail": "Daglige, ugentlige og månedlige mål",
  "goals.title": "Mål",
  "goals.intro": "Hvad vil du opnå? Sæt mål for i dag, denne uge og denne måned.",
  "goals.placeholder": "f.eks. Bliv færdig med genetik-kapitlet",
  "goals.addBtn": "Tilføj mål",
  "goals.daily": "Dagligt",
  "goals.weekly": "Ugentligt",
  "goals.monthly": "Månedligt",
  "goals.none": "Ingen mål endnu.",
  "goals.loading": "Indlæser dine mål...",
  "exams.tileDetail": "Fag, datoer og parathed",
  "exams.title": "Kommende eksamener",
  "exams.intro": "Dine eksamener, sorteret efter dato. Paratheden estimeres ud fra din begrebsmestring.",
  "exams.placeholder": "Fag (f.eks. Genetik)",
  "exams.addBtn": "Tilføj eksamen",
  "exams.none": "Ingen eksamen planlagt.",
  "exams.loading": "Indlæser dine eksamener…",
  "exams.prep": "Parathed",
  "exams.prepUnknown": "Ikke nok data endnu",
  "exams.p.high": "Høj",
  "exams.p.medium": "Medium",
  "exams.p.low": "Lav",
  "exams.in3": "Om 3 dage",
  "exams.in7": "Om 1 uge",
  "exams.in14": "Om 2 uger",
  "exams.in30": "Om 1 måned",
  "exams.past": "Tidligere",
  "exams.today": "I dag",
  "exams.tomorrow": "I morgen",
  "exams.in": "om",
  "exams.days": "dage",
  "header.languages": "Sprog",
  "header.language": "Sprog",
  "header.scan": "Scan et kursus",
  "header.revision": "Revision",
  "header.progress": "Fremskridt",
  "header.health": "Systemhelbred",
  "verdict.correct": "korrekt",
  "verdict.partial": "delvist",
  "verdict.incorrect": "ukorrekt",
  "rating.good": "god",
  "rating.fair": "middel",
  "rating.needs_work": "kræver arbejde",
  "examiner.title": "📝 AI-eksaminator",
  "examiner.intro": "Læreren bliver din eksaminator — den opretter vurderingen og retter den derefter med forklaringer og råd. Karakteren står aldrig alene.",
  "examiner.create": "Opret en vurdering",
  "examiner.topicPlaceholder": "Emne — f.eks. den franske revolution",
  "examiner.difficulty": "Sværhedsgrad",
  "examiner.createTake": "Opret og tag",
  "examiner.emptyTitle": "Ingen vurderinger endnu",
  "examiner.emptyDetail": "Vælg en type og et emne ovenfor — flervalgsspørgsmål, åbne spørgsmål, opgaver, øvelser, casestudier, mock-eksamener eller mundtlig evaluering.",
  "examiner.questionsCount": "{n} spørgsmål",
  "examiner.scored": "fik {n}/100",
  "examiner.notTaken": "ikke taget",
  "examiner.review": "Gennemgå",
  "examiner.take": "Tag den",
  "examiner.levelWord": "niveau",
  "examiner.question": "Spørgsmål",
  "examiner.points": "{n} pt.",
  "examiner.yourAnswer": "Dit svar…",
  "examiner.why": "Hvorfor: ",
  "examiner.how": "Hvordan: ",
  "examiner.mistake": "Fejl: ",
  "examiner.avoid": "Undgå det: ",
  "examiner.submit": "Indsend til bedømmelse",
  "examiner.next": "Hvad du skal gøre nu",
  "examiner.back": "Tilbage til vurderinger",
  "examiner.t.mcq": "Flervalgsspørgsmål",
  "examiner.t.open": "Åbne spørgsmål",
  "examiner.t.dissertation": "Opgaver",
  "examiner.t.exercise": "Øvelser",
  "examiner.t.case_study": "Casestudie",
  "examiner.t.mock_exam": "Mock-eksamen",
  "examiner.t.oral": "Mundtlig evaluering",
  "writing.title": "✍️ Skrivecoach",
  "writing.intro": "Indsend et stykke skrivearbejde — læreren analyserer struktur, logik, klarhed, stavning, grammatik, argumentation og akademisk kvalitet og forklarer derefter præcist, hvordan det kan forbedres.",
  "writing.new": "Ny indsendelse",
  "writing.titlePlaceholder": "Titel (valgfri)",
  "writing.briefPlaceholder": "Opgaven / prompten den besvarer (valgfri)",
  "writing.textPlaceholder": "Indsæt din tekst her…",
  "writing.review": "Gennemgå min tekst",
  "writing.emptyTitle": "Ingen indsendelser endnu",
  "writing.emptyDetail": "Indsæt et essay, en rapport, afhandling eller et skriftligt arbejde ovenfor for at få en fuld, struktureret gennemgang.",
  "writing.scored": "fik {n}/100",
  "writing.open": "Åbn gennemgang",
  "writing.reviewTitle": "Skrivegennemgang",
  "writing.works": "Hvad der fungerer",
  "writing.improve": "Sådan kan det forbedres: ",
  "writing.first": "Gør dette først",
  "writing.back": "Tilbage til skrivning",
  "writing.t.redaction": "Essay",
  "writing.t.dissertation": "Afhandling",
  "writing.t.memoire": "Speciale",
  "writing.t.rapport": "Rapport",
  "writing.t.compte_rendu": "Resumé",
  "writing.t.devoir": "Hjemmearbejde",
  "writing.d.structure": "Struktur",
  "writing.d.logic": "Logik",
  "writing.d.clarity": "Klarhed",
  "writing.d.spelling": "Stavning",
  "writing.d.grammar": "Grammatik",
  "writing.d.argumentation": "Argumentation",
  "writing.d.academic_quality": "Akademisk kvalitet",
  "reading.title": "📖 Læsetræner",
  "reading.intro": "Få en tekst tilpasset dit niveau med læseforståelsesspørgsmål. Træneren retter dine svar og tilpasser sværhedsgraden automatisk.",
  "reading.yourLevel": "Dit læseniveau",
  "reading.topicPlaceholder": "Emne (valgfrit) – f.eks. vulkaner, økonomi…",
  "reading.generate": "Generer en tekst",
  "reading.emptyTitle": "Ingen tekster endnu",
  "reading.emptyDetail": "Generer din første tekst ovenfor – niveauet tilpasses undervejs.",
  "reading.scored": "fik {n}/100",
  "reading.notTaken": "ikke besvaret",
  "reading.review": "Gennemgang",
  "reading.read": "Læs den",
  "reading.levelWord": "niveau",
  "reading.question": "Spørgsmål",
  "reading.yourAnswer": "Dit svar…",
  "reading.mistake": "Fejl: ",
  "reading.avoid": "Undgå det: ",
  "reading.submit": "Indsend svar",
  "reading.back": "Tilbage til læsning",
  "reading.levelUp": "⬆ Nyt niveau: {from} → {to}",
  "reading.levelDown": "⬇ Lettere næste gang: {from} → {to}",
  "reading.levelHeld": "Niveau bibeholdt på {to}",
  "reading.lvl.beginner": "begynder",
  "reading.lvl.intermediate": "mellem",
  "reading.lvl.advanced": "avanceret",
  "reading.lvl.expert": "ekspert",
  "lang.learnTitle": "Lær et sprog",
  "lang.langPlaceholder": "Sprog (f.eks. spansk)",
  "lang.nativePlaceholder": "Dit modersmål (til gloser)",
  "lang.teachingMode": "Undervisningstilstand",
  "lang.start": "Start",
  "lang.noLangsTitle": "Ingen sprog endnu",
  "lang.noLangsDetail": "Din lærer opbygger ordforråd i din normale repetitionskø, fører dybdegående samtaler og vurderer, hvor godt du bliver forstået, når du læser højt.",
  "lang.fromNative": "fra {native}",
  "lang.open": "Åbn",
  "lang.metaWords": "ord",
  "lang.metaDue": "forfalder",
  "lang.metaLessons": "lektioner",
  "lang.immersionBadge": "🌊 Fordybelse · ~{pct}% {lang}",
  "lang.immersionHelp": "Din lærer forbliver på {lang}, omformulerer og forklarer kort, hvis du farer vild, og vender derefter tilbage til {lang} — og taler mere {lang}, i takt med at dit CEFR-niveau stiger.",
  "lang.skills": "Grammatik, bøjning & forståelse",
  "lang.skillsHelp": "Tilpasset dit CEFR-niveau ({level}). Lad feltet være tomt for at lade læreren vælge, eller angiv et emne / et verbum.",
  "lang.skillPlaceholder": "Emne eller verbum (valgfrit) — f.eks. datid, être",
  "lang.grammar": "📖 Grammatik",
  "lang.conjugation": "🔤 Bøjning",
  "lang.comprehension": "📝 Forståelse",
  "lang.listen": "🔊 Lyt (muntlig forståelse)",
  "lang.conversation": "Samtale",
  "lang.conversationHelp": "Øvelsen kører på din normale samtaleskærm — læreren forbliver i sin rolle og forlader aldrig målsproget i fordybelsestilstand.",
  "lang.scenarioConvo": "Scenarie (valgfrit) — f.eks. på apoteket",
  "lang.startTalking": "Start med at tale",
  "lang.vocabulary": "Ordforråd",
  "lang.vocabularyHelp": "Indsæt alt det, du læser. Ord bliver til almindelige FSRS-kort, så de vises i din genopfriskningskø sammen med alt andet.",
  "lang.vocabPlaceholder": "Indsæt tekst på dit målsprog…",
  "lang.mineVocab": "Udtræk ordforråd",
  "lang.vocabResult": "{n} nyt/nye ord tilføjet til din genopfriskningskø{had}.",
  "lang.vocabHad": " ({n} du allerede havde)",
  "lang.lesson": "Lektion",
  "lang.lessonPlaceholder": "Hvad skal vi dække? f.eks. bestille mad",
  "lang.writeLesson": "Skriv en lektion til mig",
  "lang.sayOutLoud": "Sig det højt",
  "lang.sayHelp": "Dette måler, om din tale blev GENKENDT som sætningen — et reelt tjek på at blive forstået, ikke en accentbedømmelse.",
  "lang.phrasePlaceholder": "Sætning, der skal læses højt",
  "lang.needsMic": "Kræver en mikrofon — kun til webversionen indtil videre.",
  "lang.stopScore": "Stop & bedøm",
  "lang.record": "🎤 Optag",
  "lang.understoodPct": "{pct}% af ordene blev forstået",
  "lang.heard": "Hørt: “{text}”",
  "lang.pronCoach": "Udtaletræner",
  "lang.pronCoachHelp": "Tal frit — læreren lytter og træner dig i udtale, accent, rytme, flydende tale og intonation. Målet er at blive forstået, ikke perfektion.",
  "lang.coachContextPlaceholder": "Hvad taler I om? (valgfrit) — f.eks. præsentér dig selv",
  "lang.stopCoaching": "⏹ Stop & få træning",
  "lang.speakFreely": "🎙️ Tal frit",
  "lang.whyMatters": "Hvorfor det betyder noget",
  "lang.howImprove": "Sådan forbedrer du dig",
  "lang.coachExercises": "Øvelser",
  "lang.d.pronunciation": "udtale",
  "lang.d.accent": "accent",
  "lang.d.rhythm": "rytme",
  "lang.d.fluency": "flydende tale",
  "lang.d.intonation": "intonation",
  "langmode.beginner": "begynder",
  "langmode.intermediate": "let øvet",
  "langmode.advanced": "avanceret",
  "langmode.academic": "akademisk",
  "langmode.professional": "professionel",
  "langmode.exam_prep": "eksamensforberedelse",
  "langmode.immersion": "fordybelse",
  "strategy.socratic": "Sokratisk metode",
  "strategy.project_based": "Projektbaseret",
  "strategy.problem_solving": "Problemløsning",
  "strategy.case_study": "Casedstudy",
  "strategy.task_based": "Opgavebaseret",
  "strategy.guided_demonstration": "Guider demonstration",
  "strategy.active_learning": "Aktiv læring",
  "strategy.experiential": "Erfaringsbaseret",
  "common.backToday": "Tilbage til i dag",
  "health.title": "Systemtilstand",
  "health.unreachable": "Utilgængelig",
  "health.allOk": "Alle systemer er operative",
  "health.degraded": "Forringet",
  "health.up": "oppe",
  "health.down": "nede",
  "health.refresh": "Opdater",
  "revision.loading": "Indlæser din kø…",
  "revision.queueCleared": "Kø ryddet",
  "revision.nothingDue": "Intet til revision lige nu",
  "revision.clearedDetail": "Du har gennemgået {n} kort. Din næste revision er allerede planlagt til det tidspunkt, hvor du mest sandsynligt vil glemme det.",
  "revision.nothingDetail": "FSRS planlægger hvert kort til det tidspunkt, lige før du ville glemme det. Kom tilbage, når der er noget til revision.",
  "revision.counter": "({i} af {total} · {done} fuldført)",
  "revision.tapReveal": "Tryk for at vise",
  "revision.reveal": "Vis svar",
  "revision.again": "Igen",
  "revision.hard": "Svært",
  "revision.good": "Godt",
  "revision.easy": "Nemt",
  "lessonNew.writing": "Skriver din lektion",
  "lessonNew.detail": "Din lærer skriver hele lektionen, genererer øvelser og flashcards og lagrer det i din langtidshukommelse. Dette tager et øjeblik.",
  "scan.title": "Skan dit kursus",
  "scan.help": "Fotografer en side, en tavle eller dine håndskrevne noter. Din lærer læser den, beholder originalsproget og lagrer det i din langtidshukommelse – op til {max} sider ad gangen.",
  "scan.takePhoto": "📷 Tag et foto",
  "scan.chooseImages": "Vælg billeder",
  "scan.pagesReady": "{n} side(r) klar",
  "scan.remove": "Fjern",
  "scan.titlePlaceholder": "Titel (valgfri – ellers tages den fra siden)",
  "scan.readPages": "Læs disse sider",
  "scan.reading": "Læser dine sider… dette tager et øjeblik.",
  "scan.scanAnother": "Skan en til",
  "scan.filed": "Lagret i din hukommelse",
  "scan.filedDetail": "{n} tegn læst. Det indekseres nu – når det er klar, kan der søges i det, og din lærer kan bygge lektioner ud fra det.",
  "scan.cameraRefused": "Kameraadgang blev nægtet. Tillad kameraet, og prøv igen.",
  "progress.currentStreak": "Nuværende stime",
  "progress.longest": "Længste",
  "progress.activeDays": "Aktive dage",
  "progress.days": "dage",
  "progress.yourNumbers": "Dine tal",
  "progress.cardsReviewed": "Gennemgåede kort",
  "progress.retention": "Retention",
  "progress.noReviews": "ingen anmeldelser endnu",
  "progress.dueNow": "Forfalder lige nu",
  "progress.conceptsMastered": "Mestrede begreber",
  "progress.atRisk": "Begreber i fare",
  "progress.lessonsCompleted": "Fuldførte lektioner",
  "progress.exercisesCorrect": "Korrekt besvarede øvelser",
  "progress.milestones": "Milepæle",
  "progress.askMentor": "Spørg din mentor",
  "sub.tileDetail": "Din plan og de tilgængelige planer.",
  "sub.title": "Abonnement",
  "sub.intro": "Din nuværende plan og alt det, der tilbydes. Grænser og fordele pr. plan defineres – priser og betaling kommer snart.",
  "sub.current": "Nuværende plan",
  "sub.currentPlan": "Nuværende plan",
  "sub.choose": "Vælg",
  "sub.pricingSoon": "Priser er på vej",
  "sub.note": "Abonnementer kan frit skiftes for nu — betaling og abonnementsgrænser kommer i en senere opdatering.",
  "sub.status.active": "Aktiv",
  "sub.status.trialing": "Prøveperiode",
  "sub.status.past_due": "Forfalden",
  "sub.status.canceled": "Annulleret",
  "sub.status.incomplete": "Ufuldstændig",
  "sub.audience.individual": "Privat",
  "sub.audience.organization": "Organisation",
  "sub.cancel": "Annuller abonnement",
  "sub.willCancel": "annulleres ved periodens udløb",
  "sub.invoices": "Fakturaer",
  "sub.noInvoices": "Ingen fakturaer endnu.",
  "profile.usage": "Forbrug og kvoter",
  "usage.tileDetail": "Hvor meget af dine abonnementsgrænser du har brugt.",
  "usage.title": "Forbrug og kvoter",
  "usage.intro": "Hvad du har brugt i denne periode i forhold til dine abonnementsgrænser.",
  "usage.note": "Grænser afhænger af dit abonnement og nulstilles hver periode.",
  "usage.unlimited": "Ubegrænset",
  "usage.gb": "GB",
  "usage.min": "min",
  "usage.metric.documents": "Dokumenter",
  "usage.metric.storage": "Lagerplads",
  "usage.metric.ai_questions": "AI-spørgsmål",
  "usage.metric.voice_minutes": "Stemmeminutter",
  "profile.orgs": "Organisationer",
  "org.tileDetail": "Skoler, universiteter og teams, du er en del af.",
  "org.title": "Organisationer",
  "org.intro": "Skoler, universiteter, uddannelsescentre og virksomheder, du er en del af.",
  "org.create": "Opret en organisation",
  "org.createBtn": "Opret",
  "org.namePlaceholder": "Navn – f.eks. Lincoln High School",
  "org.type.school": "Skole",
  "org.type.university": "Universitet",
  "org.type.training_center": "Uddannelsescenter",
  "org.type.enterprise": "Virksomhed",
  "org.role.admin": "Administrator",
  "org.role.teacher": "Lærer",
  "org.role.student": "Studerende",
  "org.memberCount": "{n} medlemmer",
  "org.open": "Åben",
  "org.emptyTitle": "Ingen organisationer endnu",
  "org.emptyDetail": "Opret en ovenfor, eller bed en administrator om at tilføje dig til deres.",
  "org.members": "Medlemmer",
  "org.addMember": "Tilføj et medlem",
  "org.addMemberBtn": "Tilføj medlem",
  "org.emailPlaceholder": "Medlemmets e-mail",
  "org.groups": "Klasser og grupper",
  "org.noGroups": "Ingen klasser eller grupper endnu.",
  "org.createGroup": "Opret en klasse",
  "org.createGroupBtn": "Opret klasse",
  "org.groupNamePlaceholder": "Klassenavn – f.eks. 12. klasse – Naturvidenskab",
  "org.kind.class": "Klasse",
  "org.kind.group": "Gruppe",
  "org.back": "Tilbage til organisationer",
  "org.insights": "🌐 Klientindsigt",
  "org.insightsMembers": "{s} studerende · {t} lærere",
  "org.insightsActive": "{n} aktive i denne uge",
  "org.difficultSubjects": "Sværeste emner",
  "org.recommendations": "Anbefalinger",
  "profile.admin": "Administratordashboard",
  "admin.tileDetail": "Platform-backoffice (kun for administratorer).",
  "admin.title": "Administratordashboard",
  "admin.intro": "Platformsoversigt på tværs af alle brugere og organisationer.",
  "admin.stat.users": "Brugere",
  "admin.stat.orgs": "Organisationer",
  "admin.stat.docs": "Dokumenter",
  "admin.stat.revenue": "Omsætning",
  "admin.stat.incidents": "Åbne hændelser",
  "admin.stat.reports": "Åbne rapporter",
  "admin.aiUsage": "AI-forbrug",
  "admin.aiQuestions": "AI-spørgsmål",
  "admin.voiceMinutes": "Stemmeminutter",
  "admin.users": "Brugere",
  "admin.suspend": "Suspendér",
  "admin.reactivate": "Genaktiver",
  "admin.suspended": "suspenderet",
  "admin.incidents": "Hændelser",
  "admin.incidentPlaceholder": "Hændelsestitel",
  "admin.createIncident": "Opret hændelse",
  "admin.resolve": "Løs",
  "admin.sev.low": "Lav",
  "admin.sev.medium": "Mellem",
  "admin.sev.high": "Høj",
  "admin.sev.critical": "Kritisk",
  "admin.istatus.open": "Åben",
  "admin.istatus.investigating": "Undersøger",
  "admin.istatus.resolved": "Løst",
  "admin.reports": "Rapporter",
  "admin.noReports": "Ingen rapporter.",
  "admin.review": "Marker som gennemgået",
  "admin.rstatus.open": "Åben",
  "admin.rstatus.reviewed": "Gennemgået",
  "admin.rstatus.dismissed": "Afvist",
  "admin.logs": "Revisionslog",
  "profile.analytics": "Analytisk",
  "an.tileDetail": "Platform-business intelligence (kun for administratorer).",
  "an.title": "Analytisk",
  "an.intro": "Platformindikatorer til styring af løbende forbedringer.",
  "an.active": "Aktive brugere",
  "an.stickiness": "Klæbrighed",
  "an.retention": "7-dages fastholdelse",
  "an.newUsers": "Nye (7d)",
  "an.business": "Forretning",
  "an.revenue": "Omsætning",
  "an.conversion": "Konvertering",
  "an.paid": "Betalende brugere",
  "an.learning": "Læring & AI",
  "an.studyTime": "Studietid",
  "an.mastery": "Gennemsnitlig mestring",
  "an.lessons": "Lektioner",
  "an.aiQuestions": "AI-spørgsmål",
  "an.voiceMinutes": "Stemmeminutter",
  "an.topFeatures": "Mest brugte funktioner",
  "an.feature.tutor": "AI Teacher",
  "an.feature.lessons": "Lektioner",
  "an.feature.assessments": "Vurderinger",
  "an.feature.writing": "Skrivning",
  "an.feature.reading": "Læsning",
  "an.feature.documents": "Dokumenter",
  "an.feature.languages": "Sprog",
  "profile.privacy": "Privatliv og data",
  "priv.tileDetail": "Samtykker, dataeksport og sletning af konto.",
  "priv.title": "Privatliv og data",
  "priv.intro": "Styr dine samtykker, eksporter dine data eller slet din konto.",
  "priv.consents": "Samtykker",
  "priv.consent.analytics": "Produktanalyse",
  "priv.consent.marketing": "Marketingkommunikation",
  "priv.consent.product_emails": "E-mails med produktopdateringer",
  "priv.granted": "Givet",
  "priv.notGranted": "Ikke givet",
  "priv.grant": "Giv",
  "priv.withdraw": "Træk tilbage",
  "priv.export": "Eksporter dine data",
  "priv.exportHelp": "Download alt, hvad vi har om dig, som en JSON-fil.",
  "priv.exportBtn": "Eksporter mine data",
  "priv.exportDone": "Din dataeksport blev downloadet.",
  "priv.exportReady": "Din dataeksport er klar.",
  "priv.danger": "Faresone",
  "priv.deleteHelp": "Slet din konto og alle dine data permanent. Dette kan ikke fortrydes.",
  "priv.deleteBtn": "Slet min konto",
  "priv.passwordPlaceholder": "Bekræft med din adgangskode",
  "priv.cancel": "Annuller",
  "priv.confirmDelete": "Slet for evigt",
  "h.hero.analyzed": "Jeg har analyseret dine fremskridt og forberedt din dag.",
  "h.ctx.new": "Velkommen. Lad os bygge din første læringssti.",
  "h.ctx.active": "Jeg har forberedt dagens session.",
  "h.ctx.exam": "Din eksamen nærmer sig — jeg har tilpasset dit program.",
  "h.ctx.revision": "Et par begreber risikerer at glide væk i dag.",
  "h.ctx.success": "Du har netop konsolideret et vigtigt begreb.",
  "h.ctx.inactive": "Det er et par dage siden — lad os blidt komme i gang igen.",
  "h.hero.start": "Start min session",
  "h.hero.detail": "Se detaljer",
  "h.hero.activities": "aktiviteter",
  "h.hero.min": "min",
  "h.hero.priorityHigh": "høj prioritet",
  "h.nba.title": "Din næste handling",
  "h.nba.priority": "PRIORITET",
  "h.nba.why": "Hvorfor?",
  "h.nba.start": "Start",
  "h.nba.review": "Gennemgå",
  "h.nba.learn": "Lær",
  "h.nba.r.at_risk": "Din mestring falder — en kort gennemgang i dag vil have stor effekt.",
  "h.nba.r.ready": "Forudsætningerne er mestret — dette er det ideelle næste skridt.",
  "h.nba.r.in_progress": "Du er allerede i gang med at lære dette — lad os holde momentum.",
  "h.nba.r.review": "Kort skal gentages i dag.",
  "h.nba.none": "Intet af hast — du er ajour. En kort gennemgang hjælper stadig.",
  "h.capture.title": "Hvad vil du lære?",
  "h.capture.placeholder": "Forklar afledede funktioner… / stil et spørgsmål",
  "h.capture.write": "Skriv",
  "h.capture.speak": "Tal",
  "h.capture.drop": "Slip",
  "h.capture.scan": "Scann",
  "h.capture.import": "Importer",
  "h.proactive.badge": "TILPASSET PLAN",
  "h.today.title": "I dag",
  "h.today.none": "Intet planlagt i dag.",
  "h.today.summary": "{min} min · {n} aktiviteter",
  "h.st.done": "færdig",
  "h.st.in_progress": "i gang",
  "h.st.pending": "at gøre",
  "h.st.skipped": "udskudt",
  "h.continue.title": "Fortsæt",
  "h.continue.reached": "Du nåede til:",
  "h.continue.btn": "Fortsæt",
  "h.progress.week": "Denne uge",
  "h.progress.reviews": "Anmeldelser",
  "h.progress.streak": "dages stribe",
  "h.mastery.title": "Mestring",
  "h.mastery.none": "Ingen begreber spores endnu.",
  "h.exams.title": "Kommende eksamener",
  "h.exams.prep": "Forberedelse",
  "h.exams.none": "Ingen kommende eksamen.",
  "h.exams.hint": "Du kan tilføje en eksamen, når du har brug for det.",
  "h.exams.plan": "Se tidsplan",
  "h.exams.inDays": "om {n} dage",
  "h.exams.today": "i dag",
  "h.exams.tomorrow": "i morgen",
  "h.recs.title": "Råd fra din lærer",
  "h.recs.none": "Ingen råd lige nu.",
  "h.recs.act": "Start",
  "h.capacity.title": "Dagens kapacitet",
  "h.capacity.recommended": "{n} minutter anbefales",
  "h.streak.title": "Konsekvens",
  "h.streak.days": "dage",
  "h.block.error": "Kunne ikke indlæse denne blok.",
  "h.block.retry": "Prøv igen",
  "h.open": "Åbn",
  "error.title": "Noget gik galt",
  "error.detail": "Der opstod et problem med denne skærm. Du kan prøve igen.",
  "learn.section.modes": "Hvordan vil du arbejde?",
  "study.section.cards": "Smart Cards",
  "onboarding.preparing": "Forbereder dit rum…",
  "onboarding.gen.title": "Opretter din digitale hjerne…",
  "onboarding.gen.analyzing": "Analyserer din profil…",
  "onboarding.gen.graph": "Opbygger dit videnskort…",
  "onboarding.gen.teacher": "Tilpasser din AI-professor…",
  "onboarding.gen.forming": "Din digitale hjerne tager form…",
  "profile.manageSubscription": "Administrer mit abonnement",
  "onb.progress": "Dit rum tager form…",
  "onb.why": "Hvorfor spørger jeg om det?",
  "onb.continue": "Fortsæt",
  "onb.back": "Tilbage",
  "onb.skip": "Spring over",
  "onb.cat.kindergarten": "Børnehave",
  "onb.cat.primary": "Skole (1.-5. kl.)",
  "onb.cat.secondary": "Skole (6.-9. kl.)",
  "onb.cat.highschool": "Gymnasium / HF",
  "onb.cat.university": "Universitet",
  "onb.cat.research": "Forskning / Ph.d.",
  "onb.cat.professional": "Erhvervsuddannelse",
  "onb.cat.language": "Lære et sprog",
  "onb.cat.personal": "Personlig læring",
  "onb.age.under12": "Under 12",
  "onb.age.12to15": "12–15",
  "onb.age.16to18": "16–18",
  "onb.age.18to25": "18–25",
  "onb.age.25to40": "25–40",
  "onb.age.over40": "40 og derover",
  "onb.goal.understand": "Forstå mine fag",
  "onb.goal.exams": "Bestå mine eksaminer",
  "onb.goal.grades": "Forbedre mine karakterer",
  "onb.goal.language": "Lære et sprog",
  "onb.goal.contest": "Forberede mig til en adgangseksamen",
  "onb.goal.homework": "Lave mine lektier",
  "onb.goal.labs": "Færdiggøre mit laboratoriearbejde",
  "onb.goal.reports": "Skrive mine rapporter",
  "onb.goal.projects": "Arbejde på mine projekter",
  "onb.goal.research": "Udføre forskning",
  "onb.goal.skills": "Opbygge mine færdigheder",
  "onb.goal.curiosity": "Lære ud af nysgerrighed",
  "onb.subj.math": "Matematik",
  "onb.subj.physics": "Fysik",
  "onb.subj.chemistry": "Kemi",
  "onb.subj.biology": "Biologi",
  "onb.subj.cs": "Datalogi",
  "onb.subj.law": "Jura",
  "onb.subj.economics": "Økonomi",
  "onb.subj.history": "Historie",
  "onb.subj.geography": "Geografi",
  "onb.subj.languages": "Sprog",
  "onb.subj.medicine": "Medicin",
  "onb.subj.philosophy": "Filosofi",
  "onb.pref.visual": "Visuelle forklaringer",
  "onb.pref.examples": "Eksempler",
  "onb.pref.practice": "Praksis",
  "onb.pref.exercises": "Øvelser",
  "onb.pref.conversation": "Samtale",
  "onb.pref.reading": "Læsning",
  "onb.pref.listening": "Lytning",
  "onb.pref.repetition": "Repetition",
  "onb.pref.problems": "Problemløsning",
  "onb.tone.supportive": "Støttende",
  "onb.tone.balanced": "Balanceret",
  "onb.tone.demanding": "Krævende",
  "onb.expl.short": "Kort",
  "onb.expl.balanced": "Balanceret",
  "onb.expl.detailed": "Detaljeret",
  "onb.interv.let_me_think": "Lad mig tænke",
  "onb.interv.guide_me": "Guid mig skridt for skridt",
  "onb.interv.interactive": "Vær meget interaktiv",
  "onb.corr.immediate": "Ret med det samme",
  "onb.corr.let_me_finish": "Lad mig tale færdig",
  "onb.corr.adaptive": "Tilpas dig situationen",
  "onb.sup.guide": "Guid mig",
  "onb.sup.understand": "Hjælp mig med at forstå",
  "onb.sup.step_by_step": "Gå mig igennem skridt for skridt",
  "onb.sup.verify": "Tjek min ræsonnering",
  "onb.sup.solution": "Vis mig en forklaret løsning",
  "onb.skill.comprehension": "Forståelse",
  "onb.skill.speaking": "Tale",
  "onb.skill.pronunciation": "Udtale",
  "onb.skill.writing": "Skrivning",
  "onb.skill.grammar": "Grammatik",
  "onb.skill.vocabulary": "Ordforråd",
  "onb.rate.high": "Jeg har styr på det",
  "onb.rate.medium": "Gennemsnit",
  "onb.rate.low": "Kræver arbejde",
  "onb.welcome.title": "Velkommen til Second Brain.",
  "onb.welcome.start": "Start",
  "onb.welcome.body": "Lad os bygge dit læringsrum op omkring den måde, du lærer på.",
  "onb.welcome.teacher": "Jeg lærer dig at kende, så jeg kan indstille din AI-professor til dit niveau, dine mål og din læringsstil.",
  "onb.identity.teacher": "Lad os lære hinanden at kende – kun det vigtigste, intet andet.",
  "onb.identity.title": "Hvem er du?",
  "onb.identity.firstName": "Fornavn",
  "onb.identity.firstNamePh": "Dit fornavn",
  "onb.identity.lastName": "Efternavn (valgfrit)",
  "onb.identity.lastNamePh": "Dit efternavn",
  "onb.identity.avatar": "Avatar (valgfrit)",
  "onb.identity.age": "Aldersgruppe",
  "onb.identity.ageWhy": "Aldersgruppen bruges kun til at tilpasse tone og præsentation. Vi spørger ikke om fødselsdato, og oplevelsen for yngre elever forbliver beskyttet.",
  "onb.identity.country": "Land / region (valgfrit)",
  "onb.identity.countryPh": "f.eks. Danmark",
  "onb.category.teacher": "Dette hjælper mig med at forstå, hvor du er i din proces.",
  "onb.category.title": "Hvor er du henne?",
  "onb.category.subtitle": "Vælg det, der passer dig bedst.",
  "onb.academic.teacher": "Beskriv dine studier – vælg, søg eller skriv frit.",
  "onb.academic.title": "Dine studier",
  "onb.academic.subtitle": "Intet er påkrævet: udfyld det, der gælder for dig.",
  "onb.academic.level": "Niveau",
  "onb.academic.levelPh": "f.eks. Universitet",
  "onb.academic.system": "Land / uddannelsessystem",
  "onb.academic.systemPh": "f.eks. Danmark — videregående uddannelse",
  "onb.academic.field": "Fagområde",
  "onb.academic.fieldPh": "f.eks. Datalogi",
  "onb.academic.domain": "Domæne",
  "onb.academic.domainPh": "f.eks. Softwareingeniørvidenskab",
  "onb.academic.specialty": "Specialisering (valgfrit)",
  "onb.academic.specialtyPh": "f.eks. Distribuerede systemer",
  "onb.academic.year": "Årgang / niveau",
  "onb.academic.yearPh": "f.eks. 3. år",
  "onb.goals.teacher": "Fortæl mig, hvorfor du er her – du kan vælge flere.",
  "onb.goals.title": "Hvorfor bruger du Second Brain?",
  "onb.subjects.teacher": "Disse emner vil styrke din hukommelse, dit vidensgraf og din tidsplan.",
  "onb.subjects.title": "Dine emner",
  "onb.subjects.add": "Tilføj et emne",
  "onb.subjects.addPh": "f.eks. Astrofysik",
  "onb.subjects.addBtn": "Tilføj",
  "onb.languages.teacher": "Sprog former mine forklaringer og den støtte, jeg kan give dig.",
  "onb.languages.title": "Dine sprog",
  "onb.languages.native": "Modersmål",
  "onb.languages.interface": "Interfacesprog",
  "onb.languages.interfaceWhy": "Interfacesproget ændrer skærmbilledet og det sprog, som AI-professoren underviser dig på.",
  "onb.languages.study": "Studiet sprog (valgfrit)",
  "onb.languages.studyWhy": "Hvis du studerer på et andet sprog end dit modersmål, aktiverer jeg tosproget støtte og akademisk ordforråd.",
  "onb.mobility.title": "International mobilitet",
  "onb.mobility.subtitle": "Studerer du i øjeblikket på et andet sprog end dit modersmål?",
  "onb.mobility.yes": "Ja",
  "onb.mobility.no": "Nej",
  "onb.mobility.alertTitle": "Sprogstøtte aktiveret",
  "onb.mobility.alertDetail": "Kontekstuel oversættelse, akademisk ordforråd, tosproget forklaring og gradvis immersion.",
  "onb.ll.teacher": "Lad os bygge din sprogrejse, skræddersyet til dig.",
  "onb.ll.title": "Lær et sprog",
  "onb.ll.target": "Jeg vil lære",
  "onb.ll.currentLevel": "Nuværende niveau",
  "onb.ll.goalLevel": "Mål",
  "onb.ll.mainGoal": "Hovedmål",
  "onb.ll.mainGoalPh": "f.eks. Samtale",
  "onb.ll.skills": "Hvad vil du arbejde på?",
  "onb.prefs.teacher": "Præferencer, ikke en diagnose. Du kan ændre dem når som helst.",
  "onb.prefs.title": "Hvordan foretrækker du at lære?",
  "onb.teacher.teacher": "Sæt mig op. Jeg tilpasser mig derefter baseret på dine resultater.",
  "onb.teacher.title": "Din AI-professor",
  "onb.teacher.tone": "Tone",
  "onb.teacher.explanations": "Forklaringer",
  "onb.teacher.intervention": "Intervention",
  "onb.teacher.correction": "Rettelse",
  "onb.support.teacher": "Laboratoriearbejde, lektier, rapporter, projekter, afhandlinger — hvordan vil du have, jeg skal hjælpe?",
  "onb.support.title": "Akademisk hjælp",
  "onb.assess.teacher": "Lad os hurtigt se på, hvad du allerede ved — et par spørgsmål, ikke en eksamen.",
  "onb.assess.title": "Hurtig tjek-in",
  "onb.assess.save": "Gem",
  "onb.assess.noSubjectTitle": "Ingen emne valgt",
  "onb.assess.noSubjectDetail": "Tilføj et emne i det foregående trin for at køre en tjek-in, eller spring dette trin over.",
  "onb.assess.whichSubject": "Hvilket emne?",
  "onb.assess.preparing": "Forbereder…",
  "onb.assess.run": "Start tjek-in",
  "onb.assess.unavailableTitle": "Tjek-in utilgængelig",
  "onb.assess.unavailableDetail": "Du kan selvvurdere dit niveau nedenfor.",
  "onb.assess.selfRate": "Selvvurder dit niveau i",
  "onb.assess.answerPh": "Dit svar (valgfrit)",
  "onb.twin.title": "Her er hvad jeg har forstået om dig",
  "onb.twin.subtitle": "Du kan med det samme rette det, som Second Brain har forstået.",
  "onb.twin.confirm": "Det er korrekt",
  "onb.twin.profile": "Profil",
  "onb.twin.langs": "Sprog",
  "onb.twin.goals": "Mål",
  "onb.twin.subjects": "Emner",
  "onb.twin.prof": "Professor",
  "onb.twin.target": "Mål",
  "onb.twin.native": "modersmål",
  "onb.twin.study": "studere",
  "onb.twin.hi": "Hej",
  "onb.twin.almost": "vi er der snart.",
  "onb.twin.toAdapt": "For at tilpasse",
  "onb.adapt.title": "Sådan vil din AI-professor fungere",
  "onb.adapt.enter": "Gå ind i Second Brain",
  "onb.adapt.preparing": "Forbereder…",
  "onb.adapt.willBody": "Jeg vil:",
  "onb.adapt.p1": "tilpasse mine forklaringer til dit niveau",
  "onb.adapt.p2": "opdage dine svagheder",
  "onb.adapt.p3": "få dig til at øve dig",
  "onb.adapt.p4": "planlægge dine gentagelser",
  "onb.adapt.p5": "bruge dine dokumenter",
  "onb.adapt.p6": "hjælpe dig med dine opgaver",
  "onb.edit": "Rediger",
  "error.serverBusy": "Tjenesten er travl lige nu. Prøv igen om lidt.",
  "error.network": "Forbindelsesproblem. Tjek dit netværk, og prøv igen.",
  "onb.cfg.title": "Konfiguration anvendt",
  "onb.cfg.profileUpdated": "Profil opdateret",
  "onb.cfg.langCreated": "Sprogprofil oprettet",
  "onb.cfg.concepts": "første koncepter",
  "auth.brandTitle": "Din AI-forstærkede hjerne",
  "auth.brandSubtitle": "Lær. Forstå. Husk. Din AI-professor vokser med dig.",
  "auth.badgeLangs": "34 sprog",
  "auth.badgeModels": "Multimodel-AI",
  "auth.badgeGraph": "Vidensgraf",
  "auth.sceneQuestion": "Forklar dette koncept simpelt for mig.",
  "auth.sceneAnswer": "Fint nok — her er det, trin for trin, på dit niveau.",
  "auth.sceneConcept": "Koncept",
  "auth.sceneRelation": "Relation",
  "auth.sceneMastery": "Mestring",
  "auth.welcomeBack": "Velkommen tilbage",
  "auth.signUpSubtitle": "Et par sekunder til at bygge dit læringsrum.",
  "auth.signInSubtitle": "Fortsæt præcis hvor du slap.",
  "auth.showPassword": "Vis adgangskode",
  "auth.hidePassword": "Skjul adgangskode",
  "auth.themeToggle": "Skift tema",
  "auth.strengthLabel": "Adgangskodens styrke",
  "auth.strengthWeak": "Svag",
  "auth.strengthMedium": "Mellem",
  "auth.strengthStrong": "Stærk",
  "auth.emailFieldHint": "f.eks. du@eksempel.dk",
  "auth.retry": "Prøv igen",
  "nav.expand": "Udvid menu",
  "nav.collapse": "Skjul menu",
  "profile.kyc.title": "Min profil",
  "profile.kyc.complete": "Fuldført",
  "profile.kyc.incomplete": "Skal fuldføres",
  "profile.kyc.detail": "Oplysningerne, der skræddersyr din AI-professor og digitale tvilling.",
  "profile.kyc.verify": "Gennemse min profil",
  "profile.kyc.name": "Navn",
  "profile.kyc.path": "Sti",
  "profile.kyc.languagesRow": "Sprog",
  "profile.kyc.goalsRow": "Mål",
  "profile.kyc.goalsN": "mål",
  "profile.footer": "Dine ændringer opdaterer øjeblikkeligt din AI-professor og digitale tvilling i hele appen.",
  "lib.learnWithTeacher": "Lær med læreren",
  "sub.popular": "Populær",
  "sub.perMonth": "/md",
  "sub.free": "Gratis",
  "landing.brand": "Second Brain",
  "landing.signature": "Aktivér din digitale tvilling",
  "landing.nav.features": "Funktioner",
  "landing.nav.how": "Sådan fungerer det",
  "landing.nav.professor": "AI-professor",
  "landing.nav.academic": "Akademisk arbejdsområde",
  "landing.nav.languages": "Sprog",
  "landing.nav.faq": "FAQ",
  "landing.cta.signin": "Log ind",
  "landing.cta.start": "Start gratis",
  "landing.cta.startShort": "Start",
  "landing.cta.discover": "Se hvordan det fungerer",
  "landing.hero.title": "Din digitale læringstvilling",
  "landing.hero.subtitle": "En AI-professor, der forstår din rejse, husker det, du lærer, og underviser dig – skræddersyet.",
  "landing.hero.promise1": "Lær",
  "landing.hero.promise2": "Forstå",
  "landing.hero.promise3": "Husk",
  "landing.hero.promise4": "Fremskridt",
  "landing.hero.reassure1": "Adaptiv AI-professor",
  "landing.hero.reassure2": "Vedholdende hukommelse",
  "landing.hero.reassure3": "34 sprog",
  "landing.hero.reassure4": "Smarte dokumenter",
  "landing.mock.os": "SECOND BRAIN OS",
  "landing.mock.brain": "Min hjerne",
  "landing.mock.professor": "AI-professor",
  "landing.mock.msg": "“Forklar dette koncept for mig…”",
  "landing.mock.memory": "Hukommelse",
  "landing.mock.progress": "Fremskridt",
  "landing.mock.mastery": "Mestring",
  "landing.signals.multipdf": "Multi-PDF",
  "landing.signals.fsrs": "FSRS",
  "landing.flow.documents": "Dokumenter",
  "landing.flow.intelligence": "Intelligens",
  "landing.flow.graph": "Vidensgraf",
  "landing.flow.professor": "AI-professor",
  "landing.flow.twin": "Digital tvilling",
  "landing.flow.revision": "Gennemgang og fremskridt",
  "landing.compare.title": "Hvad der ændrer sig",
  "landing.compare.message": "Second Brain gemmer ikke bare på din viden. Den lærer, hvordan du lærer.",
  "landing.compare.classicTitle": "En klassisk app",
  "landing.compare.sbTitle": "Second Brain OS",
  "landing.compare.classic1": "Isolerede dokumenter",
  "landing.compare.classic2": "Statiske noter",
  "landing.compare.classic3": "Grundlæggende søgning",
  "landing.compare.classic4": "Resuméer",
  "landing.compare.classic5": "Spredt historik",
  "landing.compare.sb1": "Personlig hukommelse",
  "landing.compare.sb2": "AI-professor",
  "landing.compare.sb3": "Vidensgraf",
  "landing.compare.sb4": "Adaptiv læring",
  "landing.compare.sb5": "Smart gennemgang",
  "landing.compare.sb6": "Løbende fremskridt",
  "landing.compare.classicFlow": "Gem → Søg → Læs",
  "landing.compare.sbFlow": "Indfang → Forstå → Undervis → Husk → Fremskridt",
  "landing.how.title": "Sådan fungerer det",
  "landing.how.s1.title": "Indfang",
  "landing.how.s1.desc": "PDF'er, fotos, scanninger, noter og alt læringsindhold.",
  "landing.how.s2.title": "Forstå",
  "landing.how.s2.desc": "Systemet strukturerer informationen og identificerer begreberne.",
  "landing.how.s3.title": "Undervis",
  "landing.how.s3.desc": "AI-professoren forvandler viden til en læringsoplevelse.",
  "landing.how.s4.title": "Husk",
  "landing.how.s4.desc": "Din digitale tvilling og gennemgangssystemet sporer det, du optager.",
  "landing.how.s5.title": "Fremskridt",
  "landing.how.s5.desc": "FSRS, vurderinger og anbefalinger konsoliderer din viden.",
  "landing.exp.title": "Én enhed indhold → en læringsoplevelse",
  "landing.exp.lead": "Intet bliver nogensinde bare importeret og glemt. Hvert dokument bliver til noget, du kan lære, øve og huske.",
  "landing.exp.s1": "PDF",
  "landing.exp.s2": "Analysér",
  "landing.exp.s3": "Forstå",
  "landing.exp.s4": "Lær med professoren",
  "landing.exp.s5": "Spørgsmål",
  "landing.exp.s6": "Øvelser",
  "landing.exp.s7": "Gennemgang",
  "landing.exp.s8": "Hukommelse",
  "landing.exp.actionLearn": "Lær med professoren",
  "landing.exp.actionSolve": "Løs den med mig",
  "landing.showcase.title": "Ét produkt, én oplevelse",
  "landing.showcase.brain.tab": "🧠 Min Hjerne",
  "landing.showcase.brain.title": "Min Hjerne",
  "landing.showcase.brain.desc": "Din visuelle digitale tvilling: Vidensgraf, lærings-DNA, styrker og svagheder i ét levende kort.",
  "landing.showcase.professor.tab": "👨‍🏫 AI-professor",
  "landing.showcase.professor.title": "AI-professor",
  "landing.showcase.professor.desc": "Skriftlig samtale, undervisning og pædagogik, der tilpasser sig dit nøjagtige niveau og dine mål.",
  "landing.showcase.search.tab": "🔎 Fri søgning",
  "landing.showcase.search.title": "Frie AI-søgning",
  "landing.showcase.search.desc": "Spørg om hvad som helst – et spontant, teknisk, akademisk eller generelt vidensspørgsmål – direkte i Lærings-oplevelsen.",
  "landing.showcase.documents.tab": "📚 Massive dokumenter",
  "landing.showcase.documents.title": "Massive dokumenter",
  "landing.showcase.documents.desc": "PDF'er, billeder, scanninger og hele emner samlet ét sted – arbejd med et helt kursus, ikke bare én enkelt fil.",
  "landing.showcase.voice.tab": "🎙️ Tale og mundtligt",
  "landing.showcase.voice.title": "Tale og mundtligt",
  "landing.showcase.voice.desc": "Mundtlig samtale, mundtlige øvelser og mundtlige eksamener til at øve dig højt.",
  "landing.showcase.academic.tab": "🎓 Akademisk arbejdsområde",
  "landing.showcase.academic.title": "Akademisk arbejdsområde",
  "landing.showcase.academic.desc": "Laboratorieøvelser, lektier, rapporter, projekter, specialer, opgaver og eksamensemner – guidet, trin for trin.",
  "landing.showcase.revise.tab": "📅 Repetition",
  "landing.showcase.revise.title": "Repetition",
  "landing.showcase.revise.desc": "FSRS, flashcards, quizser og progression, der fastfryser det, du lærer.",
  "landing.professor.title": "En professor der lærer, hvem du er",
  "landing.professor.lead": "Ikke en generisk chatbot – en lærer, der tilpasser sig dit niveau, dine mål og den måde, du lærer på.",
  "landing.professor.a1": "Niveau",
  "landing.professor.a2": "Mål",
  "landing.professor.a3": "Udfordringer",
  "landing.professor.a4": "Læringshistorik",
  "landing.professor.a5": "Sprog",
  "landing.professor.a6": "Pensum",
  "landing.professor.a7": "Tempo",
  "landing.professor.a8": "Fremskridt",
  "landing.professor.modesTitle": "Undervisningstilstande",
  "landing.professor.m1": "Undervis",
  "landing.professor.m2": "Forklar",
  "landing.professor.m3": "Diskuter",
  "landing.professor.m4": "Guidet session",
  "landing.professor.m5": "Mundtlig øvelse",
  "landing.professor.m6": "Mundtlig eksamen",
  "landing.professor.flow": "Forstå → øv dig → bliv testet → ret → husk",
  "landing.academic.title": "Akademisk arbejdsområde",
  "landing.academic.badge": "En funktion i Lærings-rummet",
  "landing.academic.lead": "Målet er ikke blot at give dig svaret – det er at lære dig metoden.",
  "landing.academic.w1": "Laboratorie",
  "landing.academic.w2": "Lektier",
  "landing.academic.w3": "Rapport",
  "landing.academic.w4": "Projekt",
  "landing.academic.w5": "Speciale",
  "landing.academic.w6": "Opgave",
  "landing.academic.w7": "Casedstudy",
  "landing.academic.w8": "Øvelse",
  "landing.academic.w9": "Eksamensemne",
  "landing.academic.mode1.title": "Pædagogisk vejledning",
  "landing.academic.mode1.desc": "AI'en guider dig trin for trin.",
  "landing.academic.mode2.title": "Assisteret problemløsning",
  "landing.academic.mode2.desc": "I arbejder jer igennem det sammen med AI'en.",
  "landing.academic.mode3.title": "Fuldstændig forklaret løsning",
  "landing.academic.mode3.desc": "Løsningen forklares pædagogisk, ikke bare udleveret.",
  "landing.languages.title": "Sprog & Fordybelse",
  "landing.languages.lead": "Lær et sprog, og forstå sproget i dit eget pensum.",
  "landing.languages.l1": "Fordybelse",
  "landing.languages.l2": "Samtale",
  "landing.languages.l3": "Mundtlig",
  "landing.languages.l4": "Shadowing",
  "landing.languages.l5": "Fremgang",
  "landing.languages.l6": "Ordforråd",
  "landing.languages.l7": "Grammatik",
  "landing.languages.mobilityTitle": "Akademisk mobilitet",
  "landing.languages.mob1": "Fransktalende studerende",
  "landing.languages.mob2": "Engelsktalende universitet",
  "landing.languages.mob3": "Kontekstuel oversættelse",
  "landing.languages.mob4": "Akademisk ordforråd",
  "landing.languages.mob5": "Progressiv fordybelse",
  "landing.kyc.title": "Systemet tilpasser sig den, der lærer",
  "landing.kyc.lead": "Ikke en administrativ formular – en tilpasningsmotor. Den finjusterer niveau, ordforråd, tone, pædagogik og sværhedsgrad til dig.",
  "landing.kyc.p1.title": "Primær",
  "landing.kyc.p1.desc": "En visuel, alderssvarende undervisningsmetode.",
  "landing.kyc.p2.title": "Gymnasium / Universitet",
  "landing.kyc.p2.desc": "En struktureret metode, eksamener og konsolidering.",
  "landing.kyc.p3.title": "Specialiseret felt",
  "landing.kyc.p3.desc": "Medicin, jura, datalogi, ingeniørvidenskab, arkitektur…",
  "landing.kyc.p4.title": "Forsker",
  "landing.kyc.p4.desc": "Videnskabelig stringens og dybere udforskning.",
  "landing.kyc.p5.title": "Sprogstuderende",
  "landing.kyc.p5.desc": "Fordybelse og sproglig progression.",
  "landing.twin.title": "Din læring bliver til en levende hukommelse",
  "landing.twin.lead": "Jo mere du lærer med Second Brain, jo mere personligt bliver dit system.",
  "landing.twin.i1": "Det, du lærer",
  "landing.twin.i2": "Det, du forstår",
  "landing.twin.i3": "Det, du glemmer",
  "landing.twin.i4": "Det, du mestrer",
  "landing.twin.i5": "Dine mål",
  "landing.twin.result": "Digital Twin",
  "landing.graph.title": "Vidensgraf",
  "landing.graph.lead": "Det levende kort over sammenhængen mellem alt det, du lærer.",
  "landing.revision.title": "Smart repetition",
  "landing.revision.message": "Repeter ikke mere. Repeter på det rigtige tidspunkt.",
  "landing.revision.lead": "FSRS er et hukommelseslag for hele dit system – ikke bare en bunke flashcards.",
  "landing.revision.c1": "FSRS",
  "landing.revision.c2": "Repetition med mellemrum",
  "landing.revision.c3": "Flashcards",
  "landing.revision.c4": "Quizzer",
  "landing.revision.c5": "Vurderinger",
  "landing.revision.c6": "Progression",
  "landing.one.title": "Én samlet oplevelse",
  "landing.one.s1": "Fang",
  "landing.one.s2": "Forstå",
  "landing.one.s3": "Undervis",
  "landing.one.s4": "Øv",
  "landing.one.s5": "Husk",
  "landing.one.s6": "Repeter",
  "landing.one.s7": "Fremskridt",
  "landing.faq.title": "Ofte stillede spørgsmål",
  "landing.faq.q1": "Er Second Brain bare en chatbot?",
  "landing.faq.a1": "Nej. Det er et personligt læringsmiljø: det forstår dit indhold, underviser i det og husker dine fremskridt over tid.",
  "landing.faq.q2": "Kan jeg arbejde med flere PDF'er og dokumenter?",
  "landing.faq.a2": "Ja. Du kan gruppe PDF'er, billeder, scanninger og noter til et samlet emne og lære ud fra det fulde sæt, ikke bare en enkelt fil.",
  "landing.faq.q3": "Hvad kan jeg gøre med AI-professoren?",
  "landing.faq.a3": "Bliv undervist, bed om forklaringer, diskuter, kør guidede sessioner og øv dig med opgaver — tilpasset dit niveau.",
  "landing.faq.q4": "Kan jeg tale højt med AI-professoren?",
  "landing.faq.a4": "Ja. Mundtlige samtaler, mundtlige øvelser og mundtlige eksamener giver dig mulighed for at øve dig højt.",
  "landing.faq.q5": "Hvad er den digitale tvilling?",
  "landing.faq.a5": "En personlig hukommelse om din læring — hvad du forstår, mestrer, glemmer og stiler efter.",
  "landing.faq.q6": "Hvordan fungerer hukommelse og repetition?",
  "landing.faq.a6": "En spaced-repetition-motor (FSRS) planlægger repetitioner på det rette tidspunkt, så du husker mere med mindre indsats.",
  "landing.faq.q7": "Kan jeg bruge Second Brain til mit akademiske arbejde?",
  "landing.faq.a7": "Ja. Det akademiske arbejdsområde guider laboratoriearbejde, lektier, rapporter og mere — og lærer dig metoden, ikke bare svaret.",
  "landing.faq.q8": "Hvordan fungerer sprogindlæring?",
  "landing.faq.a8": "Fordybelse, samtale, mundtlig praksis og shadowing — samt hjælp til at forstå sproget i dit eget pensum.",
  "landing.faq.q9": "Hvordan beskyttes mine data?",
  "landing.faq.a9": "Dine læringsdata driver din oplevelse. Du styrer din konto og kan administrere dine data fra din profil.",
  "landing.pricing.title": "Vælg dit læringsniveau",
  "landing.pricing.subtitle": "Udforsk → Lær seriøst → Gå all-in",
  "landing.pricing.billing.monthly": "Månedlig",
  "landing.pricing.billing.annual": "Årlig",
  "landing.pricing.billing.saving": "Spar",
  "landing.pricing.free.name": "Gratis",
  "landing.pricing.free.description": "Til at udforske Second Brain-økosystemet.",
  "landing.pricing.free.cta": "Start gratis",
  "landing.pricing.pro.name": "Pro",
  "landing.pricing.pro.description": "Til seriøs hverdagslæring.",
  "landing.pricing.pro.badge": "Anbefalet",
  "landing.pricing.pro.cta": "Bliv Pro",
  "landing.pricing.max.name": "Max",
  "landing.pricing.max.description": "Til forskere, intensive studerende og professionelle.",
  "landing.pricing.max.cta": "Lås op for Max",
  "landing.final.title": "Din læring fortjener mere end et bibliotek",
  "landing.final.subtitle": "Aktivér din digitale tvilling.",
  "landing.footer.tagline": "Dit personlige AI-forstærkede læringsmiljø.",
  "landing.footer.product": "Produkt",
  "landing.footer.product1": "Funktioner",
  "landing.footer.product2": "AI Professor",
  "landing.footer.product3": "Bibliotek",
  "landing.footer.product4": "Min Hjerne",
  "landing.footer.product5": "Repetition",
  "landing.footer.learn": "Lær",
  "landing.footer.learn1": "Sprog",
  "landing.footer.learn2": "Akademisk arbejdsområde",
  "landing.footer.learn3": "Samtale",
  "landing.footer.learn4": "Dokumenter",
  "landing.footer.resources": "Ressourcer",
  "landing.footer.resources1": "FAQ",
  "landing.footer.resources2": "Hjælp",
  "landing.footer.resources3": "Dokumentation",
  "landing.footer.company": "Virksomhed",
  "landing.footer.company1": "Om os",
  "landing.footer.company2": "Kontakt",
  "landing.footer.legal": "Juridisk",
  "landing.footer.legal1": "Privatliv",
  "landing.footer.legal2": "Vilkår",
  "landing.footer.legal3": "Sikkerhed",
  "landing.footer.copy": "© 2026 Second Brain — Dit personlige AI-læringsmiljø."
  ,"languageSelector.recent": "Seneste"
  ,"languageSelector.nativeLabel": "Modersmål"
  ,"voice11.state.ready": "Klar"
  ,"voice11.state.listening": "Lytter"
  ,"voice11.state.transcription": "Transkriberer"
  ,"voice11.state.thinking": "Professoren tænker"
  ,"voice11.state.response": "Svaret er klart"
  ,"voice11.state.paused": "Opptaket er satt på pause"
  ,"voice11.state.error": "Talefeil"
  ,"voice11.transcribe": "Stop og transkriber"
  ,"voice11.pause": "Sett på pause"
  ,"voice11.resume": "Fortsæt"
  ,"voice11.transcript.edit": "Transkripsjonen er klar – se gennem eller rediger den før du sender."
  ,"state.processing": "Behandler…"
  ,"state.partial": "Nogen resultater er fortsatt utilgængelige"
  ,"state.success": "Fullført"
  ,"state.stale": "Viser tidligere innlastede data"
  ,"state.offline": "Du er frakoblet"
  ,"state.quota-limited": "Bruksgrensen er nået"
  ,"learning.notTracked": "Ikke sporet"
  ,"profile.kyc.goalsImpact": "Disse målene veileder Repetisjon, AI-professoren og den digitale tvillingen din."
  ,"profile.kyc.languagesEmpty": "Ingen ennå."
  ,"learn.component.dropTitle": "Slipp dokumentet ditt her"
  ,"learn.component.dropDetail": "PDF, bilde, skann, bok, notatbok…"
  ,"learn.component.documentQuestion": "Hvad er dette dokumentet?"
  ,"learn.component.yourTurn": "Din tur."
  ,"ai.professor": "AI-professor"
  ,"ai.recommendation": "AI-anbefaling"
  ,"ai.insight": "AI-innsikt"
  ,"ai.explanation": "Forklaring"
  ,"ai.warning": "Vanskelighet oppdaget"
  ,"ai.progress": "Fremgang"
  ,"ai.posture.supportive": "Støttende"
  ,"ai.posture.challenging": "Utfordrende"
  ,"ai.posture.examiner": "Sensor"
  ,"review.due": "forfalt"
  ,"profile.card.photo": "Profilbilde"
  ,"profile.card.editPhoto": "Rediger profilbilde"
  ,"profile.card.takePhoto": "Ta et bilde"
  ,"profile.card.gallery": "Vælg fra galleriet"
  ,"profile.card.avatar": "Eller vælg en avatar"
  ,"profile.card.removePhoto": "Fjern bildet"
  ,"profile.card.identity": "Identitet og læringsreise"
  ,"profile.card.name": "Navn"
  ,"profile.card.namePh": "Navnet ditt"
  ,"profile.card.category": "Elevkategori"
  ,"profile.card.curriculum": "Studium / fagområde"
  ,"profile.card.level": "Nivå"
  ,"profile.card.institution": "Institusjon"
  ,"profile.card.nativeLanguage": "Modersmål"
  ,"profile.card.studyLanguage": "Undervisningsspråk"
  ,"profile.card.mobility": "Internasjonal mobilitet"
  ,"profile.card.mobilityOn": "Du studerer på et annet sprog enn morsmålet ditt: automatisk språkstøtte og kontekstuell fordypning er aktivert."
  ,"profile.card.mobilityOff": "Aktiver dette hvis du studerer på et annet sprog enn morsmålet ditt."
  ,"profile.card.languageSupport": "🌍 Språkstøtte aktivert"
  ,"profile.card.aiTeacher": "AI-professor"
  ,"profile.card.posture": "Tilnærming"
  ,"profile.card.toneSupportive": "🟢 Støttende"
  ,"profile.card.toneBalanced": "🟡 Utfordrende"
  ,"profile.card.toneDemanding": "🔴 Streng / sensor"
  ,"profile.card.explanations": "Forklaringer"
  ,"profile.card.explShort": "Korte"
  ,"profile.card.explBalanced": "Balanserte"
  ,"profile.card.explDetailed": "Detaljerte"
  ,"profile.card.cognitive": "Kognitiv profil (digital tvilling)"
  ,"profile.card.strengths": "Styrkene dine"
  ,"profile.card.strengthsEmpty": "De vises etter hvert som du lærer."
  ,"profile.card.targetRetention": "Mål for hukommelse"
  ,"profile.card.target90": "Mål: 90 %"
  ,"profile.card.retentionCurrent": "nåværende · mål: 90 %"
  ,"profile.card.dailyPace": "Daglig tempo"
  ,"profile.card.minDay": "min / dag"
  ,"profile.card.systemData": "System og data"
  ,"profile.card.theme": "Tema"
  ,"profile.card.light": "☀︎ Lyst"
  ,"profile.card.dark": "☾ Mørkt"
  ,"profile.card.system": "⚙︎ System"
  ,"profile.card.statistics": "Statistikk"
  ,"profile.card.concepts": "begreper"
  ,"profile.card.reviews": "repetisjoner"
  ,"profile.card.privacyMemory": "Personvern og minne"
  ,"profile.card.privacyData": "🔒 Personvern og data"
  ,"profile.card.vectorMemory": "🧠 Administrer vektorminne"
  ,"profile.card.cat.child": "Barn"
  ,"profile.card.cat.student": "Student"
  ,"profile.card.cat.researcher": "Forsker"
  ,"profile.card.cat.adult": "Voksen"
  ,"profile.card.cat.language": "Språkelev"
  ,"brain.panel.overview": "Oversikt"
  ,"brain.panel.mastered": "mestret"
  ,"brain.panel.fragile": "sårbart"
  ,"brain.panel.average": "gjennomsnittlig mestring"
  ,"brain.panel.cognitive": "Kognitiv profil"
  ,"brain.panel.cognitiveEmpty": "Det findes ikke nok data til å kartlegge profilen din ennå."
  ,"brain.panel.indicators": "Interne mestringsindikatorer, ikke skolekarakterer."
  ,"brain.panel.maturity": "modenhet"
  ,"brain.panel.dnaEmpty": "Lærings-DNA-et ditt tar form etter hvert som du fullfører økter."
  ,"brain.panel.dnaNote": "Observasjoner i udvikling, ikke en diagnose."
  ,"brain.panel.studied": "studert"
  ,"brain.panel.toReview": "til repetisjon"
  ,"brain.panel.memoryNote": "Second Brain følger automatisk med på hvordan viden din endrer seg."
  ,"brain.panel.attention": "Dette trenger oppmerksomheten din"
  ,"brain.panel.reviewNow": "Repeter nå"
  ,"brain8.intro": "En levende oversikt over hvad du kan, hvordan du lærer, hvad som blir sårbart, og hvad du bør gjøre videre."
  ,"brain8.nav.overview": "Oversikt"
  ,"brain8.nav.knowledge": "Viden"
  ,"brain8.nav.learning": "Slik lærer jeg"
  ,"brain8.nav.memory": "Minne"
  ,"brain8.nav.history": "Historikk"
  ,"brain8.map.title": "Det levende kunnskapskartet ditt"
  ,"brain8.maturity.sparse": "Tar form"
  ,"brain8.maturity.medium": "Sammenkoblet"
  ,"brain8.maturity.dense": "Klart til utforsking"
  ,"brain8.maturity.sparse.detail": "Second Brain begynner med de første faktiske kildene og aktivitetene dine."
  ,"brain8.maturity.medium.detail": "Begrepene, øvingen og kildene dine avdekker nå nyttige mønstre."
  ,"brain8.maturity.dense.detail": "Kartet ditt har nok grunnlag for målrettet utforsking og filtrering."
  ,"brain8.metrics.concepts": "begreper"
  ,"brain8.metrics.connections": "forbindelser"
  ,"brain8.metrics.events": "læringshendelser"
  ,"brain8.sparse.title": "Hjernen din tar form"
  ,"brain8.sparse.detail": "Lær, importer en kilde eller sett deg et mål. Hver faktisk interaksjon beriker denne oversikten."
  ,"brain8.action.learn": "Begynn å lære"
  ,"brain8.action.import": "Importer en kilde"
  ,"brain8.action.goal": "Sett et mål"
  ,"brain8.recent.documents": "Seneste kilder"
  ,"brain8.recent.knowledge": "Nylig aktiv viden"
  ,"brain8.openKnowledge": "Utforsk"
  ,"brain8.knowledge.empty": "Ingen samsvarende begreper er tilgængelige ennå."
  ,"brain8.knowledge.list": "Tilgængelig liste"
  ,"brain8.knowledge.graph": "Visuelt kart"
  ,"brain8.graph.bounded": "{shown} av {total} begreper er indlæst inn. Brug søg eller indlæs inn flere for å avgrense kartet."
  ,"brain8.loadMore": "Indlæs inn flere"
  ,"brain8.mastery.unknown": "Ikke målt"
  ,"brain8.mastery.unknown.detail": "Mestring måles ikke før det findes nok grunnlag fra repetisjoner."
  ,"brain8.mastery.value": "Beregnet mestring: {value} %"
  ,"brain8.strength.title": "Styrker og skrøbelig viden"
  ,"brain8.strength.note": "Disse indikatorene kommer fra repetert viden, ikke skolekarakterer."
  ,"brain8.nba.badge": "Neste beste handling"
  ,"brain8.nba.learn.title": "Forstå {concept}"
  ,"brain8.nba.learn.reason": "Dette begrepet er klart eller allerede under arbeid i kunnskapsløpet ditt."
  ,"brain8.nba.learn.action": "Spør professoren"
  ,"brain8.nba.review.title": "Styrk {concept}"
  ,"brain8.nba.review.reason": "Eksisterende repetisjons- og minnesignaler viser at dette begrepet trenger oppmerksomhet."
  ,"brain8.nba.review.action": "Repeter nå"
  ,"brain8.nba.why": "Hvorfor dette?"
  ,"brain8.nba.hideWhy": "Skjul forklaringen"
  ,"brain8.nba.due": "{count} tilknyttede repetisjon(er) har forfalt."
  ,"brain8.memory.title": "Læringsminne"
  ,"brain8.memory.reviews": "fullførte repetisjoner"
  ,"brain8.memory.due": "forfalte repetisjoner"
  ,"brain8.memory.sources": "lærte kilder"
  ,"brain8.memory.note": "Bare lagrede leksjoner, kilder og repetisjoner telles her."
  ,"brain8.memory.open": "Åpne minnet"
  ,"brain8.memory.fragile": "Viden som må styrkes"
  ,"brain8.memory.review": "Åpne Repetisjon"
  ,"brain8.declared.title": "Det jeg har fortalt Second Brain"
  ,"brain8.declared.detail": "De uttrykkelige lærings- og professorinnstillingene dine."
  ,"brain8.declared.empty": "Ingen angitt indstilling ennå. Du kan fylle den ut i profilen din."
  ,"brain8.observed.title": "Det Second Brain observerer"
  ,"brain8.observed.detail": "Mønstre utledet fra virkelige interaksjoner, bare vist når det findes nok grunnlag."
  ,"brain8.observed.empty": "Det findes ikke nok aktivitet til å identifisere et pålitelig mønster ennå."
  ,"brain8.observed.evidence": "Basert på {count} registrerte interaksjon(er)."
  ,"brain8.observed.style.voice": "Bruger ofte tale"
  ,"brain8.observed.style.handsOn": "Lærer gennem øving"
  ,"brain8.observed.style.reading": "Lærer gennem lesing"
  ,"brain8.observed.depth.simple": "Foretrekker korte forklaringer"
  ,"brain8.observed.depth.balanced": "Bruger balanserte forklaringer"
  ,"brain8.observed.depth.deep": "Arbeider med detaljerte forklaringer"
  ,"brain8.observed.rhythm.occasional": "Sporadisk rytme"
  ,"brain8.observed.rhythm.regular": "Regelmessig rytme"
  ,"brain8.observed.rhythm.intensive": "Intensiv rytme"
  ,"brain8.observed.focus.morning": "Mer aktiv om morgenen"
  ,"brain8.observed.focus.afternoon": "Mer aktiv om ettermiddagen"
  ,"brain8.observed.focus.evening": "Mer aktiv om kvelden"
  ,"brain8.observed.focus.night": "Mer aktiv om natten"
  ,"brain8.dna.title": "Lærings-DNA"
  ,"brain8.dna.note": "Observasjoner i udvikling, ikke en diagnose eller fast identitet."
  ,"brain8.dna.empty": "Lærings-DNA vises når gjentatte interaksjoner gir nok grunnlag."
  ,"brain8.history.title": "Kognitiv historikk"
  ,"brain8.history.empty": "Ingen læringshendelse er registrert ennå."
  ,"brain8.history.kind.lesson": "Leksjon"
  ,"brain8.history.kind.success": "Riktig svar"
  ,"brain8.history.kind.error": "Rettet fejl"
  ,"brain8.history.kind.revision": "Repetisjon"
  ,"brain8.history.kind.conversation": "Samtale med professoren"
  ,"brain8.history.kind.homework": "Lekser"
  ,"brain8.history.kind.report": "Fullført økt"
  ,"brain8.history.kind.document": "Kilde lagt til"
  ,"brain8.history.kind.concept": "Begrep lagt til"
  ,"brain8.history.kind.connection": "Forbindelse opprettet"
  ,"brain8.foresight.title": "Innsikt i læringsløpet"
  ,"brain8.foresight.forecast": "Prognose"
  ,"brain8.foresight.note": "Dette er et anslag basert på gjeldende signaler, ikke et faktum."
  ,"brain8.foresight.action": "Se foreslått handling"
  ,"brain8.foresight.kind.dropout": "Risiko for avbrudd"
  ,"brain8.foresight.kind.difficulty": "Risiko for vanskeligheter"
  ,"brain8.foresight.kind.overload": "Risiko for overbelastning"
  ,"brain8.foresight.kind.motivation": "Risiko for motivasjonstap"
  ,"brain8.foresight.kind.forgetting": "Risiko for å glemme"
  ,"brain8.foresight.reason.dropout": "De siste kontinuitetssignalene dine viser et mulig avbrudd i den nåværende rytmen."
  ,"brain8.foresight.reason.difficulty": "Det nåværende mestringsløpet ditt viser en mulig vanskelighet fremover."
  ,"brain8.foresight.reason.overload": "De nåværende arbeidssignalene dine viser en mulig overbelastning."
  ,"brain8.foresight.reason.motivation": "De siste aktivitetssignalene dine viser et mulig tap av fremdrift."
  ,"brain8.foresight.reason.forgetting": "Repetisjonsprognosen din viser at noget viden kan bli vanskeligere å huske."
  ,"brain8.search.label": "Søg i hjernen din"
  ,"brain8.search.placeholder": "Begrep, kilde eller mål…"
  ,"brain8.search.action": "Søg"
  ,"brain8.search.kind.concept": "Begrep"
  ,"brain8.search.kind.document": "Kilde"
  ,"brain8.search.kind.goal": "Mål"
  ,"brain8.ask.title": "Spør hjernen din…"
  ,"brain8.ask.detail": "Second Brain svarer bare ut fra begrepene og kildene dine."
  ,"brain8.ask.placeholder": "Hvad vet jeg om nettverk?"
  ,"brain8.ask.action": "Spør"
  ,"brain8.ask.answer.weakest": "{count} skrøbelige begrep(er) fundet ut fra mestringssignalene dine."
  ,"brain8.ask.answer.neglected": "{count} begrep(er) med forfalte repetisjoner fundet."
  ,"brain8.ask.answer.documents": "{count} samsvarende kilde(r) eller begrep(er) fundet."
  ,"brain8.ask.answer.knowledge": "{count} samsvarende element(er) fundet i hjernen din."
  ,"brain8.ask.answer.no-results": "De nåværende dataene dine gir ikke grunnlag for et svar på dette spørsmålet."
  ,"brain8.ask.grounded": "Svaret er begrænset til lagrede data i Second Brain."
  ,"brain8.concept.pick": "Vælg et begrep for å undersøke grunnlaget og forbindelsene."
  ,"brain8.concept.cards": "{count} kort"
  ,"brain8.concept.due": "{count} forfalt"
  ,"brain8.concept.stability": "{days} dager med minnestabilitet"
  ,"brain8.concept.nextReview": "Neste planlagte repetisjon: {date}"
  ,"brain8.concept.tutor": "Spør professoren"
  ,"brain8.concept.practice": "Øv"
  ,"brain8.concept.review": "Repeter"
  ,"brain8.concept.sources": "Kilder"
  ,"brain8.concept.relations": "Forbindelser"
  ,"brain8.concept.activity": "Seneste interaksjoner"
  ,"brain8.concept.truncated": "Bare de første tilgængelige kildene vises."
  ,"brain8.relation.prerequisite": "forkunnskap"
  ,"brain8.relation.related": "relatert"
  ,"brain8.context.document": "Aktivt dokument"
  ,"brain8.context.session": "Professorøkt"
  ,"brain8.context.goal": "Læringsmål"
  ,"brain8.partial": "Nogen deler er midlertidig utilgængelige, men de tilgængelige dataene kan fortsatt bruges."
  ,"brain8.error.load": "Hjernen din kunne ikke lastes inn akkurat nå."
  ,"tutor6.result.brain": "Se virkningen på Hjernen min"
  ,"voice.error.playback": "Kunne ikke spille av stemmen til professoren din."
  ,"voice.error.blocked": "Avspilling av lyd ble blokkert."
  ,"voice.error.recordUnsupported": "Lydopptak er ikke tilgængelig på denne enheden."
  ,"voice.error.micDenied": "Tilgang til mikrofonen ble avslått. Tillat mikrofontilgang og prøv igjen."
  ,"voice.error.notRecording": "Ingen optagelse i gang."
  ,"voice.error.empty": "Ingenting ble tatt opp. Kontroller mikrofonen og prøv igjen."
  ,"error.timeout": "Forespørselen tok for lang tid. Prøv igjen."
  ,"error.unauthorized": "Økten din har utløpt, eller innloggingsopplysningene er ugyldige."
  ,"error.forbidden": "Denne handlingen er ikke tilgængelig for denne kontoen."
  ,"error.notFound": "Det forespurte elementet er ikke lenger tilgængelig."
  ,"error.conflict": "Denne endringen er i konflikt med gjeldende tilstand. Oppdater og prøv igjen."
  ,"error.rateLimit": "For mange forsøk. Vent litt før du prøver igjen."
  ,"error.validation": "Noget informasjon er ugyldig. Kontroller feltene og prøv igjen."
  ,"error.upload": "Opplastingen mislyktes. Det eksisterende arbeidet ditt er bevart."
  ,"error.download": "Filen kunne ikke lastes inn. Prøv igjen."
  ,"onb.languages.explanation": "Forklaringsspråk"
  ,"onb.languages.explanationWhy": "AI-professoren bruger dette sproget til generelle forklaringer og veiledning."
  ,"mfa.title": "Totrinnsbekreftelse"
  ,"mfa.intro": "Beskyt kontoen din med en kode fra autentiseringsappen."
  ,"mfa.profileTitle": "Kontosikkerhet"
  ,"mfa.profileDetail": "Konfigurer totrinnsbekreftelse fra den sikre registreringssiden på nettet."
  ,"mfa.open": "Konfigurer totrinnsbekreftelse"
  ,"mfa.idleTitle": "Tilføj en autentiseringsapp"
  ,"mfa.idleDetail": "Start bare når autentiseringsappen er klar. En ny privat konfigurasjonsnøkkel opprettes."
  ,"mfa.start": "Start sikker konfigurering"
  ,"mfa.setupTitle": "Koble til autentiseringsappen"
  ,"mfa.setupDetail": "Tilføj kontoen manuelt med nøkkelen nedenfor, eller importer otpauth-URI-en i en kompatibel autentiseringsapp."
  ,"mfa.secretLabel": "Manuell Base32-nøgle"
  ,"mfa.secretWarning": "Behandle denne nøkkelen som et adgangskode. Ikke del den eller gem den i et ubeskyttet notat."
  ,"mfa.uriLabel": "Autentiserings-URI"
  ,"mfa.uriDetail": "Brug denne bare i en autentiseringsapp du stoler på."
  ,"mfa.codeLabel": "6-sifret autentiseringskode"
  ,"mfa.codeHint": "Skriv inn den gjeldende 6-sifrede koden som vises i autentiseringsappen."
  ,"mfa.enable": "Bekreft og aktiver"
  ,"mfa.alreadyEnabled": "Totrinnsbekreftelse kan allerede være aktivert. Logg ut og inn igjen for å kontrollere det."
  ,"mfa.setupError": "Sikker konfigurering kunne ikke startes. Ingenting ble aktivert. Prøv igjen."
  ,"mfa.enableError": "Koden kunne ikke bekreftes. Kontroller gjeldende kode og prøv igjen."
  ,"mfa.recoveryTitle": "Gem gjenopprettingskodene nå"
  ,"mfa.recoveryWarning": "Disse kodene vises bare én gang."
  ,"mfa.recoveryDetail": "Gem dem i en passordbehandler du stoler på, eller et annet sikkert sted, før du forlater denne siden."
  ,"mfa.saved": "Jeg har gemt gjenopprettingskodene"
  ,"mfa.doneTitle": "Totrinnsbekreftelse er aktivert"
  ,"mfa.doneDetail": "Ved neste innlogging trenger du autentiseringsappen eller én ubrukt gjenopprettingskode."
  ,"mfa.backProfile": "Tilbage til Profil"
  ,"nav.back": "Tilbage"
  ,"shell.backToApp": "Tilbage til appen"
  ,"shell.adminArea": "Administrasjon"
  ,"shell.technicalArea": "Teknisk område"
  ,"shell.demoArea": "Demoområde"
  ,"shell.legacyArea": "Tidligere oplevelse"
  ,"shell.designSystem": "Designsystem"
  ,"learn.backToLearn": "Tilbage til Lær"
  ,"learn.free.kicker": "Fritt søg"
  ,"learn.free.title": "Spør om hvad som helst"
  ,"learn.free.subtitle": "Et spontant spørgsmål – faglig, teknisk eller generelt. Skilt fra den pedagogiske AI-professoren din."
  ,"learn.free.placeholder": "Skriv inn spørsmålet ditt…"
  ,"learn.free.submit": "Spør"
  ,"learn.deep.kicker": "Dypdykk"
  ,"learn.deep.title": "Utforsk et emne i dybden"
  ,"learn.deep.subtitle": "Professoren undersøker emnet ditt grundig og gir deg en strukturert analyse."
  ,"learn.deep.placeholder": "Hvad vil du utforske i dybden?"
  ,"learn.deep.submit": "Undersøk"
  ,"learn.deep.frame": "Gi en grundig, strukturert analyse (kontekst, hovedpunkter, nyanser, konklusjon) av:"
  ,"learn.deep.note": "Direktekilder og en trinnvis forskningsplan kommer etter hvert som backend utvikles."
  ,"learn.oral.kicker": "Muntlig øvelse"
  ,"learn.oral.title": "Svar høyt"
  ,"learn.oral.subtitle": "Professoren stiller spørgsmål. Svar med stemmen, så vurderer professoren deg."
  ,"learn.oral.frame": "Gjennomfør en kort muntlig øvelse tilpasset profilen min. Still ett spørgsmål om gangen. Jeg svarer med stemmen."
  ,"learn.oral.record": "Svar med stemmen"
  ,"learn.oral.stop": "Stop"
  ,"learn.oral.ready": "Klar"
  ,"learn.oral.recording": "Lytter…"
  ,"learn.oral.analyzing": "Analyserer…"
  ,"learn.oral.you": "Du"
  ,"learn.oral.teacher": "Professor"
  ,"learn.oral.noVoice": "Taleopptak er ikke tilgængelig på denne enheden."
  ,"learn.oral.starting": "Forbereder øvelsen…"
  ,"learn.explain.kicker": "Forklar"
  ,"learn.explain.title": "Få et begrep forklart"
  ,"learn.explain.subtitle": "En tydelig forklaring med eksempler og analogier, på niveauet du velger."
  ,"learn.explain.levelLabel": "Nivå"
  ,"learn.explain.lvlBeginner": "Nybegynner"
  ,"learn.explain.lvlIntermediate": "Middels"
  ,"learn.explain.lvlAdvanced": "Avansert"
  ,"learn.explain.placeholder": "Hvilket begrep vil du forstå?"
  ,"learn.explain.submit": "Forklar"
  ,"learn.explain.frame": "Forklar dette begrepet tydelig, med eksempler og analogier. Nivå:"
  ,"learn.discuss.kicker": "Samtale"
  ,"learn.discuss.title": "Snakk med professoren"
  ,"learn.discuss.subtitle": "En fri pedagogisk samtale – professoren kjenner niveauet og målene dine."
  ,"learn.discuss.placeholder": "Hvad vil du snakke om?"
  ,"learn.discuss.submit": "Start"
  ,"learn.exam.kicker": "Muntlig eksamen"
  ,"learn.exam.title": "Simulering av muntlig eksamen"
  ,"learn.exam.subtitle": "Professoren blir sensor: stiller spørgsmål, du svarer høyt, og til slutt blir du vurdert."
  ,"learn.exam.consignes": "Svar høyt, ett spørgsmål om gangen. Ta deg god tid."
  ,"learn.exam.start": "Start eksamen"
  ,"learn.exam.starting": "Starter eksamen…"
  ,"learn.exam.elapsed": "Tid"
  ,"learn.exam.examiner": "Sensor"
  ,"learn.exam.end": "Avslutt eksamen"
  ,"learn.exam.evaluating": "Vurderer…"
  ,"learn.exam.startFrame": "Gi meg en muntlig eksamen. Presenter temaet kort, og still deretter det første spørsmålet. Ett spørgsmål om gangen. Jeg svarer høyt."
  ,"learn.exam.endFrame": "Avslutt eksamen nå. Gi meg vurderingen din: styrker, forbedringsområder og anbefalinger. Vær pedagogisk."
  ,"teach.kicker": "Undervis"
  ,"teach.title": "Hvad skal jeg lære deg?"
  ,"teach.subtitle": "Nevn et emne, så lager professoren en trinnvis leksjon for deg."
  ,"teach.placeholder": "F.eks. fotosyntese, den franske revolusjonen, derivasjon…"
  ,"teach.submit": "Lag leksjonen"
  ,"learn.mode.errTitle": "Ukjent oplevelse"
  ,"learn.mode.errDetail": "Denne læringsmodusen findes ikke eller er ikke tilgængelig ennå."
  ,"home4.loading": "Forbereder den neste nyttige handlingen…"
  ,"home4.context.new": "La oss bygge ditt Second Brain."
  ,"home4.context.active": "Her er det mest nyttige neste steget ut fra fremgangen din."
  ,"home4.context.exam": "Eksamen i {focus} nærmer seg."
  ,"home4.context.revision": "Minnet ditt har arbeid som faktisk har forfalt."
  ,"home4.context.resume": "Du kan fortsætte med {focus} uten å miste sammenhengen."
  ,"home4.context.caught-up": "Du er ajour. Det findes ingen kunstig hast."
  ,"home4.recommended": "Anbefalt nå"
  ,"home4.whyClose": "Skjul begrunnelsene"
  ,"home4.whyIntro": "Basert på disse kontrollerbare signalene:"
  ,"home4.confidence": "Beregnet sikkerhet: {value} %"
  ,"home4.resume": "Fortsæt der du slapp"
  ,"home4.resumeDetail": "De siste øktene dine beholder sammenhengen og arbeidet."
  ,"home4.resumeAction": "Fortsæt"
  ,"home4.session.type.learning": "Læring"
  ,"home4.session.type.tutor": "Veiledning"
  ,"home4.session.type.research": "Undersøkelse"
  ,"home4.session.type.review": "Repetisjon"
  ,"home4.session.type.language": "Sprog"
  ,"home4.session.type.workspace": "Arbeidsområde"
  ,"home4.session.type.document-processing": "Dokument"
  ,"home4.lastActivity": "Siste aktivitet"
  ,"home4.artifact": "Siste arbeid"
  ,"home4.upcoming": "Kommende"
  ,"home4.upcomingDetail": "De neste læringshendelsene som trenger oppmerksomheten din."
  ,"home4.upcomingEmpty": "Ingenting planlagt snart."
  ,"home4.planning": "Læringskalender"
  ,"home4.upcoming.kind.exam": "Eksamen"
  ,"home4.upcoming.kind.homework": "Lekser"
  ,"home4.upcoming.kind.practical": "Praktisk arbeid"
  ,"home4.upcoming.kind.language": "Sprogöving"
  ,"home4.upcoming.kind.aiSession": "AI-økt"
  ,"home4.upcoming.kind.revision": "Repetisjon"
  ,"home4.upcoming.kind.quiz": "Quiz"
  ,"home4.upcoming.kind.objective": "Mål"
  ,"home4.upcoming.kind.deadline": "Frist"
  ,"home4.mainGoal": "Hovedmål"
  ,"home4.goal.period.daily": "Daglig mål"
  ,"home4.goal.period.weekly": "Ukentlig mål"
  ,"home4.goal.period.monthly": "Månedlig mål"
  ,"home4.goal.open": "Åpne målet"
  ,"home4.progress.title": "Fremgangen din"
  ,"home4.progress.detail": "En kompakt oversikt over hvad som endrer seg i læringen din."
  ,"home4.progress.due": "forfalte repetisjoner"
  ,"home4.progress.mastered": "mestrede begreper"
  ,"home4.progress.streak": "dagers rekke"
  ,"home4.progress.open": "Åpne Hjernen min"
  ,"home4.other": "Andre måter å begynde på"
  ,"home4.otherDetail": "Fang opp eller uttrykk noget når anbefalingen ikke er det du trenger."
  ,"home4.date.today": "I dag"
  ,"home4.date.tomorrow": "I morgen"
  ,"home4.date.yesterday": "I går"
  ,"home4.date.unknown": "Ukjent dato"
  ,"home4.partial": "Nogen kilder er midlertidig utilgængelige. Tilgængelige prioriteringer bruger fortsatt bekreftede data."
  ,"home4.stale": "Viser den siste tilgængelige startsiden mens oppdateringen prøves på nytt."
  ,"home4.unavailable": "Ingen bekreftet prioritet kunne lastes inn akkurat nå."
  ,"learn5.eyebrow": "Lær"
  ,"learn5.title": "Begynn med det du vil oppnå"
  ,"learn5.subtitle": "Spør, snakk, fang eller importer. Second Brain velger den eksisterende oplevelsen som passer intensjonen din, og beholder konteksten."
  ,"learn5.question": "Hvad vil du lære eller gjøre?"
  ,"learn5.composer.badge": "Ett intelligent startpunkt"
  ,"learn5.composer.detail": "Beskriv resultatet med dine egne ord. Det er valgfritt å velge en intensjon."
  ,"learn5.composer.placeholder": "For eksempel: forklar fotosyntese, hjælp meg å øve på spansk, eller lag en quiz fra notatene mine…"
  ,"learn5.composer.inputLabel": "Det du vil lære eller oppnå"
  ,"learn5.composer.submit": "Fortsæt"
  ,"learn5.examples.label": "Prøv ett av disse"
  ,"learn5.examples.understand": "Forstå et emne"
  ,"learn5.examples.understandPrompt": "Forklar dette emnet for meg: "
  ,"learn5.examples.practice": "Øv på et sprog"
  ,"learn5.examples.practicePrompt": "Hjælp meg å øve på å snakke engelsk"
  ,"learn5.examples.scan": "Skann en side"
  ,"learn5.examples.import": "Importer et kurs"
  ,"learn5.intent.label": "Intensjon (valgfritt)"
  ,"learn5.intent.understand": "Forstå"
  ,"learn5.intent.learn": "Lær"
  ,"learn5.intent.practice": "Øv"
  ,"learn5.intent.research": "Undersøk"
  ,"learn5.intent.create": "Lag"
  ,"learn5.intent.suggested": "foreslått"
  ,"learn5.depth.label": "Undersøkelsesdybde"
  ,"learn5.depth.quick": "Raskt svar"
  ,"learn5.depth.standard": "Undersøkelse"
  ,"learn5.depth.deep": "Dypdykk"
  ,"learn5.modality.write": "Skriv"
  ,"learn5.modality.speak": "Snakk"
  ,"learn5.modality.capture": "Fang opp"
  ,"learn5.modality.import": "Importer"
  ,"learn5.modality.export": "Eksporter"
  ,"learn5.modality.exportData": "Åpne dataeksporten din"
  ,"learn5.route.prefix": "Neste:"
  ,"learn5.route.capture": "åpne skanneren, forhåndsvis sidene og bekreft."
  ,"learn5.route.import": "importer denne filen til Biblioteket og behandlingsløpet for dokumentforståelse."
  ,"learn5.route.voice": "start en muntlig runde med AI-professoren din."
  ,"learn5.route.free-question": "spør AI-professoren direkte."
  ,"learn5.route.document-understanding": "still spørgsmål om det aktive dokumentet og få kildebaserte svar."
  ,"learn5.route.concept-explanation": "åpne en målrettet forklaring av det aktive begrepet."
  ,"learn5.route.explanation": "be AI-professoren om en strukturert forklaring."
  ,"learn5.route.lesson": "lag en veiledet leksjon om dette emnet."
  ,"learn5.route.guided-session": "start den eksisterende veiledede økten."
  ,"learn5.route.learning-path": "åpne det adaptive læringsløpet ditt."
  ,"learn5.route.document-learning": "lær av det aktive dokumentet."
  ,"learn5.route.practice": "forbered en øvelse."
  ,"learn5.route.document-practice": "lag en øvingsform fra det aktive dokumentet."
  ,"learn5.route.oral-practice": "åpne muntlig øving med professoren."
  ,"learn5.route.language-practice": "fortsæt i det spesialiserte språkområdet."
  ,"learn5.route.research-quick": "få et kortfattet svar fra professoren."
  ,"learn5.route.research-library": "undersøk i hele Biblioteket og synlige kilder."
  ,"learn5.route.research-deep": "åpne den avanserte dypdykkopplevelsen."
  ,"learn5.route.create-quiz": "forbered en quiz i vurderingsområdet."
  ,"learn5.route.create-course": "lag et veiledet kurs."
  ,"learn5.route.create-work": "åpne Akademisk arbeidsområde med disse instruksjonene."
  ,"learn5.route.create-from-document": "lag noget fra det aktive dokumentet."
  ,"learn5.clarify.question": "Hvad vil du gjøre med dette emnet?"
  ,"learn5.deep.confirmTitle": "Dypdykk bruger et avansert arbeidsløp"
  ,"learn5.deep.confirmDetail": "Det kan ta lengre tid og bruke mer av kvoten din. Forespørselen lagres hvis tjenesten er utilgængelig."
  ,"learn5.deep.confirm": "Bekreft dypdykk"
  ,"learn5.attachment.ready": "klar til import"
  ,"learn5.attachment.remove": "Fjern"
  ,"learn5.attachment.import": "Importer og fortsæt"
  ,"learn5.attachment.error": "Denne filen kunne ikke velges."
  ,"learn5.attachment.missing": "Vælg filen på nytt før du importerer den."
  ,"learn5.capture.title": "Fang opp eller importer"
  ,"learn5.capture.detail": "En skann forhåndsvises før opplasting. Filer går inn i det samme behandlingsløpet for dokumentforståelse."
  ,"learn5.capture.scan": "Fotografer eller skann en side"
  ,"learn5.capture.file": "Vælg en fil"
  ,"learn5.voice.stop": "Stop og send"
  ,"learn5.voice.error": "Opptaket kunne ikke fullføres."
  ,"learn5.voice.missing": "Det findes ikke noget optagelse som er klart til å sendes."
  ,"learn5.voice.unavailable": "Mikrofonen er utilgængelig på denne enheden"
  ,"learn5.error.generic": "Denne handlingen kunne ikke startes."
  ,"learn5.error.preserved": "Teksten, konteksten og vedlegget ditt er bevart. Du kan prøve igjen eller bruke en annen funksjon uten AI."
  ,"learn5.draft.restored": "Utkast gjenopprettet"
  ,"learn5.draft.restoredDetail": "Den forrige forespørselen og konteksten er fortsatt her."
  ,"learn5.draft.clear": "Tøm"
  ,"learn5.cancel": "Avbryt"
  ,"learn5.context.user-profile": "Profil"
  ,"learn5.context.brain": "Hjernen min"
  ,"learn5.context.document": "Dokument"
  ,"learn5.context.document-collection": "Dokumentsamling"
  ,"learn5.context.concept": "Begrep"
  ,"learn5.context.lesson": "Leksjon"
  ,"learn5.context.goal": "Mål"
  ,"learn5.context.exam": "Eksamen"
  ,"learn5.context.language": "Sprog som læres"
  ,"learn5.context.workspace": "Arbeidsområde"
  ,"learn5.context.tutor-session": "Veiledningsøkt"
  ,"learn5.context.research": "Undersøkelse"
  ,"learn5.context.revision": "Repetisjon"
  ,"learn5.context.learning-path": "Læringsløp"
  ,"learn5.resume.unavailable": "Økter er midlertidig utilgængelige"
  ,"learn5.resume.unavailableDetail": "Skrivefeltet er fortsatt tilgængelig, og utkastet ditt blir beholdt."
  ,"learn5.spaces.title": "Spesialiserte områder"
  ,"learn5.spaces.detail": "Åpne et eget miljø når oppgaven har nytte av det."
  ,"learn5.spaces.languages": "Sprog"
  ,"learn5.spaces.languagesDetail": "Fordypning, uttale og samtale."
  ,"learn5.spaces.library": "Bibliotek"
  ,"learn5.spaces.libraryDetail": "Dokumentene og kildene dine på ett sted."
  ,"learn5.spaces.workspace": "Akademisk arbeidsområde"
  ,"learn5.spaces.workspaceDetail": "Lag og forbedre strukturert akademisk arbeid."
  ,"learn5.advanced.title": "Avanserte moduser"
  ,"learn5.advanced.detail": "Eksisterende spesialopplevelser som er tilgængelige når du vil ha direkte kontroll."
  ,"learn5.advanced.explain": "Forklar"
  ,"learn5.advanced.teach": "Lær meg"
  ,"learn5.advanced.guided": "Veiledet økt"
  ,"learn5.advanced.oral": "Muntlig øving"
  ,"learn5.advanced.exam": "Muntlig eksamen"
  ,"learn5.advanced.deep": "Dypdykk"
  ,"teacher.mode.lesson": "Leksjon"
  ,"teacher.mode.exercise": "Øvelse"
  ,"teacher.mode.training": "Trening"
  ,"teacher.mode.assessed": "Vurdert"
  ,"teacher.mode.exam": "Eksamen"
  ,"teacher.exam.rulesTitle": "Eksamensregler"
  ,"teacher.exam.mode": "Eksamensmodus"
  ,"teacher.exam.grading": "Karaktersetting"
  ,"teacher.exam.rubric": "Vurderingskriterier"
  ,"teacher.exam.help": "Tillatt hjælp"
  ,"teacher.exam.helpLimited": "Begrænset hjælp"
  ,"teacher.exam.helpNone": "Ingen hjælp"
  ,"teacher.exam.feedbackAfter": "Tilbakemelding etter innlevering"
  ,"profile.intro": "Administrer identiteten din, Second Brain-indstillinger, sprog, abonnement og data."
  ,"profile.section.myProfile": "Min profil"
  ,"profile.section.myProfileDetail": "Identiteten din og læringskonteksten som bruges i hele produktet."
  ,"profile.section.personalization": "Tilpass Second Brain"
  ,"profile.section.personalizationDetail": "Vælg hvordan AI-professoren underviser. Det detaljerte lærings-DNA-et ditt forblir i Hjernen min."
  ,"profile.section.languages": "Sprog og oplevelse"
  ,"profile.section.languagesDetail": "Angi grensesnittspråket separat fra sproget du lærer."
  ,"profile.section.billing": "Abonnement og brug"
  ,"profile.section.billingDetail": "Se gjeldende abonnement, faktiske grænser, gjenstående brug og tilbakestillingsdatoer."
  ,"profile.section.privacy": "Data og personvern"
  ,"profile.section.privacyDetail": "Kontroller utseende, AI-minne, dokumenter, samtykker og personopplysninger."
  ,"profile.billing.current": "Gjeldende abonnement"
  ,"profile.billing.unavailable": "Abonnementet er utilgængelig"
  ,"profile.billing.usageUnavailable": "Bruksdetaljer er midlertidig utilgængelige."
  ,"profile.billing.viewUsage": "Se brug og kvoter"
  ,"profile.brainPreview.title": "Læringsprofil"
  ,"profile.brainPreview.detail": "En kort forhåndsvisning. Lærings-DNA, minne og mestring findes i Hjernen min."
  ,"profile.brainPreview.empty": "Læringsprofilen din vises etter hvert som du fullfører økter."
  ,"profile.brainPreview.open": "Åpne Hjernen min"
  ,"profile.languages.specialized": "Grensesnittspråket er adskilt fra sproget du lærer."
  ,"profile.languages.open": "Åpne Sprog og fordypning"
  ,"profile.privacy.detail": "De detaljerte personvern- og minnekontrollene er alltid tilgængelige."
  ,"profile.privacy.memory": "AI-minne"
  ,"profile.privacy.documents": "Mine dokumenter"
  ,"profile.partial": "Nogen profilopplysninger kunne ikke oppdateres. De tilgængelige innstillingene kan fortsatt bruges."
  ,"profile.teacher.title": "Min AI-professor"
  ,"profile.teacher.detail": "Mindre krevende gir flere hint og nye forsøk. Normal er livlig, oppmuntrende og strukturert. Krevende ber om dypere resonnement og presise rettelser."
  ,"profile.teacher.auto": "Automatisk tilpasning"
  ,"profile.teacher.autoDetail": "Second Brain fortsetter å tilpasse veiledning, tempo og vanskelighetsgrad ut fra den faktiske fremgangen din. Normal er standard utenfor varslede vurderinger."
  ,"profile.teacher.learning": "Undervisningsnivå"
  ,"profile.teacher.learning.guided": "Mindre krevende"
  ,"profile.teacher.learning.balanced": "Normal"
  ,"profile.teacher.learning.demanding": "Krevende"
  ,"profile.teacher.conversation": "Samtalemodus"
  ,"profile.teacher.conversation.training": "Trening"
  ,"profile.teacher.conversation.assessed": "Vurdert"
  ,"profile.teacher.conversation.trainingDetail": "Øv fritt med hint og rettelser."
  ,"profile.teacher.conversation.assessedDetail": "Gennemfør en varslet vurdert samtale med begrænset hjælp og tilbakemelding basert på det du viser."
  ,"profile.teacher.exam": "Eksamensmodus"
  ,"profile.teacher.exam.standard": "Standard"
  ,"profile.teacher.exam.strict": "Streng"
  ,"profile.teacher.examDetail": "Eksamensreglene styrer tilgængelig hjælp, karaktersetting og tidspunkt for tilbakemelding."
  ,"profile.teacher.advancedOpen": "Vis avanserte indstillinger"
  ,"profile.teacher.advancedClose": "Skjul avanserte indstillinger"
  ,"profile.teacher.correction": "Tidspunkt for retting"
  ,"profile.teacher.correction.immediate": "Rett med én gang"
  ,"profile.teacher.correction.let_me_finish": "La meg gjøre meg færdig"
  ,"profile.teacher.correction.adaptive": "Tilpass etter situasjonen"
  ,"profile.teacher.summary": "Oppsummering av økten"
  ,"profile.teacher.encouragement": "Oppmuntring"
  ,"profile.teacher.encouragement.measured": "Avmålt"
  ,"profile.teacher.encouragement.supportive": "Støttende"
  ,"profile.teacher.reset": "Tilbakestill til standard"
  ,"profile.settings.saveError": "Disse innstillingene kunne ikke lagres."
  ,"profile.settings.preserved": "De forrige innstillingene dine er bevart."
  ,"tutor.fasterMsg": "Dette forstår jeg – kan du gå litt raskere frem?"
  ,"tutor.loadFailed": "Klasserommet kunne ikke åpnes."
  ,"tutor6.lobby.loading": "Åpner læringsøktene dine…"
  ,"tutor6.lobby.eyebrow": "AI-professor"
  ,"tutor6.lobby.title": "Hvad vil du arbeide med?"
  ,"tutor6.lobby.subtitle": "Fortsæt akkurat der du slapp, eller start en målrettet forespørsel."
  ,"tutor6.lobby.continueTitle": "Fortsæt der du slapp"
  ,"tutor6.lobby.resumeDetail": "Målet, konteksten og historikken din er bevart."
  ,"tutor6.lobby.resume": "Fortsæt økten"
  ,"tutor6.lobby.newTitle": "Ny forespørsel"
  ,"tutor6.lobby.placeholder": "Forklar et begrep, still meg spørgsmål, hjælp meg å øve…"
  ,"tutor6.lobby.start": "Spør professoren"
  ,"tutor6.lobby.openSaved": "Åpne den lagrede økten"
  ,"tutor6.lobby.recent": "Seneste økter"
  ,"tutor6.lobby.completed": "Fullførte økter"
  ,"tutor6.lobby.modes": "Andre måter å arbeide på"
  ,"tutor6.lobby.mode.explain": "Forklar"
  ,"tutor6.lobby.mode.discuss": "Diskuter"
  ,"tutor6.lobby.mode.oral": "Muntlig øving"
  ,"tutor6.lobby.mode.deep": "Dypdykk"
  ,"tutor6.objective": "Læringsmål"
  ,"tutor6.strategy": "Undervisningstilnærming"
  ,"tutor6.empty": "Still det første spørsmålet ditt. Målet og den aktive konteksten forblir knyttet til denne økten."
  ,"tutor6.loading.detail": "Gjenoppretter målet, konteksten og den seneste samtalen."
  ,"tutor6.backTutor": "Tilbage til Professor"
  ,"tutor6.pause": "Sett på pause og forlat"
  ,"tutor6.complete": "Gennemfør økten"
  ,"tutor6.options": "Øktalternativer"
  ,"tutor6.state.ready": "Klar"
  ,"tutor6.state.listening": "Lytter"
  ,"tutor6.state.transcription": "Transkriberer stemmen din…"
  ,"tutor6.state.thinking": "Professoren forbereder et svar…"
  ,"tutor6.state.response": "Svaret er klart"
  ,"tutor6.state.error": "Handling kreves"
  ,"tutor6.voice.heard": "Transskription bevart: «{text}»"
  ,"tutor6.voice.saved": "Den muntlige runden og den skriftlige leksjonen «{topic}» er bevart."
  ,"tutor6.error.provider": "Professoren er midlertidig utilgængelig"
  ,"tutor6.error.preserved": "Utkastet og økten din er bevart."
  ,"tutor6.error.retry": "Prøv forespørselen på nytt"
  ,"tutor6.quota.title": "Grensen for AI-brug er nået"
  ,"tutor6.quota.detail": "Denne AI-handlingen er satt på pause. Du kan fortsatt lese dokumentene dine og bruke områder uten AI."
  ,"tutor6.quota.reset": "AI-handlinger blir tilgængelige igjen etter {date}. Økten din forblir gemt."
  ,"tutor6.quota.usage": "Se brug"
  ,"tutor6.quota.library": "Åpne Biblioteket"
  ,"tutor6.block.text": "Svar"
  ,"tutor6.block.teaching": "Forklaring"
  ,"tutor6.block.example": "Eksempel"
  ,"tutor6.block.question": "Kontroller forståelsen din"
  ,"tutor6.block.exercise": "Øvelse"
  ,"tutor6.block.quiz": "Quiz"
  ,"tutor6.block.summary": "Oppsummering"
  ,"tutor6.block.source": "Kilde"
  ,"tutor6.block.action": "Neste steg"
  ,"tutor6.block.progress": "Fremgang"
  ,"tutor6.progress.title": "Dette ændret seg i økten"
  ,"tutor6.progress.count": "{done} av {total} faktiske steg fullført"
  ,"tutor6.progress.completed": "{done} fullførte steg"
  ,"tutor6.impact.concept-added": "Et begrep ble lagt til i Hjernen din"
  ,"tutor6.impact.connection-added": "En kunnskapsforbindelse ble lagt til"
  ,"tutor6.impact.mastery": "Mestringen av begrepet ble ændret"
  ,"tutor6.impact.memory": "Minneplanen din ble ændret"
  ,"tutor6.impact.progress": "Læringsfremgangen din ble ændret"
  ,"tutor6.result.title": "Vælg neste handling"
  ,"tutor6.result.detail": "Fortsæt, styrk viden eller gå tilbage til konteksten du kom fra."
  ,"tutor6.result.continue": "Fortsæt å lære"
  ,"tutor6.result.consolidate": "Styrk med øving"
  ,"tutor6.result.origin": "Tilbage til den opprinnelige konteksten"
  ,"strategy.reason.socratic": "Veiledende spørgsmål hjælper deg å bygge resonnementet selv før professoren bekrefter det."
  ,"strategy.reason.project_based": "En konkret produksjon gir hvert begrep et umiddelbart bruksområde."
  ,"strategy.reason.problem_solving": "Dette emnet blir klarere når du løser ett meningsfullt steg om gangen."
  ,"strategy.reason.case_study": "Et realistisk tilfelle gjør de underliggende prinsippene enklere å undersøke."
  ,"strategy.reason.task_based": "Brug av ferdigheten i en virkelig opgave støtter aktiv læring."
  ,"strategy.reason.guided_demonstration": "Et gjennomarbeidet eksempel gir støtte før du gradvis tar over."
  ,"strategy.reason.active_learning": "Korte og hyppige aktiviteter holder deg aktivt involvert."
  ,"strategy.reason.experiential": "Å bruke begrepet og reflektere over resultatet bidrar til dypere mestring."
  ,"library7.owned": "Det jeg eier"
  ,"library7.mission": "Alt du har gitt til Second Brain – organisert, forstått og klart til å lære av."
  ,"library7.offline": "Biblioteket er frakoblet for øyeblikket."
  ,"library7.stale.title": "Frakoblet visning"
  ,"library7.stale.detail": "Dette er de sist lagrede dataene fra Biblioteket. Handlinger som krever Second Brain, blir tilgængelige etter ny tilkobling."
  ,"library7.import": "Importer"
  ,"library7.scan": "Skann"
  ,"library7.batch": "Flere dokumenter"
  ,"library7.ask": "Spør kildene mine"
  ,"library7.search": "Søg i filer, emner eller sammendrag…"
  ,"library7.sort.newest": "Nyeste"
  ,"library7.sort.oldest": "Eldste"
  ,"library7.sort.title": "Tittel"
  ,"library7.more": "Indlæs inn flere"
  ,"library7.favorite": "Tilføj eller fjern fra favoritter"
  ,"library7.conceptsCount": "{n} begreper oppdaget"
  ,"library7.documentsCount": "{n} dokumenter"
  ,"library7.collection.create": "Ny samling"
  ,"library7.collection.name": "Navn på samlingen"
  ,"library7.collection.none": "Ingen samling"
  ,"library7.empty.title": "Biblioteket ditt er fortsatt tomt"
  ,"library7.empty.detail": "Tilføj et kurs, en bok, en artikkel eller notatene dine. Second Brain kan forstå dem, knytte dem til hjernen din og hjelpe deg å lære av innholdet."
  ,"library7.empty.pipeline": "Dette skjer etter en import"
  ,"library7.empty.import": "Importer"
  ,"library7.empty.read": "Les"
  ,"library7.empty.understand": "Forstå"
  ,"library7.empty.connect": "Koble sammen"
  ,"library7.empty.ready": "Klar"
  ,"library7.import.title": "Tilføj en kilde"
  ,"library7.import.file": "Fil"
  ,"library7.import.text": "Notater"
  ,"library7.import.url": "Nettside"
  ,"library7.import.formats": "PDF, tekst, Markdown og bilder bruger det samme dokumentløpet."
  ,"library7.import.choose": "Vælg en fil"
  ,"library7.quota.title": "Bruksgrensen er nået"
  ,"library7.quota.reset": "Tilgængelig igjen: {date}."
  ,"library7.quota.usage": "Se brug"
  ,"library7.quota.alternatives": "Fortsatt tilgængelig"
  ,"document.pipeline.queued": "Venter på å bli lest"
  ,"document.pipeline.reading": "Leser dokumentet"
  ,"document.pipeline.extracting": "Henter ut nyttig indhold"
  ,"document.pipeline.indexing": "Forbereder dokumentsøk"
  ,"document.pipeline.connecting": "Kobler sammen begreper"
  ,"document.pipeline.completed": "Dokumentet er klart"
  ,"document.pipeline.failed": "Behandlingen stoppet"
  ,"document.pipeline.noEstimate": "Gjeldende steg – ingen pålitelig tidsberegning"
  ,"document.pipeline.retry": "Prøv dokumentet på nytt"
  ,"document.pipeline.retryOcr": "Les den lagrede skannen på nytt"
  ,"document.pipeline.ocrFailed": "Tekstgjenkjenningen mislyktes. De skannede sidene dine er fortsatt gemt."
  ,"document.pipeline.ocrRetryHelp": "De skannede sidene er bevart. Denne handlingen prøver tekstgjenkjenning på nytt. Den indekserer ikke et tomt dokument."
  ,"document.batch.title": "Import av flere dokumenter"
  ,"document.batch.detail": "Hver fil behandles uavhengig. En fejl påvirker ikke dokumenter som allerede er ferdigbehandlet."
  ,"document.batch.choose": "Vælg dokumenter"
  ,"document.batch.start": "Start import"
  ,"document.batch.cancel": "Stop ventende importer"
  ,"document.batch.summary": "{total} totalt · {done} klare · {processing} behandles · {failed} mislyktes"
  ,"document.batch.waiting": "Venter"
  ,"document.batch.uploading": "Indlæser opp…"
  ,"document.batch.result": "Oppsummering av bunken"
  ,"document.batch.resultDetail": "{documents} dokumenter klare · {concepts} begreper oppdaget"
  ,"document.batch.subjects": "Oppdagede emner"
  ,"source.passage": "Utdrag {n}"
  ,"source.close": "Luk kildeforhåndsvisningen"
  ,"source.openDocument": "Åpne dokumentet"
  ,"library7.document.loading": "Åpner dokumentintelligens…"
  ,"library7.document.intelligence": "Dokumentintelligens"
  ,"library7.document.processingHelp": "Du kan forlate denne siden. Behandlingen fortsetter uten at det importerte dokumentet går tapt."
  ,"library7.document.previewLimited": "Begrænset forhåndsvisning"
  ,"library7.document.previewLimitedDetail": "Bare den første delen lastes inn her for å holde siden responsiv."
  ,"library7.backLibrary": "Tilbage til Biblioteket"
  ,"library7.action.ask": "Spør dette dokumentet"
  ,"library7.action.learn": "Lær av dette dokumentet"
  ,"library7.action.more": "Flere handlinger"
  ,"library7.action.less": "Færre handlinger"
  ,"library7.action.advanced": "Transformer eller organiser"
  ,"library7.action.quiz": "Lag en quiz"
  ,"library7.action.flashcards": "Lag læringskort"
  ,"library7.action.workspace": "Tilføj i et arbeid"
  ,"library7.tab.document": "Dokument"
  ,"library7.tab.understand": "Forstå"
  ,"library7.tab.ask": "Spør"
  ,"library7.understood": "Dette forstår Second Brain"
  ,"library7.summaryUnavailable": "Ingen oppsummering er tilgængelig ennå. Det opprinnelige dokumentet er fortsatt tilgængelig."
  ,"library7.concepts": "{n} begreper oppdaget"
  ,"library7.noConcepts": "Dokumentmotoren returnerte ingen begreper."
  ,"library7.brainImpact": "{known} allerede kjente · {new} nye · {links} forbindelser opprettet"
  ,"library7.brain.open": "Vis i Hjernen min"
  ,"library7.resources": "Transformasjoner"
  ,"library7.resources.trace": "Opprettet fra {title}"
  ,"library7.compare.with": "Sammenlign med…"
  ,"library7.nba.title": "Foreslått neste steg"
  ,"library7.nba.learn": "Lær de {n} nye begrepene"
  ,"library7.nba.ask": "Spør dette dokumentet"
  ,"library7.nba.flashcards": "Lag læringskort"
  ,"library7.nba.brain": "Se forbindelser i Hjernen"
  ,"library7.ask.documentTitle": "Spør dette dokumentet"
  ,"library7.ask.noAnswer": "De valgte kildene inneholder ikke noget svar"
  ,"library7.ask.ownedSources": "Bare mine kilder"
  ,"library7.ask.title": "Spør kildene mine"
  ,"library7.ask.detail": "Vælg nøyaktig omfang. Second Brain svarer bare fra hentede utdrag og viser kildene sine."
  ,"library7.ask.scope.all": "Alle"
  ,"library7.ask.scope.collection": "Samling"
  ,"library7.ask.scope.selected": "Valgte"
  ,"library7.ask.noCollections": "Opret først en samling i Biblioteket."
  ,"library7.ask.selectedCount": "{n} valgt"
  ,"library7.ask.chooseScope": "Vælg kilder"
  ,"library7.ask.chooseScopeDetail": "Vælg en samling eller minst ett dokument før du spør."
  ,"research10.eyebrow": "Undersøk"
  ,"research10.title": "Undersøk med kildegrunnlag"
  ,"research10.subtitle": "Finn, kryssjekk, analyser og sammenfatt det dine egne kilder faktisk underbygger."
  ,"research10.question": "Undersøkelsesspørsmål"
  ,"research10.placeholder": "F.eks. Sammenlign TCP og UDP ved hjælp av kursdokumentene mine."
  ,"research10.depth": "Dybde"
  ,"research10.depth.quick": "Raskt spørgsmål"
  ,"research10.depth.sourced": "Kildebasert undersøkelse"
  ,"research10.depth.deep": "Dypdykk"
  ,"research10.depth.quick.detail": "Et kortfattet svar fra de tilgængelige kildene."
  ,"research10.depth.sourced.detail": "Analyse med tydelige kilder og henvisninger."
  ,"research10.depth.deep.detail": "En plan, innsamling, sammenligning og strukturert sammenfatning."
  ,"research10.scope": "Kilder det skal søkes i"
  ,"research10.scope.edit": "Vælg kilder · {count} valgt"
  ,"research10.scope.apply": "Brug kildene"
  ,"research10.scope.brain": "Hjernen min"
  ,"research10.scope.library": "Biblioteket mitt"
  ,"research10.scope.documents": "Valgte dokumenter"
  ,"research10.scope.collection": "Samling"
  ,"research10.scope.external": "Eksterne kilder"
  ,"research10.scope.web": "Nettet"
  ,"research10.webUnavailable": "Nettsøk er utilgængelig"
  ,"research10.webUnavailableDetail": "Ingen ekstern søkeleverandør er konfigurert. Hjernen og Biblioteket ditt er fortsatt tilgængelige."
  ,"research10.documents": "Vælg dokumenter"
  ,"research10.documents.empty": "Ingen ferdigbehandlede dokumenter er tilgængelige."
  ,"research10.collections": "Vælg en samling"
  ,"research10.collections.empty": "Ingen samling er tilgængelig."
  ,"research10.deep.costTitle": "Undersøkelse med høyere forbruk"
  ,"research10.deep.costDetail": "Dypdykk leser flere kilder. Se gennem planen før du starter. Ingenting kostbart starter uten varsel."
  ,"research10.reviewPlan": "Se gennem undersøkelsesplanen"
  ,"research10.launch": "Start undersøkelsen"
  ,"research10.cancel": "Avbryt"
  ,"research10.cancelled": "Undersøkelsen ble avbrutt. Den lagrede økten din er fortsatt tilgængelig."
  ,"research10.plan.title": "Foreslått undersøkelsesplan"
  ,"research10.plan.find": "Finn relevante kilder i det valgte omfanget."
  ,"research10.plan.compare": "Sammenlign synspunktene som støttes av disse kildene."
  ,"research10.plan.verify": "Vis motsigelser og mangler i kildegrunnlaget."
  ,"research10.plan.synthesize": "Lag den strukturerte sammenfatningen med henvisninger."
  ,"research10.running": "Undersøkelsen i gang"
  ,"research10.runningDetail": "Second Brain søger i de valgte kildene. Det beregnes ingen fullføringsprosent."
  ,"research10.running.collect": "Samler valgte kilder"
  ,"research10.noSources": "Ingen støttende kilde fundet"
  ,"research10.noSourcesDetail": "Second Brain laget ikke et svar fordi de valgte kildene ikke gir grunnlag for det. Ændr omfanget eller spørsmålet."
  ,"research10.partial": "Delvis undersøkelse"
  ,"research10.partialDetail": "Nogen valgte kilder var utilgængelige. Resultatet nedenfor bruger bare kildene som faktisk ble lest."
  ,"research10.synthesis": "Sammenfatning"
  ,"research10.keyPoints": "Hovedpunkter"
  ,"research10.comparison": "Kildesammenligning"
  ,"research10.agreements": "Enigheter"
  ,"research10.divergences": "Uenigheter"
  ,"research10.specificities": "Særtrekk"
  ,"research10.sources": "Kilder som ble brukt"
  ,"research10.stage.sources-found": "Kilder fundet"
  ,"research10.stage.sources-read": "Kilder lest"
  ,"research10.stage.compared": "Kilder sammenlignet"
  ,"research10.stage.synthesized": "Sammenfatning fullført"
  ,"research10.next": "Fortsæt fra denne undersøkelsen"
  ,"research10.next.reason": "En kildebasert sammenfatning er klar til å bli aktiv læring."
  ,"research10.action.learn": "Lær dette emnet"
  ,"research10.action.workspace": "Tilføj i Arbeidsområdet"
  ,"research10.action.deepen": "Gå dypere"
  ,"research10.quota": "Undersøkelsesgrensen er nået"
  ,"research10.quotaDetail": "Undersøkelsen ble ikke startet på nytt. Du kan fortsatt bruke områder uten AI eller se bruken din."
  ,"research10.openUsage": "Se brug"
  ,"workspace10.eyebrow": "Akademisk arbeidsområde"
  ,"workspace10.title": "Bygg opp arbeidet ditt"
  ,"workspace10.subtitle": "Organiser en plan, skriv, oppgi kilder og be om kontekstuell hjælp uten å gi fra deg forfatterskapet."
  ,"workspace10.create": "Opret et arbeidsområde"
  ,"workspace10.createAction": "Opret arbeidsområde"
  ,"workspace10.template.memoire": "Masteroppgave"
  ,"workspace10.template.tfc": "Avsluttende prosjekt"
  ,"workspace10.template.dissertation": "Avhandling"
  ,"workspace10.template.report": "Rapport"
  ,"workspace10.template.article": "Artikkel"
  ,"workspace10.template.assignment": "Opgave"
  ,"workspace10.template.academic-research": "Akademisk forskning"
  ,"workspace10.template.other": "Annet"
  ,"workspace10.field.title": "Tittel"
  ,"workspace10.field.titlePlaceholder": "Gi dette arbeidet et navn"
  ,"workspace10.field.objective": "Mål"
  ,"workspace10.field.objectivePlaceholder": "Hvad prøver du å vise eller produsere?"
  ,"workspace10.field.due": "Valgfri frist"
  ,"workspace10.sources": "Kilder"
  ,"workspace10.sourceCount": "{n} valgt"
  ,"workspace10.sourceMode.documents": "Dokumenter"
  ,"workspace10.sourceMode.collections": "Samlinger"
  ,"workspace10.structure": "Startstruktur"
  ,"workspace10.defaultPlan.0": "Innledning"
  ,"workspace10.defaultPlan.1": "Hoveddel"
  ,"workspace10.defaultPlan.2": "Konklusjon"
  ,"workspace10.integrity": "Resonnementet ditt forblir sentralt"
  ,"workspace10.integrityDetail": "Second Brain hjælper deg å forstå, henvise og kontrollere. Det skriver ikke et komplett akademisk arbeid for deg i det skjulte."
  ,"workspace10.resume": "Fortsæt i et arbeidsområde"
  ,"workspace10.resumeDetail": "Planen, innholdet, kildene og assistenthistorikken oppbevares samlet."
  ,"workspace10.loading": "Indlæser inn arbeidsområdene dine…"
  ,"workspace10.empty": "Ingen arbeidsområder ennå"
  ,"workspace10.emptyDetail": "Opret et for å organisere et konkret arbeid og fortsætte senere."
  ,"workspace10.open": "Fortsæt"
  ,"workspace10.sourcesN": "{n} kilder"
  ,"workspace10.steps": "{done} av {total} faktiske steg fullført"
  ,"workspace10.status.active": "Aktivt"
  ,"workspace10.status.paused": "Satt på pause"
  ,"workspace10.status.completed": "Fullført"
  ,"workspace10.status.archived": "Arkivert"
  ,"workspace10.opening": "Åpner arbeidsområdet ditt…"
  ,"workspace10.openingDetail": "Indlæser inn den lagrede planen, utkastet, kildene og assistenthistorikken."
  ,"workspace10.unavailable": "Arbeidsområdet er utilgængelig"
  ,"workspace10.noObjective": "Ingen mål er lagt til ennå."
  ,"workspace10.area.plan": "Plan"
  ,"workspace10.area.work": "Arbeid"
  ,"workspace10.area.sources": "Kilder"
  ,"workspace10.area.assistant": "Assistent"
  ,"workspace10.plan": "Plan"
  ,"workspace10.plan.new": "Ny del"
  ,"workspace10.plan.rename": "Gi delen nytt navn"
  ,"workspace10.plan.remove": "Fjern"
  ,"workspace10.plan.add": "Tilføj en del"
  ,"workspace10.editor.heading": "Overskrift"
  ,"workspace10.editor.list": "Liste"
  ,"workspace10.editor.quote": "Sitat"
  ,"workspace10.editor.reference": "Referanse"
  ,"workspace10.editor.placeholder": "Begynn å skrive her…"
  ,"workspace10.editor.label": "Indhold i arbeidsområdet"
  ,"workspace10.save.idle": "Ikke ændret"
  ,"workspace10.save.dirty": "Endringene er ikke gemt ennå"
  ,"workspace10.save.saving": "Gemmer…"
  ,"workspace10.save.saved": "Gemt"
  ,"workspace10.save.error": "Lagringsfeil"
  ,"workspace10.save.offline": "Frakoblet – endringene beholdes på skjermen"
  ,"workspace10.saveNow": "Gem nå"
  ,"workspace10.conflict": "Dette arbeidsområdet ble ændret et annet sted. Indlæs inn på nytt før du gemmer igjen, slik at ingenting overskrives."
  ,"workspace10.sourcesEmpty": "Ingen kilde er vedlagt ennå."
  ,"workspace10.addSource": "Tilføj en kilde"
  ,"workspace10.assistant": "Second Brain-assistent"
  ,"workspace10.assistantDetail": "Kontekstuell hjælp til dette arbeidet. Utkastet ditt forblir hovedflaten."
  ,"workspace10.assist.explain": "Forklar"
  ,"workspace10.assist.challenge": "Utfordre"
  ,"workspace10.assist.suggest": "Foreslå"
  ,"workspace10.assist.structure": "Strukturer"
  ,"workspace10.assist.compare-sources": "Sammenlign kilder"
  ,"workspace10.assist.check-coherence": "Kontroller sammenheng"
  ,"workspace10.assist.rephrase": "Omformuler"
  ,"workspace10.selection": "Valgt utdrag"
  ,"workspace10.assistantQuestion": "Forespørsel"
  ,"workspace10.assistantPlaceholder": "Spør om det gjeldende arbeidet eller det valgte utdraget…"
  ,"workspace10.assistantSend": "Spør assistenten"
  ,"workspace10.next": "Neste beste handling"
  ,"workspace10.nextSection": "Fortsæt: {section}"
  ,"workspace10.nextSources": "Tilføj en kilde før du utvikler argumentet."
  ,"workspace10.continue": "Fortsæt å skrive"
  ,"workspace10.askTutor": "Spør professoren"
  ,"workspace10.research": "Start en undersøkelse"
  ,"languages11.eyebrow": "Sprog og fordypning"
  ,"languages11.title": "Språktreningen din"
  ,"languages11.description": "Ett målrettet område for samtale, ordforråd, forståelse, skriving og muntlig øving."
  ,"languages11.preferences": "Sprog"
  ,"languages11.goal.empty": "Tilføj et mål for å gjøre øvingen mer presis."
  ,"languages11.goal.label": "Læringsmål"
  ,"languages11.goal.placeholder": "Reise, eksamen, arbeid, samtale…"
  ,"languages11.level.title": "Niveauet ditt"
  ,"languages11.level.declared": "oppgitt nivå"
  ,"languages11.level.notEvaluated": "Dette niveauet er oppgitt av deg. Ingen vurdering har evaluert det ennå."
  ,"languages11.metric.words": "ord"
  ,"languages11.metric.due": "forfalt"
  ,"languages11.metric.sessions": "økter"
  ,"languages11.metric.lessons": "leksjoner"
  ,"languages11.lastActivity": "Siste aktivitet: {date}"
  ,"languages11.lastActivity.none": "Ingen aktivitet ennå."
  ,"languages11.nba.badge": "NESTE ØVELSE"
  ,"languages11.nba.start": "Start"
  ,"languages11.nba.review": "Repeter {count} ord"
  ,"languages11.nba.reasonDue": "Disse elementene har forfalt i henhold til FSRS-minneplanen din."
  ,"languages11.nba.firstConversation": "Start den første veiledede samtalen din"
  ,"languages11.nba.reasonStart": "En kort utveksling etablerer den første aktive øvingskonteksten din."
  ,"languages11.nba.lesson": "Bygg den første målrettede leksjonen din"
  ,"languages11.nba.reasonLesson": "Du har øvd, men ingen språkleksjon er opprettet ennå."
  ,"languages11.nba.conversation": "Fortsæt med en kort samtale"
  ,"languages11.nba.reasonPractice": "Regelmessig produksjon holder sproget aktivt."
  ,"languages11.resume.title": "Fortsæt en sprogøkt"
  ,"languages11.resume.action": "Fortsæt"
  ,"languages11.resume.empty": "Ingen avbrutt økt"
  ,"languages11.resume.emptyDetail": "Den neste meningsfulle øvelsen vises her når du har startet."
  ,"languages11.openSpace": "Åpne dette språkområdet"
  ,"languages11.empty.title": "Vælg et sprog for å begynde"
  ,"languages11.empty.detail": "Second Brain kobler sammen leksjoner, samtaler og faktiske FSRS-repetisjoner av ordforråd."
  ,"languages11.create.title": "Begynn å lære {language}"
  ,"languages11.create.action": "Opret språkområde"
  ,"languages11.other.title": "Andre sprog"
  ,"languages11.space.eyebrow": "Målrettet språkområde"
  ,"languages11.formats.title": "Øvingsformer"
  ,"languages11.formats.detail": "Vælg én aktivitet. Arbeidsområdet holder fokus på den."
  ,"languages11.practice.focused": "Én aktivitet om gangen, med niveauet og målet ditt bevart."
  ,"languages11.practice.conversation": "Samtale"
  ,"languages11.practice.vocabulary": "Ordforråd"
  ,"languages11.practice.grammar": "Grammatikk"
  ,"languages11.practice.conjugation": "Bøying"
  ,"languages11.practice.comprehension": "Forståelse"
  ,"languages11.practice.reading": "Lesing"
  ,"languages11.practice.writing": "Skriving"
  ,"languages11.practice.pronunciation": "Uttale"
  ,"languages11.practice.oral": "Muntlig"
  ,"languages11.practice.quiz": "Quiz"
  ,"languages11.conversation.detail": "Den samme AI-professoren tilpasser andelen målspråk og rettingene til denne økten."
  ,"languages11.conversation.start": "Start samtale"
  ,"languages11.oral.detail": "Snakk med den samme professoren. Transkripsjonen forblir synlig og kan redigeres før den sendes."
  ,"languages11.oral.start": "Start muntlig øving"
  ,"languages11.scenario.label": "Scenario"
  ,"languages11.scenario.placeholder": "På apoteket, jobbintervju, hverdagsliv…"
  ,"languages11.immersion.title": "Fordypning"
  ,"languages11.immersion.guided": "Veiledet"
  ,"languages11.immersion.mixed": "Blandet"
  ,"languages11.immersion.full": "Full"
  ,"languages11.correction.title": "Rettinger"
  ,"languages11.correction.light": "Lette"
  ,"languages11.correction.balanced": "Balanserte"
  ,"languages11.correction.detailed": "Detaljerte"
  ,"languages11.generate": "Lag øvelse"
  ,"languages11.quiz.detail": "Repeter forfalt ordforråd med den eksisterende FSRS-minnemotoren."
  ,"languages11.quiz.action": "Åpne språkrepetisjon"
  ,"languages11.review.return": "Tilbage til sproget"
  ,"languages11.reading.history": "Åpne lesehistorikk"
  ,"languages11.writing.workspace": "Åpne hele skriveområdet"
  ,"languages11.writing.instruction": "Skriv på {language}."
  ,"languages11.offline.title": "Tale og AI er utilgængelig uten nett"
  ,"languages11.offline.detail": "Det lokale utkastet ditt er bevart. Koble til igjen før du transkriberer eller spør professoren."
  ,"rlle.ui.hub.learn": "Lær {language}"
  ,"rlle.ui.hub.resume": "Fortsæt kurset mitt i {language}"
  ,"rlle.ui.hub.courseDetail": "Et strukturert, adaptivt CEFR-kurs bygget rundt det du trenger å gjøre i virkelige situasjoner."
  ,"rlle.ui.hub.openCourse": "Åpne kurset mitt"
  ,"rlle.ui.hub.courseUnavailable": "Kurstjenesten er ikke tilgængelig ennå. Øvingsverktøyene dine er fortsatt tilgængelige."
  ,"rlle.ui.course.eyebrow": "SPRÅKMOTOR FOR VIRKELIGE SITUASJONER"
  ,"rlle.ui.course.title": "Kurs i {language}"
  ,"rlle.ui.course.subtitle": "Lær trinnvis, og vis deretter hvad du kan i virkelige situasjoner."
  ,"rlle.ui.course.loading": "Indlæser inn kurset ditt…"
  ,"rlle.ui.course.notStarted": "Bygg kurset mitt"
  ,"rlle.ui.course.notStartedDetail": "Vælg utgangspunkt og mål i den virkelige verden. Grunnleggende ferdigheter fjernes aldri."
  ,"rlle.ui.course.startZero": "Start fra bunnen"
  ,"rlle.ui.course.startDeclared": "Start på det oppgitte niveauet mitt"
  ,"rlle.ui.course.declaredWarning": "{level} er et oppgitt nivå, ikke et vurdert resultat."
  ,"rlle.ui.course.targetLevel": "Målnivå"
  ,"rlle.ui.course.goalDomain": "Prioritet i virkelige situasjoner"
  ,"rlle.ui.course.goal.general": "Generelt"
  ,"rlle.ui.course.goal.travel": "Reise"
  ,"rlle.ui.course.goal.work": "Arbeid"
  ,"rlle.ui.course.goal.studies": "Studier"
  ,"rlle.ui.course.goal.social": "Sosialt liv"
  ,"rlle.ui.course.start": "Start kurset mitt"
  ,"rlle.ui.course.resume": "Fortsæt kurset mitt"
  ,"rlle.ui.course.pause": "Sett kurset på pause"
  ,"rlle.ui.course.current": "Fortsæt gjeldende leksjon"
  ,"rlle.ui.course.curriculum": "CEFR-læringsløp"
  ,"rlle.ui.course.curriculumDetail": "Målenhetene prioriteres uten at det oppstår hull i læringsløpet."
  ,"rlle.ui.course.goalPriority": "Målet ditt"
  ,"rlle.ui.course.core": "Grunnlag"
  ,"rlle.ui.course.unit.open": "Åpne enheden"
  ,"rlle.ui.course.status.locked": "Låst"
  ,"rlle.ui.course.status.available": "Tilgængelig"
  ,"rlle.ui.course.status.in-progress": "I gang"
  ,"rlle.ui.course.status.completed": "Fullført"
  ,"rlle.ui.course.status.untracked": "Ikke startet"
  ,"rlle.ui.course.progress": "Målt fremgang"
  ,"rlle.ui.course.progressUnits": "{done} av {total} enheter fullført"
  ,"rlle.ui.course.progressUnknown": "Ingen målt kursfremgang ennå."
  ,"rlle.ui.course.lastActivity": "Siste aktivitet: {date}"
  ,"rlle.ui.course.noActivity": "Ingen kursaktivitet ennå"
  ,"rlle.ui.course.levels": "CEFR-niveauer"
  ,"rlle.ui.course.level.declared": "Oppgitt"
  ,"rlle.ui.course.level.estimated": "Beregnet"
  ,"rlle.ui.course.level.evaluated": "Vurdert"
  ,"rlle.ui.course.level.target": "Mål"
  ,"rlle.ui.course.notEvaluated": "Ikke vurdert"
  ,"rlle.ui.course.dimensions": "Ferdigheter målt med dokumentasjon"
  ,"rlle.ui.course.evidenceCount": "{count} dokumentasjonselement(er)"
  ,"rlle.ui.course.review": "Repeter dette sproget"
  ,"rlle.ui.course.brain": "Se språkkunnskap i Hjernen min"
  ,"rlle.ui.course.professor": "Spør professoren"
  ,"rlle.ui.course.offline": "Den nyeste kurstilstanden kunne ikke oppdateres."
  ,"rlle.ui.course.preferences.title": "Kursinnstillinger"
  ,"rlle.ui.course.preferences.detail": "Tilpass fordypning og styrken på rettingene uten å miste fremgangen din."
  ,"rlle.ui.course.preferences.save": "Gem indstillinger"
  ,"rlle.ui.course.preferences.saved": "Kursinnstillingene er gemt."
  ,"rlle.ui.course.preferences.error": "Innstillingene kunne ikke lagres."
  ,"rlle.ui.review.returnCourse": "Tilbage til kurset mitt"
  ,"rlle.ui.brain.evidenceTitle": "Målte språkferdigheter"
  ,"rlle.ui.brain.evidenceDetail": "Bare observert dokumentasjon fra dette språkkurset vises her."
  ,"rlle.ui.brain.backCourse": "Åpne språkkurset"
  ,"rlle.ui.lesson.eyebrow": "STRUKTURERT LEKSJON"
  ,"rlle.ui.lesson.title": "Leksjon"
  ,"rlle.ui.lesson.intro": "Kommunikativt mål"
  ,"rlle.ui.lesson.start": "Start denne leksjonen"
  ,"rlle.ui.lesson.resume": "Fortsæt denne leksjonen"
  ,"rlle.ui.lesson.complete": "Gennemfør leksjonen"
  ,"rlle.ui.lesson.completeStage": "Gennemfør dette steget"
  ,"rlle.ui.lesson.completed": "Leksjonen er fullført. Funksjonelle ferdigheter krever fortsatt reelt grunnlag."
  ,"rlle.ui.lesson.openGenerated": "Åpne leksjonsinnhold"
  ,"rlle.ui.lesson.path": "Leksjonsrekkefølge"
  ,"rlle.ui.lesson.stageAction": "Øv på dette steget"
  ,"rlle.ui.lesson.noActive": "Denne enheden har ingen aktiv leksjon ennå."
  ,"rlle.ui.lesson.proofNote": "Å fullføre en leksjon validerer aldri en Kan-gjøre-ferdighet alene."
  ,"rlle.ui.mission.eyebrow": "VERDENSOPPDRAG"
  ,"rlle.ui.mission.title": "Oppdrag fra virkeligheten"
  ,"rlle.ui.mission.subtitle": "Utfør en kommunikativ opgave med professoren. Suksess krever observert dokumentasjon, ikke en quizpoengsum."
  ,"rlle.ui.mission.start": "Start oppdrag"
  ,"rlle.ui.mission.resume": "Fortsæt oppdrag"
  ,"rlle.ui.mission.minimum": "Fra {level}"
  ,"rlle.ui.mission.survival": "Grunnleggende kommunikasjonsferdigheter"
  ,"rlle.ui.mission.notAvailable": "Oppdragssporing er ennå ikke tilgængelig fra serveren."
  ,"rlle.ui.mission.dynamic": "Professoren reagerer på de virkelige svarene dine og kontrollerer om oppgaven ble utført."
  ,"rlle.ui.mission.all": "Alle"
  ,"rlle.ui.cando.eyebrow": "KAN-GJØRE-KART"
  ,"rlle.ui.cando.title": "Det jeg virkelig kan gjøre"
  ,"rlle.ui.cando.subtitle": "En ferdighet valideres bare av et vellykket oppdrag, en vurdering eller en kontrollert aktivitet."
  ,"rlle.ui.cando.open": "Åpne Kan-gjøre-kartet mitt"
  ,"rlle.ui.cando.status.not-evaluated": "Ikke vurdert"
  ,"rlle.ui.cando.status.in-progress": "Grunnlag under oppbygging"
  ,"rlle.ui.cando.status.validated": "Dokumentert"
  ,"rlle.ui.cando.evidence": "Dokumentasjon"
  ,"rlle.ui.cando.noEvidence": "Ingen observert dokumentasjon ennå."
  ,"rlle.ui.cando.source.mission": "Verdensoppdrag"
  ,"rlle.ui.cando.source.assessment": "Vurdering"
  ,"rlle.ui.cando.source.controlled-activity": "Kontrollert aktivitet"
  ,"rlle.ui.recovery.title": "Målrettet utbedring"
  ,"rlle.ui.recovery.subtitle": "Bare vanskeligheter som faktisk er observert under aktiviteter, vises her."
  ,"rlle.ui.recovery.empty": "Ingen bekreftede vanskeligheter å rette opp."
  ,"rlle.ui.recovery.gaps": "Funksjonelle mangler"
  ,"rlle.ui.recovery.mistakes": "Feilminne"
  ,"rlle.ui.recovery.repair": "Rettingssløyfe"
  ,"rlle.ui.recovery.occurrences": "{count} observert(e) forekomst(er)"
  ,"rlle.ui.recovery.next": "Gjeldende rettingssteg: {stage}"
  ,"rlle.ui.common.retry": "Prøv igjen"
  ,"rlle.ui.common.backCourse": "Tilbage til kurset"
  ,"rlle.ui.common.error": "Kurset kunne ikke lastes inn."
  ,"rlle.ui.category.travel": "Reise"
  ,"rlle.ui.category.work": "Arbeid"
  ,"rlle.ui.category.studies": "Studier"
  ,"rlle.ui.category.social": "Sosialt liv"
  ,"rlle.ui.dimension.vocabulary": "Ordforråd"
  ,"rlle.ui.dimension.grammar": "Grammatikk"
  ,"rlle.ui.dimension.conversation": "Samtale"
  ,"rlle.ui.dimension.listening": "Lytteforståelse"
  ,"rlle.ui.dimension.reading": "Lesing"
  ,"rlle.ui.dimension.writing": "Skriving"
  ,"rlle.ui.dimension.interaction": "Samhandling"
  ,"rlle.ui.dimension.pronunciation": "Uttale"
  ,"rlle.ui.dimension.mediation": "Formidling"
  ,"rlle.ui.dimension.status.not-evaluated": "Ikke vurdert"
  ,"rlle.ui.dimension.status.emerging": "Under udvikling"
  ,"rlle.ui.dimension.status.demonstrated": "Dokumentert"
  ,"rlle.ui.dimension.status.consistent": "Stabil"
  ,"rlle.ui.strand.vocabulary": "Ordforråd"
  ,"rlle.ui.strand.verbs": "Verb"
  ,"rlle.ui.strand.conjugation": "Bøying"
  ,"rlle.ui.strand.grammar": "Grammatikk"
  ,"rlle.ui.strand.listening": "Lytteforståelse"
  ,"rlle.ui.strand.reading": "Lesing"
  ,"rlle.ui.strand.conversation": "Samtale"
  ,"rlle.ui.strand.interaction": "Samhandling"
  ,"rlle.ui.strand.pronunciation": "Uttale"
  ,"rlle.ui.strand.writing": "Skriving"
  ,"rlle.ui.strand.mediation": "Formidling"
  ,"rlle.ui.stage.communicative-objective": "Kommunikativt mål"
  ,"rlle.ui.stage.vocabulary": "Ordforråd i sammenheng"
  ,"rlle.ui.stage.grammar-verbs": "Grammatikk og verb"
  ,"rlle.ui.stage.example": "Modelleksempel"
  ,"rlle.ui.stage.comprehension": "Forståelse"
  ,"rlle.ui.stage.practice": "Veiledet øving"
  ,"rlle.ui.stage.oral": "Snakk først"
  ,"rlle.ui.stage.writing": "Skriving"
  ,"rlle.ui.stage.verification": "Kontroll"
  ,"rlle.ui.stage.review": "Minnerepetisjon"
  ,"rlle.ui.stage.status.pending": "Resterer"
  ,"rlle.ui.stage.status.active": "Nå"
  ,"rlle.ui.stage.status.completed": "Færdig"
  ,"rlle.ui.stage.status.skipped": "Ikke nødvendig"
  ,"rlle.ui.repair.explain": "Forklaring"
  ,"rlle.ui.repair.guided-practice": "Veiledet øving"
  ,"rlle.ui.repair.retry-now": "Prøv igjen nå"
  ,"rlle.ui.repair.reuse-later": "Brug igjen senere"
  ,"rlle.ui.repair.consolidate": "Styrk i Repetisjon"
  ,"rlle.ui.survival.ask-repeat": "Be nogen gjenta"
  ,"rlle.ui.survival.ask-slow-down": "Be nogen snakke saktere"
  ,"rlle.ui.survival.ask-definition": "Be om en definisjon"
  ,"rlle.ui.survival.rephrase": "Omformuler"
  ,"rlle.ui.survival.check-understanding": "Kontroller forståelsen"
  ,"rlle.ui.survival.explain-unknown-word": "Forklar et ukjent ord"
  ,"rlle.ui.survival.buy-thinking-time": "Skaff deg tid til å svare"
  ,"rlle.unit.a1FirstContact": "Første kontakt"
  ,"rlle.objective.a1FirstContact": "Presenter deg selv og utveksle grunnleggende personopplysninger."
  ,"rlle.unit.a1DailyNeeds": "Det viktigste i hverdagen"
  ,"rlle.objective.a1DailyNeeds": "Håndter enkle daglige behov med nyttige ord og grunnleggende former."
  ,"rlle.unit.a1Survival": "Overlevelsespakke for kommunikasjon"
  ,"rlle.objective.a1Survival": "Hold samtalen i gang selv om du ikke forstår alt."
  ,"rlle.unit.a2Routines": "Rutiner og planer"
  ,"rlle.objective.a2Routines": "Beskriv vaner, aktiviteter og enkle fremtidsplaner."
  ,"rlle.unit.a2PastPlans": "Tidligere erfaringer"
  ,"rlle.objective.a2PastPlans": "Fortell en enkel historie og knytt sammen tidligere hendelser."
  ,"rlle.unit.a2TravelStudy": "Det viktigste for reise og studier"
  ,"rlle.objective.a2TravelStudy": "Finn informasjon og utfør vanlige opgaver på reise eller i studier."
  ,"rlle.unit.b1Experiences": "Fortell historien din"
  ,"rlle.objective.b1Experiences": "Beskriv erfaringer med tydelig kronologi og nyttige detaljer."
  ,"rlle.unit.b1WorkTravel": "Handle selvstendig"
  ,"rlle.objective.b1WorkTravel": "Håndter vanlige arbeids- og reisesituasjoner uten manus."
  ,"rlle.unit.b1Opinions": "Forklar en mening"
  ,"rlle.objective.b1Opinions": "Forstå et synspunkt og forsvar ditt eget med begrunnelser."
  ,"rlle.unit.b2Collaboration": "Samarbeid med god flyt"
  ,"rlle.objective.b2Collaboration": "Delta aktivt i møter, diskusjoner og presentasjoner."
  ,"rlle.unit.b2Argument": "Bygg et argument"
  ,"rlle.objective.b2Argument": "Sammenlign standpunkter, nyanser påstander og strukturer et overbevisende svar."
  ,"rlle.unit.b2Professional": "Profesjonell produksjon"
  ,"rlle.objective.b2Professional": "Skriv og snakk med registeret som forventes i profesjonelle sammenhenger."
  ,"rlle.unit.c1ComplexInput": "Forstå komplekst indhold"
  ,"rlle.objective.c1ComplexInput": "Hent ut, knytt sammen og omformuler ideer fra krevende materiale."
  ,"rlle.unit.c1Influence": "Påvirk og forhandle"
  ,"rlle.objective.c1Influence": "Tilpass sproget presist for å overbevise, samarbeide og løse uenighet."
  ,"rlle.unit.c1Production": "Produser presist"
  ,"rlle.objective.c1Production": "Lag tydelig og nyansert arbeid for akademiske og profesjonelle målgrupper."
  ,"rlle.unit.c2Nuance": "Nyanser og underforstått mening"
  ,"rlle.objective.c2Nuance": "Forstå fine forskjeller, register og underforstått mening."
  ,"rlle.unit.c2Adaptation": "Tilpass i sanntid"
  ,"rlle.objective.c2Adaptation": "Formidle og omformuler naturlig for ulike målgrupper og situasjoner."
  ,"rlle.unit.c2Mastery": "Integrert mestring"
  ,"rlle.objective.c2Mastery": "Kombiner alle ferdigheter med presisjon, fleksibilitet og kommunikativ kontroll."
  ,"rlle.mission.travelAirport": "Finn frem på flyplassen"
  ,"rlle.missionObjective.travelAirport": "Forstå instruksjoner og finn riktig utgang."
  ,"rlle.mission.travelHotel": "Løs et problem på hotellet"
  ,"rlle.missionObjective.travelHotel": "Forklar et problem og bli enige om en praktisk løsning."
  ,"rlle.mission.travelRestaurant": "Bestill på restaurant"
  ,"rlle.missionObjective.travelRestaurant": "Spør om menyen og legg inn en passende bestilling."
  ,"rlle.mission.travelTransport": "Brug lokaltransport"
  ,"rlle.missionObjective.travelTransport": "Spør etter en rute, forstå alternativene og bekreft reisemålet ditt."
  ,"rlle.mission.travelDirections": "Spør om veien"
  ,"rlle.missionObjective.travelDirections": "Spør hvor du skal gå, og kontroller at du forstod."
  ,"rlle.mission.travelEmergency": "Håndter en nødsituasjon"
  ,"rlle.missionObjective.travelEmergency": "Beskriv et akutt problem og forstå den neste instruksjonen."
  ,"rlle.mission.workInterview": "Gjennomfør et jobbintervju"
  ,"rlle.missionObjective.workInterview": "Presenter erfaringen din og svar naturlig på oppfølgingsspørsmål."
  ,"rlle.mission.workMeeting": "Delta i et møde"
  ,"rlle.missionObjective.workMeeting": "Følg diskusjonen, bidra med en idé og avklar en handling."
  ,"rlle.mission.workPresentation": "Presenter et prosjekt"
  ,"rlle.missionObjective.workPresentation": "Forklar et prosjekt tydelig og svar på spørgsmål."
  ,"rlle.mission.workEmail": "Skriv en profesjonell e-post"
  ,"rlle.missionObjective.workEmail": "Skriv en kortfattet melding med riktig tone og en tydelig forespørsel."
  ,"rlle.mission.workNegotiation": "Forhandle frem en avtale"
  ,"rlle.missionObjective.workNegotiation": "Formuler prioriteringer, reager på innvendinger og kom frem til et kompromiss."
  ,"rlle.mission.studiesLecture": "Følg en forelesning"
  ,"rlle.missionObjective.studiesLecture": "Finn hovedideene og forklar dem på en enklere måte."
  ,"rlle.mission.studiesSynthesis": "Sammenfatt komplekse kilder"
  ,"rlle.missionObjective.studiesSynthesis": "Knytt sammen krevende muntlig og skriftlig indhold, og formidle det deretter presist."
  ,"rlle.mission.studiesPresentation": "Hold en akademisk presentasjon"
  ,"rlle.missionObjective.studiesPresentation": "Strukturer en forklaring og svar på spørgsmål fra publikum."
  ,"rlle.mission.studiesDiscussion": "Delta i en klassediskusjon"
  ,"rlle.missionObjective.studiesDiscussion": "Bygg videre på en annens idé og begrunn bidraget ditt."
  ,"rlle.mission.studiesTeacher": "Snakk med en lærer"
  ,"rlle.missionObjective.studiesTeacher": "Be om en avklaring og bekreft hvad som forventes."
  ,"rlle.mission.studiesAdministration": "Håndter administrative opgaver"
  ,"rlle.missionObjective.studiesAdministration": "Forstå en prosedyre og be om informasjonen du trenger."
  ,"rlle.mission.socialIntroduction": "Presenter deg selv"
  ,"rlle.missionObjective.socialIntroduction": "Start en hyggelig samtale og del grunnleggende opplysninger."
  ,"rlle.mission.socialChat": "Hold en samtale i gang"
  ,"rlle.missionObjective.socialChat": "Reager, still et oppfølgingsspørsmål og oppklar misforståelser."
  ,"rlle.mission.socialStory": "Fortell en historie"
  ,"rlle.missionObjective.socialStory": "Fortell om hendelser i tydelig rekkefølge og hold på lytterens interesse."
  ,"rlle.mission.socialInvitation": "Inviter nogen"
  ,"rlle.missionObjective.socialInvitation": "Foreslå en plan, snakk om detaljene og svar høflig."
  ,"rlle.mission.socialDebate": "Diskuter en idé"
  ,"rlle.missionObjective.socialDebate": "Forsvar et standpunkt samtidig som du svarer på et annet synspunkt."
  ,"rlle.canDo.travelOrder": "Bestille på en restaurant"
  ,"rlle.canDo.travelDirections": "Spørre om og forstå veibeskrivelser"
  ,"rlle.canDo.travelHotelProblem": "Forklare et problem på et hotell"
  ,"rlle.canDo.travelTransport": "Planlegge en reise med lokaltransport"
  ,"rlle.canDo.travelEmergency": "Forklare et akutt problem"
  ,"rlle.canDo.workInterview": "Presentere meg selv i et jobbintervju"
  ,"rlle.canDo.workMeeting": "Delta i et møde"
  ,"rlle.canDo.workPresent": "Presentere et prosjekt"
  ,"rlle.canDo.workEmail": "Skrive en profesjonell e-post"
  ,"rlle.canDo.workNegotiate": "Forhandle frem en avtale"
  ,"rlle.canDo.studiesRequest": "Be om faglig eller administrativ hjælp"
  ,"rlle.canDo.studiesFollowLecture": "Følge en forelesning og finne hovedideene"
  ,"rlle.canDo.studiesDiscuss": "Delta i en klassediskusjon"
  ,"rlle.canDo.studiesPresent": "Holde en akademisk presentasjon"
  ,"rlle.canDo.studiesSynthesise": "Oppsummere og forklare kompleks informasjon"
  ,"rlle.canDo.socialIntroduce": "Presentere meg selv naturlig"
  ,"rlle.canDo.socialClarify": "Oppklare en misforståelse"
  ,"rlle.canDo.socialInvite": "Invitere nogen og avtale detaljene"
  ,"rlle.canDo.socialTellStory": "Fortelle om en tidligere oplevelse"
  ,"rlle.canDo.socialDefendOpinion": "Forsvare en mening med begrunnelser"
  ,"rlle.demo.objectiveInternationalWork": "Jobbe internasjonalt"
  ,"rlle.ui.badge": "STRUKTURERT KURS"
  ,"rlle.ui.cefr": "CEFR"
  ,"rlle.ui.nba.badge": "NESTE SPRÅKHANDLING"
  ,"rlle.ui.nba.review": "Repeter {count} språkoppføringer som har forfalt"
  ,"rlle.ui.nba.reviewReason": "{count} faktiske FSRS-oppføringer har forfalt nå."
  ,"rlle.ui.nba.reviewAction": "Repeter nå"
  ,"rlle.ui.nba.retryMission": "Prøv den virkelige oppgaven på nytt"
  ,"rlle.ui.nba.retryMissionReason": "En observert vanskelighet har en mikroleksjon og er klar for et nytt forsøk."
  ,"rlle.ui.nba.resumeMission": "Fortsæt verdensoppdraget"
  ,"rlle.ui.nba.resumeMissionReason": "Dette virkelighetsnære oppdraget er fortsatt aktivt."
  ,"rlle.ui.nba.resumeLesson": "Fortsæt språkleksjonen"
  ,"rlle.ui.nba.resumeLessonReason": "Et trinn i en strukturert leksjon er fortsatt aktivt."
  ,"rlle.ui.nba.nextLesson": "Fortsæt det strukturerte kurset"
  ,"rlle.ui.nba.nextLessonReason": "Dette er den neste ufullførte enheden i CEFR-læreplanen."
  ,"rlle.ui.nba.nextLessonAction": "Start neste leksjon"
  ,"rlle.ui.course.status.paused": "Satt på pause"
  ,"rlle.ui.course.status.not-started": "Ikke startet"
  ,"rlle.ui.mission.category": "Oppdragskategori"
  ,"rlle.ui.mission.modality": "Øvingsmodus"
  ,"rlle.ui.mission.current": "Oppdrag i gang"
  ,"rlle.ui.mission.starting": "Starter oppdraget…"
  ,"rlle.ui.mission.status.active": "I gang"
  ,"rlle.ui.mission.status.paused": "Satt på pause"
  ,"rlle.ui.mission.status.succeeded": "Fullført"
  ,"rlle.ui.mission.status.needs-retry": "Prøv igjen"
  ,"rlle.ui.mission.feedback.succeeded": "Oppdraget er fullført med observert dokumentasjon."
  ,"rlle.ui.mission.feedback.repair": "En bestemt vanskelighet ble oppdaget. Brug mikroleksjonen, og prøv deretter igjen."
  ,"rlle.ui.mission.feedback.proof": "KOMMUNIKATIV DOKUMENTASJON"
  ,"rlle.ui.mission.feedback.microLesson": "MIKROLEKSJON"
  ,"rlle.ui.mission.feedback.example": "Eksempel"
  ,"rlle.ui.modality.text": "Skriv"
  ,"rlle.ui.modality.voice": "Snakk"
  ,"rlle.ui.modality.mixed": "Skriv og snakk"
  ,"rlle.ui.cando.notAvailable": "Kan-gjøre-kartet er ennå ikke tilgængelig fra serveren."
  ,"rlle.ui.cando.all": "Alle ferdigheter"
  ,"rlle.ui.cando.summary": "Bare observert dokumentasjon kan bekrefte en ferdighet."
  ,"rlle.ui.cando.validatedCount": "{count} demonstrert"
  ,"rlle.ui.cando.measuredCount": "{count} vurdert"
  ,"rlle.ui.gap.status.observed": "Observert én gang"
  ,"rlle.ui.gap.status.repeated": "Observert igjen"
  ,"rlle.ui.gap.status.confirmed": "Bekreftet"
  ,"rlle.ui.gap.status.repairing": "Under utbedring"
  ,"rlle.ui.gap.status.consolidated": "Konsolidert"
  ,"rlle.ui.dimension.conjugation": "Bøying"
  ,"rlle.ui.dimension.fluency": "Flyt"
  ,"rlle.ui.dimension.formulation": "Formulering"
  ,"tutor6.state.paused": "Opptaket er satt på pause"
  ,"scan.openDocument": "Åpne dokumentintelligens"
  ,"scan.captured": "Sidene er gemt sikkert"
  ,"scan.capturedDetail": "Skanningen er bevart. Tekstanalyse blir tilgængelig når en autorisert Vision-leverandør er aktiv."
  ,"sub.usageAction": "Se brug og kvoter"
  ,"sub.availablePlans": "Individuelle abonnementer"
  ,"sub.availablePlansDetail": "Sammenlign grensene som er konfigurert for hvert tilgængelige tilbud."
  ,"sub.notAvailable": "Ikke tilgængelig for øyeblikket"
  ,"sub.periodEnd": "Gjeldende periode avsluttes"
  ,"sub.trialEnds": "Prøveperioden avsluttes"
  ,"sub.openInvoice": "Åpne faktura"
  ,"sub.upgrade": "Oppgrader til"
  ,"sub.partial": "Nogen faktureringsopplysninger er midlertidig utilgængelige. Ingen eksisterende abonnementer er ændret."
  ,"usage.loading": "Indlæser inn bruken din…"
  ,"usage.remaining": "Resterer"
  ,"usage.reset": "Tilbakestilles"
  ,"usage.mb": "MB"
  ,"usage.kb": "KB"
  ,"usage.managePlan": "Administrer abonnement"
  ,"usage.currentPlan": "Gjeldende abonnement"
  ,"usage.planUnavailable": "Abonnementsinformasjon er midlertidig utilgængelig."
  ,"usage.limitReached": "En abonnementsgrense er nået"
  ,"usage.limitResetKnown": "Denne telleren blir tilgængelig igjen {date}."
  ,"usage.limitNoReset": "Denne grensen gjenspeiler gjeldende brug. Frigjør kapasitet eller skift abonnement for å fortsætte med denne handlingen."
  ,"usage.nonAiAvailable": "Resten av Second Brain er fortsatt tilgængelig, inkludert funksjoner som ikke bruger denne kvoten."
  ,"usage.partial": "Noget informasjon om abonnement eller brug kunne ikke oppdateres. Verdiene som vises, er de sist tilgængelige."
  ,"priv.controls": "Tilknyttede kontroller"
  ,"priv.memory": "AI-minne"
  ,"priv.memoryHelp": "Se gennem hvad Second Brain husker, og kontrollene som er knyttet til dette minnet."
  ,"priv.documents": "Dokumenter og kilder"
  ,"priv.documentsHelp": "Se gennem kildene du har importert til biblioteket ditt."
  ,"landing.nav.menu": "Meny"
  ,"landing12.seo.title": "Second Brain – ditt personlige intelligente læringssystem"
  ,"landing12.seo.description": "Lær, forstå, øv, husk og skap med ett sammenkoblet læringssystem: dokumentene dine, AI-professoren, den kognitive tvillingen, repetisjon, forskning, sprog og arbeidsområdet."
  ,"landing12.brand": "Second Brain"
  ,"landing12.signature": "Ett produkt. Én oplevelse."
  ,"landing12.nav.product": "Produkt"
  ,"landing12.nav.how": "Slik fungerer det"
  ,"landing12.nav.languages": "Sprog"
  ,"landing12.nav.pricing": "Priser"
  ,"landing12.nav.download": "Indlæs ned"
  ,"landing12.nav.faq": "Vanlige spørgsmål"
  ,"landing12.nav.contact": "Kontakt"
  ,"landing12.nav.menu": "Åpne navigasjonen"
  ,"landing12.nav.close": "Luk navigasjonen"
  ,"landing12.cta.signin": "Logg inn"
  ,"landing12.cta.start": "Kom i gang gratis"
  ,"landing12.cta.startShort": "Kom i gang"
  ,"landing12.cta.how": "Se hvordan det fungerer"
  ,"landing12.cta.download": "Indlæs ned Second Brain"
  ,"landing12.cta.language": "Lær et sprog"
  ,"landing12.cta.next": "Neste trinn"
  ,"landing12.cta.restart": "Spill av reisen på nytt"
  ,"landing12.demo.label": "Produktdemonstrasjon"
  ,"landing12.demo.disclaimer": "Statisk offentlig eksempel. Ingen ekte brukerdata og ingen simulert behandling."
  ,"landing12.hero.eyebrow": "Et personlig intelligent læringssystem"
  ,"landing12.hero.title": "Lær. Forstå. Øv. Husk. Gjør fremskritt."
  ,"landing12.hero.subtitle": "Gi Second Brain et spørgsmål, et dokument eller et mål. Systemet bygger konteksten, underviser deg, hjælper deg med å øve, konsoliderer det som betyr noget, og foreslår hvad du bør gjøre videre."
  ,"landing12.hero.availability": "Tilgængelig på nettet · mobil- og skrivebordsapper er under udvikling"
  ,"landing12.hero.scene.product": "SECOND BRAIN · ÉN KONTEKST"
  ,"landing12.hero.scene.tabsLabel": "Trinn i produktdemonstrasjonen"
  ,"landing12.hero.scene.question.tab": "Intensjon"
  ,"landing12.hero.scene.context.tab": "Kontekst"
  ,"landing12.hero.scene.teaching.tab": "Oplevelse"
  ,"landing12.hero.scene.next.tab": "Neste handling"
  ,"landing12.hero.scene.question.title": "Hvad vil du forstå?"
  ,"landing12.hero.scene.question.message": "Hjælp meg å forstå celleånding til eksamen."
  ,"landing12.hero.scene.question.intent": "Forstå"
  ,"landing12.hero.scene.question.source": "Biologikurs.pdf"
  ,"landing12.hero.scene.context.title": "Second Brain samler den nyttige konteksten"
  ,"landing12.hero.scene.context.brain": "Hjernen min"
  ,"landing12.hero.scene.context.document": "Biologikurs.pdf"
  ,"landing12.hero.scene.context.goal": "Eksamensmål"
  ,"landing12.hero.scene.context.concept": "Celleånding"
  ,"landing12.hero.scene.context.fragile": "Begrep som må konsolideres"
  ,"landing12.hero.scene.teaching.title": "AI-professor"
  ,"landing12.hero.scene.teaching.message": "La oss knytte sammen glukose, oksygen og ATP, og deretter kontrollere ideen med ett spørgsmål."
  ,"landing12.hero.scene.teaching.explain": "Forklaring"
  ,"landing12.hero.scene.teaching.practice": "Øving"
  ,"landing12.hero.scene.teaching.voice": "Tale"
  ,"landing12.hero.scene.next.title": "Neste beste handling"
  ,"landing12.hero.scene.next.action": "Konsolider celleånding"
  ,"landing12.hero.scene.next.reason": "Foreslått fordi dette begrepet er knyttet til eksamensmålet ditt og fortsatt trenger øving."
  ,"landing12.hero.scene.next.context": "Begrunnelse synlig · målet bevart"
  ,"landing12.story.kicker": "Ett produkt, én oplevelse"
  ,"landing12.story.title": "Se viden bevege seg gennem hele systemet"
  ,"landing12.story.lead": "En kilde stopper ikke ved lagring. Denne demonstrasjonen følger den samme konteksten fra et dokument til forståelse, øving, repetisjon og akademisk produksjon."
  ,"landing12.story.documents.title": "Et dokument blir til anvendelig viden"
  ,"landing12.story.documents.short": "Dokumenter"
  ,"landing12.story.documents.desc": "Biblioteket mottar kilden. Dokumentintelligens leser den, trekker ut begreper og forbereder kildebaserte spørgsmål uten å finne opp fremgang."
  ,"landing12.story.brain.title": "Begreper blir del av et sammenkoblet kognitivt kart"
  ,"landing12.story.brain.short": "Hjernen min"
  ,"landing12.story.brain.desc": "Den kognitive tvillingen synliggjør begreper, relasjoner, styrker og svagheder. Dette offentlige eksemplet er illustrerende, ikke en ekte elevpoengsum."
  ,"landing12.story.professor.title": "Professoren underviser ut fra den samme konteksten"
  ,"landing12.story.professor.short": "AI-professor"
  ,"landing12.story.professor.desc": "Dokumentet, målbegrepet og læringsmålet følger økten. Oplevelsen kan bli en forklaring, leksjon, et spørgsmål eller veiledet øving."
  ,"landing12.story.oral.title": "Forståelse blir til muntlig øving"
  ,"landing12.story.oral.short": "Muntlig og tale"
  ,"landing12.story.oral.desc": "Lytting, transskription og svar er separate, lesbare tilstander. Transkripsjonen forblir synlig; ingen dekorativ lydbølge later som den måler talen."
  ,"landing12.story.review.title": "En usikker idé blir til en repetisjon"
  ,"landing12.story.review.short": "Repetisjon"
  ,"landing12.story.review.desc": "Repetisjonsmotoren konsoliderer viden til riktig tid. Datoen som vises her, er uttrykkelig en demonstrasjon, ikke en ekte tidsplan."
  ,"landing12.story.workspace.title": "Viden blir til et arbeid"
  ,"landing12.story.workspace.short": "Arbeidsområde"
  ,"landing12.story.workspace.desc": "Det akademiske arbeidsområdet holder planen, teksten, kildene og sitatene samlet, mens den kontekstuelle assistenten støtter elevens eget arbeid."
  ,"landing12.story.sharedContext": "Felles kontekst"
  ,"landing12.story.traceability": "Sporbarhet til kilden"
  ,"landing12.story.outcome": "Jeg gir informasjon → Second Brain forstår den → underviser meg → hjælper meg å øve → hjælper meg å huske → hjælper meg å bruke den."
  ,"landing12.story.nba": "Deretter foreslår systemet en tydelig handling som kan forklares, i stedet for å etterlate meg på et instrumentpanel."
  ,"landing12.story.file": "Biologikurs.pdf"
  ,"landing12.story.fileType": "Demonstrasjonsdokument · PDF"
  ,"landing12.story.readyDemo": "Eksempelet er klart"
  ,"landing12.story.pipeline.import": "Kilden er importert"
  ,"landing12.story.pipeline.read": "Lesbart indhold er fundet"
  ,"landing12.story.pipeline.concepts": "Begreper er trukket ut"
  ,"landing12.story.pipeline.connect": "Forbindelser er klargjort"
  ,"landing12.story.concept.respiration": "Celleånding"
  ,"landing12.story.concept.toConsolidate": "Må konsolideres"
  ,"landing12.story.concept.photosynthesis": "Fotosyntese"
  ,"landing12.story.concept.chlorophyll": "Klorofyll"
  ,"landing12.story.concept.atp": "ATP"
  ,"landing12.story.brain.note": "Kartet viser relasjoner og læringstilstander bare når produktet har ekte dokumentasjon."
  ,"landing12.story.context.brain": "Hjernen min"
  ,"landing12.story.context.document": "Biologikurs.pdf"
  ,"landing12.story.context.goal": "Eksamensmål"
  ,"landing12.story.professor.question": "Hvorfor føles dette begrepet fortsatt vanskelig?"
  ,"landing12.story.professor.answer": "La oss bygge det opp igjen fra ATP: først formålet, deretter trinnene og til slutt en kort kontroll med dine egne ord."
  ,"landing12.story.professor.session": "Opplevelsesøkten holder kilden, intensjonen, historikken og neste handling samlet."
  ,"landing12.story.oral.listen": "Lytting"
  ,"landing12.story.oral.transcript": "Transskription"
  ,"landing12.story.oral.answer": "Svar"
  ,"landing12.story.oral.visibleTranscript": "Synlig transskription"
  ,"landing12.story.oral.transcriptText": "«Celleånding omdanner energien i glukose til ATP som cellen kan bruke.»"
  ,"landing12.story.oral.note": "Tale utfyller den skriftlige oplevelsen. En lydtjeneste som svikter, fjerner aldri det lesbare innholdet."
  ,"landing12.story.review.cardLabel": "Begrepsrepetisjon"
  ,"landing12.story.review.question": "Forklar rollen til ATP uten å se på kilden."
  ,"landing12.story.review.tomorrow": "Eksempel: repetisjon i morgen"
  ,"landing12.story.review.note": "Den virkelige appen planlegger ut fra faktisk repetisjonshistorikk; denne landingssiden oppretter ingen tidsplan."
  ,"landing12.story.review.fsrs": "Repetisjon med mellomrom"
  ,"landing12.story.workspace.plan": "Plan"
  ,"landing12.story.workspace.context": "Kontekst"
  ,"landing12.story.workspace.analysis": "Analyse"
  ,"landing12.story.workspace.conclusion": "Konklusjon"
  ,"landing12.story.workspace.documentTitle": "Hvordan celler omdanner energi"
  ,"landing12.story.workspace.copy": "Kilden og begrepene forblir sporbare mens eleven strukturerer en argumentasjon og skriver den endelige teksten."
  ,"landing12.story.workspace.source": "Biologikurs.pdf"
  ,"landing12.story.workspace.citation": "Kildehenvisning"
  ,"landing12.features.kicker": "Sammenkoblede funksjoner"
  ,"landing12.features.title": "Ikke en samling AI-verktøy"
  ,"landing12.features.lead": "Hver funksjon har en tydelig rolle, men de deler de samme kildene, øktene og læringskonteksten."
  ,"landing12.features.group.personal": "Personlig intelligens"
  ,"landing12.features.group.personal.desc": "Kjenner eleven"
  ,"landing12.features.group.understand": "Forstå"
  ,"landing12.features.group.understand.desc": "Spørgsmål og kilder"
  ,"landing12.features.group.practice": "Øv og husk"
  ,"landing12.features.group.practice.desc": "Aktiv læring"
  ,"landing12.features.group.produce": "Brug og fortsæt"
  ,"landing12.features.group.produce.desc": "Arbeid og neste handling"
  ,"landing12.feature.brain.title": "Hjernen min"
  ,"landing12.feature.brain.desc": "En synlig kognitiv tvilling for begreper, relasjoner, mestring, minne og læringshistorikk."
  ,"landing12.feature.professor.title": "AI-professor"
  ,"landing12.feature.professor.desc": "En pedagogisk identitet som underviser, forklarer, stiller spørgsmål, vurderer og tilpasser seg den aktive konteksten."
  ,"landing12.feature.learn.title": "Lær"
  ,"landing12.feature.learn.desc": "Ett skrivefelt for å forstå, lære, øve, undersøke eller skape med tekst, tale og kilder."
  ,"landing12.feature.documents.title": "Dokumentintelligens"
  ,"landing12.feature.documents.desc": "Importer, forstå, spør og bearbeid ett dokument eller et avgrenset parti med sporbarhet til kildene."
  ,"landing12.feature.review.title": "Repetisjon"
  ,"landing12.feature.review.desc": "Konsoliderer det som står i fare for å bli glemt, ved hjælp av ekte repetisjonshistorikk og repetisjon med mellomrom."
  ,"landing12.feature.research.title": "Undersøkelse"
  ,"landing12.feature.research.desc": "Rask, kildebasert eller dyptgående undersøkelse på tvers av Hjernen min og biblioteket; sitatene kan alltid kontrolleres."
  ,"landing12.feature.workspace.title": "Akademisk arbeidsområde"
  ,"landing12.feature.workspace.desc": "Et varig arbeidsområde for planer, utkast, kilder, sitater og kontekstuell hjælp."
  ,"landing12.feature.languages.title": "Sprog og fordypning"
  ,"landing12.feature.languages.desc": "Et strukturert CEFR-kurs knyttet til virkelighetsnære oppdrag, tilbakemeldinger, repetisjon og dokumentasjon av funksjonelle ferdigheter."
  ,"landing12.feature.voice.title": "Muntlig og tale"
  ,"landing12.feature.voice.desc": "Snakk, se gennem transskriptionen og motta et skriftlig svar som fortsatt er tilgængelig hvis lyden svikter."
  ,"landing12.feature.next.title": "Neste beste handling"
  ,"landing12.feature.next.desc": "En forklarbar anbefaling som kombinerer mål, økter, repetisjon og gjeldende kontekst."
  ,"landing12.features.researchScope": "Undersøk i dine egne kilder"
  ,"landing12.features.noWebClaim": "Ekstern nettleverandør er ikke konfigurert"
  ,"landing12.features.sameContext": "Én felles kontekst"
  ,"landing12.brain.kicker": "Hjernen min"
  ,"landing12.brain.title": "Din synlige kognitive tvilling"
  ,"landing12.brain.lead": "Den svarer på hvad du kan, hvad som er usikkert, hvordan viden henger sammen og hvad som fortjener oppmerksomhet videre."
  ,"landing12.brain.center": "Læringskonteksten din"
  ,"landing12.brain.knowledge": "Viden"
  ,"landing12.brain.connections": "Forbindelser"
  ,"landing12.brain.strengths": "Styrker"
  ,"landing12.brain.fragilities": "Svagheder"
  ,"landing12.brain.memory": "Minne"
  ,"landing12.brain.noScores": "Second Brain viser bare mestring og virkning når det findes dokumentasjon; landingssiden finder ikke opp nogen poengsum."
  ,"landing12.professor.kicker": "AI-professor"
  ,"landing12.professor.title": "En lærer, ikke enda en generell chatbot"
  ,"landing12.professor.lead": "Den kan ændr formatet på oplevelsen samtidig som elevens kontekst og økt bevares."
  ,"landing12.professor.level": "Nivå"
  ,"landing12.professor.goals": "Mål"
  ,"landing12.professor.documents": "Dokumenter"
  ,"landing12.professor.progress": "Fremgang"
  ,"landing12.professor.identity": "Pedagogisk identitet"
  ,"landing12.professor.example": "«Jeg kan forklare det på en annen måte, stille deg et spørgsmål, gå over til muntlig øving eller gjøre vanskeligheten om til en repetisjon.»"
  ,"landing12.professor.mode.explain": "Forklar"
  ,"landing12.professor.mode.teach": "Undervis"
  ,"landing12.professor.mode.question": "Still spørgsmål"
  ,"landing12.professor.mode.assess": "Vurder"
  ,"landing12.professor.mode.voice": "Tale"
  ,"landing12.personal.kicker": "Personlig intelligens"
  ,"landing12.personal.title": "Et system som utvikler seg med læringen din"
  ,"landing12.personal.lead": "Jo mer du lærer, øver og repeterer, desto bedre kan Second Brain organisere konteksten din og gjøre neste handling nyttig."
  ,"landing12.personal.learn": "Det du lærer"
  ,"landing12.personal.understand": "Det du forstår"
  ,"landing12.personal.forget": "Det som står i fare for å bli glemt"
  ,"landing12.personal.master": "Det du mestrer"
  ,"landing12.personal.goals": "Det du vil oppnå"
  ,"landing12.personal.twin": "Et levende kognitivt kart"
  ,"landing12.personal.note": "Tidslinjen vises først når datagrunnlaget er lite; et utforskende diagram vises når dokumentasjonen er moden."
  ,"landing12.personal.nbaLabel": "Eksempel på en neste beste handling"
  ,"landing12.personal.nbaAction": "Fortsæt oppdraget om et møde på engelsk"
  ,"landing12.personal.nbaReason": "Fordi det er knyttet til målet ditt om internasjonalt arbeid, og den siste økten er klar til å fortsettes."
  ,"landing12.languages.kicker": "Sprog og fordypning"
  ,"landing12.languages.title": "Lær et sprog med AI-professoren din"
  ,"landing12.languages.lead": "Vælg hvad du vil kunne gjøre. Second Brain kombinerer et komplett kurs, virkelighetsnære oppdrag, muntlig øving, målrettet utbedring og repetisjon."
  ,"landing12.languages.demoDisclaimer": "Scenario fra planen for del 11 bis. Kun demonstrasjon; det hevdes ingen sertifisering eller elevpoengsum."
  ,"landing12.languages.objective": "Mål"
  ,"landing12.languages.objectiveValue": "Jeg vil jobbe internasjonalt"
  ,"landing12.languages.missionMeeting": "Delta i et møde"
  ,"landing12.languages.rlle": "Språkmotor for virkelige situasjoner"
  ,"landing12.languages.stage.goal": "Mål"
  ,"landing12.languages.stage.course": "Kurs"
  ,"landing12.languages.stage.mission": "Oppdrag"
  ,"landing12.languages.stage.conversation": "Samtale med professoren"
  ,"landing12.languages.stage.gap": "Vanskelighet oppdaget"
  ,"landing12.languages.stage.micro-lesson": "Mikroleksjon"
  ,"landing12.languages.stage.retry": "Nytt forsøk"
  ,"landing12.languages.stage.vocabulary": "Nyttig sprog"
  ,"landing12.languages.stage.review": "Repetisjon"
  ,"landing12.languages.stage.functional-progress": "Fremgang i kan-gjøre-ferdigheter"
  ,"landing12.languages.stage.goal.note": "Elevens virkelige mål styrer prioriteringene i kurset."
  ,"landing12.languages.stage.course.note": "CEFR strukturerer læringsløpet; det fremstilles ikke som en ekstern sertifisering."
  ,"landing12.languages.stage.mission.note": "Et verdensoppdrag gjør viden om til en konkret kommunikativ opgave."
  ,"landing12.languages.stage.conversation.note": "Læringsspråket holdes atskilt fra grensesnittspråket."
  ,"landing12.languages.stage.gap.note": "En mangel kommer fra observert dokumentasjon, ikke fra en dekorativ poengsum."
  ,"landing12.languages.stage.micro-lesson.note": "Utbedringen retter seg mot den nøyaktige hindringen før et nytt forsøk."
  ,"landing12.languages.stage.retry.note": "Et nytt forsøk gir eleven mulighet til å bruke rettelsen med én gang."
  ,"landing12.languages.stage.vocabulary.note": "Det valgte sproget beholder sporbarhet til oppdraget og økten."
  ,"landing12.languages.stage.review.note": "Ordforråd kan legges inn i den eksisterende repetisjons- og FSRS-flyten."
  ,"landing12.languages.stage.functional-progress.note": "En kan-gjøre-ferdighet godkjennes bare ut fra godkjent dokumentasjon i det virkelige produktet."
  ,"landing12.languages.path.goal": "Et funksjonelt mål, ikke et vagt tema"
  ,"landing12.languages.path.goal.desc": "Kurset tar utgangspunkt i situasjonen eleven ønsker å håndtere i virkeligheten."
  ,"landing12.languages.path.course": "Et strukturert B1-løp"
  ,"landing12.languages.path.course.desc": "Læreplan, ferdighetsområder og oppdrag forblir sammenkoblet i stedet for å bli separate miniapper."
  ,"landing12.languages.path.mission": "Et møde som en virkelig opgave"
  ,"landing12.languages.path.mission.desc": "Professoren skaper en kontekstuell samtale, observerer hindringer og veileder utbedringssløyfen."
  ,"landing12.languages.professorLabel": "AI-professor · Engelsk B1"
  ,"landing12.languages.transcriptVisible": "Stemmetilstanden og transskriptionen er tydelige og redigerbare i appen."
  ,"landing12.languages.gapDetected": "Observert funksjonell mangel"
  ,"landing12.languages.gapExplanation": "Den tiltenkte betydningen er tydelig, men adverbformen står i veien for en naturlig profesjonell setning. I det virkelige produktet kan denne observerte vanskeligheten lagres i feilminnet, slik at utbedringssløyfen kan rette seg mot den senere."
  ,"landing12.languages.gapGrammar": "Grammatikk"
  ,"landing12.languages.gapFluency": "Flyt"
  ,"landing12.languages.microLesson": "Målrettet utbedring"
  ,"landing12.languages.microRule": "Brug et adverb for å beskrive hvordan teamet arbeider."
  ,"landing12.languages.microHint": "Professoren knytter regelen til setningen i stedet for å åpne en leksjon uten sammenheng."
  ,"landing12.languages.retryLabel": "Prøv den samme oppgaven på nytt"
  ,"landing12.languages.retryObserved": "Den rettede strukturen vises i det nye forsøket"
  ,"landing12.languages.vocabularyTitle": "Sprog valgt fra dette oppdraget"
  ,"landing12.languages.vocabularyTrace": "I produktet beholder hver lagrede oppføring sproget, kilden og øktens opprinnelse."
  ,"landing12.languages.reviewLabel": "Koblet til repetisjon"
  ,"landing12.languages.reviewAction": "Konsolider den nyttige strukturen til riktig tid"
  ,"landing12.languages.reviewTrace": "Den virkelige tidsplanen opprettes ut fra faktisk dokumentasjon fra repetisjoner; denne demonstrasjonen oppretter ingen."
  ,"landing12.languages.canDoTitle": "Det jeg allerede kan gjøre"
  ,"landing12.languages.canDo.introduce": "Presentere meg selv"
  ,"landing12.languages.canDo.restaurant": "Bestille på en restaurant"
  ,"landing12.languages.canDo.meeting": "Delta i et møde"
  ,"landing12.languages.canDo.opinion": "Forsvare en mening"
  ,"landing12.languages.canDoDisclaimer": "Illustrerende liste. Bare dokumentasjon kan bekrefte en ferdighet i appen."
  ,"landing12.languages.courseTitle": "Et komplett språkkurs"
  ,"landing12.languages.courseLead": "Samtale er én del av kurset, sammen med eksplisitt språkarbeid og forståelse."
  ,"landing12.languages.strand.vocabulary": "Ordforråd"
  ,"landing12.languages.strand.grammar": "Grammatikk"
  ,"landing12.languages.strand.verbs": "Verb"
  ,"landing12.languages.strand.conjugation": "Bøying"
  ,"landing12.languages.strand.reading": "Lesing"
  ,"landing12.languages.strand.writing": "Skriving"
  ,"landing12.languages.strand.listening": "Lytting"
  ,"landing12.languages.strand.oral": "Muntlig"
  ,"landing12.languages.strand.pronunciation": "Uttale"
  ,"landing12.languages.strand.mediation": "Språkformidling"
  ,"landing12.languages.missionsTitle": "Verdensoppdrag"
  ,"landing12.languages.missionsLead": "En avgrenset samling situasjoner der sproget bruges, med et mål og et minimumsnivå."
  ,"landing12.languages.mission.travel": "Reise"
  ,"landing12.languages.mission.work": "Arbeid"
  ,"landing12.languages.mission.studies": "Studier"
  ,"landing12.languages.mission.social": "Sosialt liv"
  ,"landing12.languages.registryTitle": "34 understøttede læringssprog"
  ,"landing12.languages.registryLead": "Navn på originalspråket og grensesnittspråket formidler betydningen. Et nøytralt symbol erstatter et landsflagg når ett land ville vært tvetydig."
  ,"landing12.how.kicker": "Slik fungerer det"
  ,"landing12.how.title": "En enkel reise, selv når intelligensen er avansert"
  ,"landing12.how.lead": "Du kommer med en intensjon. Second Brain holder den tekniske kompleksiteten bak én sammenhengende oplevelse."
  ,"landing12.how.goal.title": "Oppgi målet ditt"
  ,"landing12.how.goal.desc": "Fortell hvad du vil forstå eller oppnå."
  ,"landing12.how.act.title": "Lær, importer eller spør"
  ,"landing12.how.act.desc": "Brug tekst, tale, en skanning eller en fil."
  ,"landing12.how.context.title": "Bygg konteksten"
  ,"landing12.how.context.desc": "Samle relevante økter, kilder og mål."
  ,"landing12.how.practice.title": "Øv"
  ,"landing12.how.practice.desc": "Gå fra forklaring til en aktiv oplevelse."
  ,"landing12.how.consolidate.title": "Konsolider"
  ,"landing12.how.consolidate.desc": "Repeter det dokumentasjonen viser er usikkert."
  ,"landing12.how.continue.title": "Fortsæt"
  ,"landing12.how.continue.desc": "Følg én forklarbar neste handling."
  ,"landing12.nba.kicker": "Neste beste handling"
  ,"landing12.nba.title": "Vit hvad som fortjener oppmerksomhet nå"
  ,"landing12.nba.lead": "Anbefalinger kombinerer den faktiske konteksten og forklarer hvorfor de er nyttige. De er forslag, aldri usynlige kommandoer."
  ,"landing12.nba.english": "Fortsæt engelskkurset ditt"
  ,"landing12.nba.review": "Repeter 5 begreper som har forfalt"
  ,"landing12.nba.workspace": "Fortsæt disposisjonen til avhandlingen din"
  ,"landing12.nba.professor": "Fortsæt økten med professoren"
  ,"landing12.nba.why": "Hvorfor denne anbefalingen? · Mål og økt som kan fortsettes"
  ,"landing12.platform.web": "Nett"
  ,"landing12.platform.android": "Android"
  ,"landing12.platform.ios": "iOS"
  ,"landing12.platform.windows": "Windows"
  ,"landing12.platform.macos": "macOS"
  ,"landing12.platform.status.available": "Tilgængelig"
  ,"landing12.platform.status.prepared": "Appen er teknisk klargjort; ingen offentlig butikklenke ennå"
  ,"landing12.platform.status.coming-soon": "Kommer snart; ingen offentlig nedlastingslenke ennå"
  ,"landing12.download.kicker": "Kontinuitet på tvers av plattformer"
  ,"landing12.download.title": "Second Brain, uansett hvor du lærer"
  ,"landing12.download.lead": "Begynn med nettopplevelsen i dag. Distribusjon til mobil og skrivebord vises ærlig etter hvert som den blir tilgængelig."
  ,"landing12.download.continuity": "Øktmodellen er utformet slik at du kan begynde på én enhed og fortsætte på en annen."
  ,"landing12.download.webAction": "Brug på nettet"
  ,"landing12.download.sameSession": "Samme økt"
  ,"landing12.download.synced": "Konteksten er klar til å fortsettes"
  ,"landing12.privacy.kicker": "Personvern og kontroll"
  ,"landing12.privacy.title": "Dataene dine forblir under din kontroll"
  ,"landing12.privacy.lead": "Second Brain har kontokontroller for minne, dokumenter, dataportabilitet og sletning."
  ,"landing12.privacy.scope": "Dette er produktkontroller, ikke et ytterligere juridisk løfte eller sikkerhetsløfte."
  ,"landing12.privacy.memory": "Administrer AI-minnet"
  ,"landing12.privacy.export": "Eksporter dataene dine"
  ,"landing12.privacy.documents": "Administrer dokumentene dine"
  ,"landing12.privacy.delete": "Be om kontosletting med bekreftelse"
  ,"landing12.pricing.kicker": "Gratis · Pro · Max"
  ,"landing12.pricing.title": "Tre individuelle tilbud, uten oppdiktede detaljer"
  ,"landing12.pricing.lead": "Endelige priser, kvoter og fordeler blir bestemt etter den offentlige betaperioden. Landingssiden viser bare dagens faktiske katalog."
  ,"landing12.pricing.free.name": "Gratis"
  ,"landing12.pricing.free.desc": "Det vanlige individuelle tilbudet for å utforske Second Brain-oplevelsen."
  ,"landing12.pricing.pro.name": "Pro"
  ,"landing12.pricing.pro.desc": "Et avansert individuelt tilbud der endelig pris, kvoter og fordeler resterer å konfigurere."
  ,"landing12.pricing.max.name": "Max"
  ,"landing12.pricing.max.desc": "Det mest omfattende individuelle tilbudet; de endelige kommersielle detaljene resterer å konfigurere."
  ,"landing12.pricing.freeStatus": "Gratis tilbud tilgængelig"
  ,"landing12.pricing.pending": "Detaljer etter offentlig beta"
  ,"landing12.pricing.sourceNote": "Autentiserte abonnementsskjermer forblir datastyrte fra serverdelen. Ingen pris, rabatt, kvote eller eksklusiv fordel er hardkodet her."
  ,"landing12.faq.kicker": "Nyttige svar"
  ,"landing12.faq.title": "Spørgsmål? Vi svarer."
  ,"landing12.faq.lead": "Korte svar om hvad produktet faktisk gjør i dag."
  ,"landing12.faq.q1": "Hvad er Second Brain?"
  ,"landing12.faq.a1": "Et personlig intelligent læringssystem som knytter spørgsmål, kilder, undervisning, øving, minne og akademisk arbeid sammen i én kontekst."
  ,"landing12.faq.q2": "Er det bare en chatbot?"
  ,"landing12.faq.a2": "Nei. Samtale er ett grensesnitt. Den samme økten kan bli en leksjon, en muntlig øvelse, et kildebasert dokumentspørsmål, en repetisjon eller en handling i arbeidsområdet."
  ,"landing12.faq.q3": "Hvordan fungerer Hjernen min?"
  ,"landing12.faq.a3": "Den synliggjør begrepene, relasjonene, dokumentasjonen av mestring, minnet og læringshistorikken din. Visningen tilpasses modenheten til de tilgængelige dataene."
  ,"landing12.faq.q4": "Kan jeg bruke mine egne dokumenter?"
  ,"landing12.faq.a4": "Ja. Biblioteket tar imot støttede filer og skanninger, viser faktiske behandlingstilstander, trekker ut begreper og støtter kildebaserte spørgsmål og bearbeidinger."
  ,"landing12.faq.q5": "Kan jeg lære et sprog?"
  ,"landing12.faq.a5": "Ja. Språkmotoren for virkelige situasjoner kombinerer en CEFR-læreplan, eksplisitt språkarbeid, verdensoppdrag, muntlig øving, målrettet utbedring, repetisjon og dokumentasjon av kan-gjøre-ferdigheter."
  ,"landing12.faq.q6": "Hvordan fungerer AI-professoren?"
  ,"landing12.faq.a6": "Den bruger elevens aktive kontekst og kan forklare, undervise, stille spørgsmål, vurdere eller øve samtidig som opplevelsesøkten bevares."
  ,"landing12.faq.q7": "Hvordan fungerer repetisjoner?"
  ,"landing12.faq.a7": "Repetisjon bruger faktisk historikk og repetisjon med mellomrom for å prioritere viden som står i fare for å bli glemt. Repetisjon uten AI er fortsatt tilgængelig uavhengig av AI-kvoter."
  ,"landing12.faq.q8": "Hvilke sprog er tilgængelige?"
  ,"landing12.faq.a8": "Det fælles register indeholder i øjeblikket 34 læringssprog. Grænsefladesprog og læringssprog er altid separate valg."
  ,"landing12.faq.q9": "Søger Undersøkelse på nettet?"
  ,"landing12.faq.a9": "Undersøkelse kan arbeide på tvers av Hjernen min og biblioteket ditt i dag. Den eksterne nettleverandøren er ikke konfigurert i gjeldende utrulling, så landingssiden hevder ikke at den er det."
  ,"landing12.faq.q10": "Er dataene mine private?"
  ,"landing12.faq.a10": "Autentiserte kontroller dekker AI-minne, dokumenter, samtykker, eksport og kontosletting. Denne siden gir ingen juridiske løfter eller infrastrukturløfter utover disse kontrollene."
  ,"landing12.faq.q11": "Hvad er forskjellen mellom Gratis, Pro og Max?"
  ,"landing12.faq.a11": "Dette er de tre individuelle abonnementsnivåene i serverkatalogen. Endelige priser, kvoter og abonnementsfordeler blir konfigurert etter den offentlige betaperioden."
  ,"landing12.faq.q12": "Hvor kan jeg bruke Second Brain?"
  ,"landing12.faq.a12": "Nettopplevelsen er tilgængelig i denne appen. Android og iOS er teknisk klargjort uten offentlige butikklenker; distribusjon for Windows og macOS kommer senere."
  ,"landing12.contact.kicker": "Kontakt og brukerstøtte"
  ,"landing12.contact.title": "Fortell oss hvad du trenger"
  ,"landing12.contact.lead": "Den offentlige kontaktinngangen er ærlig: Den åpner bare en e-postkanal når en offentlig støtteadresse er konfigurert."
  ,"landing12.contact.write": "Skriv til brukerstøtten"
  ,"landing12.contact.account": "Logg inn på kontoen din"
  ,"landing12.contact.notConfigured": "Den offentlige støtteadressen er ennå ikke konfigurert. Logg inn for å få tilgang til konto- og datakontroller; ingen melding blir simulert."
  ,"landing12.contact.subject": "Forespørsel til Second Brain-brukerstøtten"
  ,"landing12.contact.general": "Generelt spørgsmål"
  ,"landing12.contact.general.desc": "Forstå produktet eller tilgjengeligheten."
  ,"landing12.contact.technical": "Teknisk brukerstøtte"
  ,"landing12.contact.technical.desc": "Rapporter et problem med bruken av appen."
  ,"landing12.contact.billing": "Abonnement og fakturering"
  ,"landing12.contact.billing.desc": "Spørgsmål om et tilbud, en faktura eller en betaling."
  ,"landing12.contact.privacy": "Personvern og data"
  ,"landing12.contact.privacy.desc": "Spørgsmål om minne, eksport eller sletning."
  ,"landing12.contact.problem": "Rapporter et problem"
  ,"landing12.contact.problem.desc": "Beskriv et produktproblem som kan gjenskapes."
  ,"landing12.contact.feedback": "Forslag og tilbakemeldinger"
  ,"landing12.contact.feedback.desc": "Del en idé til hvordan oplevelsen kan forbedres."
  ,"report.title": "Rapporter et problem"
  ,"report.intro": "Fortell oss hvad som skjedde. Rapporten din blir gennemgått av mennesker; den er ikke en instruksjon til systemet og utløser ingen automatisk reparasjon."
  ,"report.category": "Hvad er berørt?"
  ,"report.category.app_not_working": "Appen fungerer ikke"
  ,"report.category.ai_teacher_problem": "AI-professor"
  ,"report.category.document_pdf_problem": "Dokument eller PDF"
  ,"report.category.voice_problem": "Tale"
  ,"report.category.language_learning_problem": "Språklæring"
  ,"report.category.revision_problem": "Repetisjon"
  ,"report.category.brain_digital_twin_problem": "Hjernen min eller den digitale tvillingen"
  ,"report.category.subscription_payment_problem": "Abonnement eller betaling"
  ,"report.category.account_login_problem": "Konto eller innlogging"
  ,"report.category.other": "Annet"
  ,"report.description": "Beskriv problemet"
  ,"report.placeholder": "Hvad prøvde du å gjøre, og hvad skjedde i stedet?"
  ,"report.counter": "{count}/{max} tegn"
  ,"report.minimum": "Skriv inn minst {min} tegn."
  ,"report.privacyTitle": "Hold rapporten sikker"
  ,"report.privacyDetail": "Ikke ta med adgangskode, tilgangskoder, betalingsopplysninger, private dokumenter, samtaleinnhold eller personopplysninger. Verdier som ser sensitive ut, skjules før sending."
  ,"report.consent": "Jeg tillater begrænset ekstra diagnostikk hvis det er nødvendig. Dette er valgfritt; rapporten kan sendes uten."
  ,"report.contextTitle": "Begrænset diagnostisk kontekst"
  ,"report.contextDetail": "Appen sender bare rapportkategorien, en avgrenset beskrivelse, et sikkert rutenavn, app-/byggversjon, plattform og en ugjennomsiktig forespørsels-ID. Den sender ikke skjermbilder, dokumenter, samtaler eller lyd."
  ,"report.attachments": "Vedlegg"
  ,"report.attachmentsDetail": "IKKE INSTRUMENTERT – vedlegg er bevisst utilgængelige for problemrapporter."
  ,"report.submit": "Send rapport"
  ,"report.successTitle": "Rapporten er sendt"
  ,"report.successDetail": "Takk. En menneskelig gjennomgang kan knytte den til sikker telemetri; den bekrefter ingen årsak og gjør ingen automatisk endring."
  ,"report.error": "Rapporten kunne ikke sendes. Ingenting er forsøkt på nytt automatisk."
  ,"report.profileTitle": "Hjælp og problemrapporter"
  ,"report.profileDetail": "Rapporter et produktproblem uten å legge ved privat læringsinnhold."
  ,"report.open": "Rapporter et problem"
  ,"landing12.final.kicker": "Ett produkt. Én oplevelse."
  ,"landing12.final.title": "Bygg et system som lærer sammen med deg"
  ,"landing12.final.lead": "Begynn med én intensjon. Behold konteksten. Fortsæt med den riktige neste handlingen."
  ,"landing12.footer.tagline": "Ditt personlige intelligente læringssystem: forstå, øv, husk og skap i én sammenhengende kontekst."
  ,"landing12.footer.beta": "Offentlig beta · funksjoner og kommersiell konfigurasjon fortsetter å utvikle seg."
  ,"landing12.footer.product": "Produkt"
  ,"landing12.footer.resources": "Ressurser"
  ,"landing12.footer.features": "Funksjoner"
  ,"landing12.footer.brain": "Hjernen min"
  ,"landing12.footer.languages": "Sprog"
  ,"landing12.footer.pricing": "Priser"
  ,"landing12.footer.download": "Indlæs ned"
  ,"landing12.footer.how": "Slik fungerer det"
  ,"landing12.footer.faq": "Vanlige spørgsmål"
  ,"landing12.footer.contact": "Kontakt"
  ,"landing12.footer.account": "Konto"
  ,"landing12.footer.privacy": "Kontroller for personvern og data"
  ,"landing12.footer.copy": "© 2026 Second Brain. Alle produktdemonstrasjoner er offentlige eksempler."
  ,"landing12.footer.noTracking": "Ingen oppdiktet partner, anbefaling eller måleverdi."
  ,"capture.permission.pending": "Klargjør kameraet…"
  ,"capture.permission.title": "Kameratillatelse kreves"
  ,"capture.permission.detail": "Second Brain åpner kameraet først etter at du utfører en handling. Du kan fortsatt importere et eksisterende bilde."
  ,"capture.permission.allow": "Tillat kamera"
  ,"capture.importFallback": "Importer et bilde"
  ,"capture.error.capture": "Bildet kunne ikke tas."
  ,"capture.error.fallback": "Luk en annen app som bruger kameraet, kontroller tillatelsen, eller importer et bilde."
  ,"capture.error.unavailable": "Fant ingen tilgængelige kameraer."
  ,"capture.error.paused": "Kameraet er satt på pause."
  ,"capture.error.denied": "Kameratillatelsen ble avslått."
  ,"capture.error.secureContext": "Kameraet krever en sikker HTTPS-tilkobling."
  ,"capture.error.busy": "Kameraet er utilgængelig eller allerede i brug."
  ,"capture.retake": "Ta på nytt"
  ,"capture.confirm": "Brug dette bildet"
  ,"capture.take": "Ta bilde"
  ,"capture.switch": "Skift kamera"
  ,"capture.preview": "Direkte kameraforhåndsvisning"
  ,"capture.cameraChoice": "Vælg et kamera"
  ,"capture.camera": "Kamera"
  ,"qr.title": "Les en QR-kode"
  ,"qr.detail": "Rett kameraet mot en QR-kode. Innholdet forblir inaktivt til du har sett gennem det."
  ,"qr.aim": "Hold QR-koden innenfor rammen."
  ,"qr.unsupported": "QR-lesing er ikke tilgængelig i denne nettleseren"
  ,"qr.unsupportedDetail": "Brug en kompatibel HTTPS-browser eller en annen enhed. Intet indhold er åpnet."
  ,"qr.detected": "QR-adresse oppdaget"
  ,"qr.confirmDetail": "Kontroller hele adressen før du åpner den."
  ,"qr.open": "Åpne denne adressen"
  ,"qr.openError": "Denne adressen kunne ikke åpnes. Den ble verken kjørt eller importert."
  ,"qr.noneFound": "Fant ingen QR-kode. Juster utsnittet og prøv igjen."
  ,"qr.scanAgain": "Skann en ny QR-kode"
  ,"qr.textDetected": "QR-tekst oppdaget"
  ,"qr.textInert": "Denne teksten vises bare. Den blir ikke kjørt eller sendt til AI-professoren."
  ,"qr.done": "Færdig"
  ,"qr.blocked": "Usikker QR-adresse blokkert"
  ,"qr.blockedDetail": "Bare uttrykkelige HTTP- og HTTPS-lenker kan åpnes. Egendefinerte, fil-, data- og skriptprotokoller avvises."
  ,"scan.importError": "De valgte bildene kunne ikke importeres."
  ,"scan.editError": "Denne siden kunne ikke redigeres. De andre sidene er bevart."
  ,"scan.uploadError": "Skanningen kunne ikke lagres."
  ,"scan.inProgress": "Denne skanningen behandles fortsatt. Prøv igjen om et øyeblikk."
  ,"scan.retryNewAttempt": "Det forrige forsøket ble avsluttet på en sikker måte. Trykk på Gem igjen for å starte et nytt skanneforsøk."
  ,"scan.returnToLearn": "Gå tilbage til Lær med dette dokumentet"
  ,"scan.captureFirst": "Se gennem før lagring"
  ,"scan.captureFirstDetail": "Ta eller importer sider, juster rekkefølgen, beskjæringen og rotasjonen, og bekreft deretter. Ingenting lastes opp før den siste handlingen."
  ,"scan.retryPreserved": "Sidene dine forblir her, slik at du kan prøve igjen uten å ta dem på nytt."
  ,"scan.pagePosition": "Side {current} av {total}"
  ,"scan.moveBefore": "Flytt til venstre"
  ,"scan.moveAfter": "Flytt til høyre"
  ,"scan.rotate": "Roter"
  ,"scan.crop": "Juster beskjæring"
  ,"scan.perspectiveLimit": "Forhåndsinnstillinger for sentrert beskjæring er tilgængelige. Justerbare sidekanter og perspektivkorrigering er ennå ikke tilgængelige."
  ,"learn5.capture.photo": "Bilde"
  ,"learn5.capture.document": "Skann et dokument"
  ,"learn5.capture.qr": "Les en QR-kode"
  ,"profile.card.webcam": "Brug webkamera"
  ,"profile.card.importImage": "Importer et bilde"
  ,"profile.email.verified": "E-post bekreftet"
  ,"profile.email.unverified": "E-post ikke bekreftet"
  ,"profile.edit": "Rediger profilen min"
  ,"profile.avatar.loadError": "Det lagrede profilbildet kunne ikke lastes inn."
  ,"profile.avatar.saveError": "Det nye profilbildet kunne ikke lagres."
  ,"profile.avatar.removeError": "Profilbildet kunne ikke fjernes."
  ,"profile.avatar.denied": "Tilgang til bilder ble avslått."
  ,"profile.avatar.error": "Bildevelgeren kunne ikke åpnes."
  ,"profile.avatar.preserved": "Det forrige lagrede bildet er bevart. Du kan sikkert prøve igjen."
  ,"profile.avatar.editorTitle": "Juster profilbildet"
  ,"profile.avatar.editorDetail": "Forhåndsvis det sirkelformede resultatet. Rotasjon og zoom bruges først etter bekreftelse."
  ,"profile.avatar.rotate": "Roter"
  ,"profile.avatar.zoomOut": "Zoom ut"
  ,"profile.avatar.zoomIn": "Zoom inn"
  ,"profile.avatar.confirm": "Gem dette bildet"
};

registerLocale('da', "Dansk", da);
