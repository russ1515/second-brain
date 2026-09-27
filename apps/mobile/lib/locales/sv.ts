import { registerLocale } from '../i18n';

/** Swedish UI locale — machine-generated (Step 2), review recommended.
 *  Regenerate/extend with: node scripts/translate-locale.mjs sv */
const sv: Record<string, string> = {
  "app.today": "Idag",
  "app.signOut": "Logga ut",
  "app.back": "Tillbaka till idag",
  "app.tryAgain": "Försök igen",
  "app.language": "Appens språk",
  "auth.title": "Ditt klassrum",
  "auth.subtitle": "En privat lärare som minns varje lektion, misstag och framgång.",
  "auth.name": "Namn (valfritt)",
  "auth.email": "E-post",
  "auth.password": "Lösenord",
  "auth.start": "Börja lära dig",
  "auth.signIn": "Logga in",
  "auth.haveAccount": "Jag har redan ett konto",
  "auth.createAccount": "Skapa ett konto",
  "classroom.opening": "Öppnar ditt klassrum…",
  "classroom.streak": "dagars svit",
  "classroom.milestone": "Ny milstolpe",
  "classroom.emptyTitle": "Inget schemalagt ännu",
  "classroom.emptyDetail": "Din dag bygger på riktigt arbete. Skanna en sida av din kurs eller starta en diskussion, så planerar klassrummet utifrån det.",
  "classroom.replan": "Planera om idag",
  "classroom.offlineTitle": "Kan inte nå ditt klassrum",
  "classroom.offlineDetail": "Du är fortfarande inloggad – servern svarar bara inte. Kontrollera att API:et körs och försök igen.",
  "classroom.start": "Starta",
  "classroom.done": "Klar",
  "classroom.skip": "Hoppa över",
  "classroom.isDone": "✓ Klar",
  "classroom.isSkipped": "Hoppade över",
  "slot.morning": "Morgon · gå igenom igår",
  "slot.afternoon": "Eftermiddag · dagens lektion",
  "slot.evening": "Kväll · övning",
  "slot.night": "Före sömn · snabb repetition",
  "nav.teacher": "Fråga din lärare",
  "nav.scan": "📷 Skanna en kurs",
  "nav.languages": "Språk",
  "nav.revision": "Repetitionskö",
  "nav.progress": "Framsteg",
  "tab.home": "Hem",
  "tab.learn": "Lär dig",
  "tab.brain": "Min hjärna",
  "tab.study": "Studera",
  "tab.profile": "Profil",
  "learn.title": "Lär dig",
  "learn.intro": "Där du tillgodogör dig nya kunskaper.",
  "learn.teacher.title": "Fråga din lärare",
  "learn.teacher.detail": "Diskutera vad som helst – besvarat utifrån dina egna anteckningar, med röst eller text.",
  "learn.languages.title": "Språk",
  "learn.languages.detail": "Ordförråd, konversation och uttal på det språk du lär dig.",
  "learn.scan.title": "Skanna en kurs",
  "learn.scan.detail": "Fotografera en sida eller dina anteckningar och spara dem i ditt minne.",
  "brain.title": "Min hjärna",
  "brain.intro": "Allt du har lärt dig och hur väl du kan det.",
  "brain.progress.title": "Framsteg och behärskning",
  "brain.progress.detail": "Din svit, retention, behärskade begrepp och milstolpar.",
  "study.title": "Studera",
  "study.intro": "Öva vid rätt tillfälle, schemalagt med intervallrepetition.",
  "study.revision.title": "Repetitionskö",
  "study.revision.detail": "Gå igenom de kort som ska göras just nu.",
  "profile.title": "Profil",
  "profile.account": "Konto",
  "profile.health.title": "Systemstatus",
  "profile.health.detail": "Kontrollera att tjänsterna bakom din klassrumsmiljö är igång.",
  "home.greeting": "Hej",
  "home.objective": "Dagens mål",
  "home.objectiveNone": "Inget inplanerat ännu – skanna en kurs eller starta en diskussion.",
  "home.teacher": "Din AI-lärare",
  "home.continue": "Fortsätt på din senaste lektion",
  "home.continueNone": "Ingen lektion ännu – din första kommer att visas här.",
  "home.priority": "Prioriterad repetition",
  "home.cardsDue": "kort att repetera",
  "home.reviewNow": "Repetera nu",
  "home.nothingDue": "Inget att repetera just nu – du är i fas.",
  "home.plan": "Dagens plan",
  "home.progress": "Framsteg",
  "home.retention": "minnesgrad",
  "home.mastered": "bemästrade",
  "home.recommendations": "AI-rekommendationer",
  "home.recommendWork": "Arbeta med",
  "home.recommendNone": "Lägg till begrepp eller dokument så visas rekommendationer här.",
  "home.open": "Öppna",
  "teacher.streak": "Starkt engagemang – håll igång din svit!",
  "teacher.due": "Du har repetitioner som väntar. Börja med dem.",
  "teacher.first": "Redo för din första lektion? Skanna en kurs eller fråga mig vad som helst.",
  "teacher.default": "Redo att lära dig något nytt idag?",
  "soon.badge": "Kommer snart",
  "soon.detail": "Data visas efter tillräckligt många inlärningspass.",
  "learn.library": "Bibliotek",
  "learn.ocr": "OCR-skanner",
  "learn.documents": "Dokument",
  "learn.exercises": "Övningar",
  "learn.assessments": "Bedömningar",
  "learn.assessments.detail": "Läraren som examinerar: flervalsfrågor, uppsatser, fallstudier, mock-prov – rättade med förklaringar och råd.",
  "learn.writing.title": "Skrivcoach",
  "learn.writing.detail": "Skicka in en uppsats, rapport eller avhandling – granskad utifrån struktur, logik, tydlighet, grammatik och argumentation.",
  "learn.reading.title": "Läsnyckel",
  "learn.reading.detail": "Nivåanpassade texter med förståelsefrågor – svårighetsgraden anpassas i takt med att du blir bättre.",
  "study.planning": "Planering",
  "study.fsrs": "FSRS",
  "study.fsrs.detail": "Repetera vad som helst med FSRS",
  "study.goals": "Mål",
  "study.exams": "Prov",
  "study.notifications": "Aviseringar",
  "brain.twin": "Digital tvilling",
  "brain.twin.detail": "Din inlärningsprofil",
  "brain.memory": "Inlärningsminne",
  "brain.memory.detail": "Allt som AI:n kommer ihåg",
  "brain.mastery": "Begreppsbehärskning",
  "brain.mastery.detail": "Ett betyg för varje begrepp",
  "brain.graph": "Kunskapsgraf",
  "brain.graph.detail": "Hur dina begrepp hänger ihop",
  "brain.dna": "Inlärnings-DNA",
  "brain.score": "Inlärningspoäng",
  "brain.strengths": "Styrkor",
  "brain.strengths.detail": "Det du är bra på",
  "brain.weaknesses": "Svagheter",
  "brain.weaknesses.detail": "Det som faller bort",
  "brain.insights": "AI-insikter",
  "brain.insights.detail": "Varför AI:n föreslår detta",
  "brain.recommend": "Rekommendationer",
  "brain.recommend.detail": "Vad du ska göra härnäst",
  "brain.dash.tagline": "Ett sinne som lära sig – allt Second Brain vet om dig, live.",
  "brain.dash.memories": "minnen",
  "brain.dash.concepts": "koncept",
  "brain.dash.links": "länkar",
  "brain.dash.none": "Ingenting ännu",
  "revEng.title": "Revisionsmotor",
  "revEng.intro": "En FSRS-kö för allt — lektioner, övningar, quiz, läxor, språk.",
  "revEng.loading": "Bygger din repetitionskö…",
  "revEng.empty": "Inget att repetera ännu — studera något så schemaläggs det här.",
  "revEng.next": "nästa",
  "revEng.now": "nu",
  "revEng.tomorrow": "imorgon",
  "revEng.days": "dagar",
  "revEng.again": "Igen",
  "revEng.hard": "Svårt",
  "revEng.good": "Bra",
  "revEng.easy": "Enkelt",
  "plan.title": "Studieplanerare",
  "plan.tileDetail": "Din dag, sammanställd av AI:n",
  "plan.intro": "Dirigenten. Den bygger inget själv — den sätter ihop din dag från de andra motorerna.",
  "plan.loading": "Sammanställer din dag…",
  "plan.assembled": "Sammanställd från",
  "plan.live": "Live-plan — den ändras under dagen.",
  "plan.replan": "🔄 Omplanera från nu",
  "plan.items": "objekt",
  "plan.k.revision": "Repetition",
  "plan.k.lesson": "Lektion",
  "plan.k.discussion": "Diskussion",
  "plan.k.practical": "Praktiskt",
  "plan.k.quiz": "Quiz",
  "plan.k.summary": "Sammanfattning",
  "plan.k.break": "Paus",
  "plan.k.end": "Slut",
  "daily.title": "Dagens pass",
  "daily.start": "🎓 Starta dagens pass",
  "daily.loading": "Förbereder ditt klassrum…",
  "daily.noRevision": "Inget att repetera just nu — direkt till dagens lärande.",
  "daily.revisionIntro": "Först tar vi en repetition av det som förfaller:",
  "daily.discussionIntro": "Fråga din lärare vad som helst om det här ämnet — direkt här.",
  "daily.ask": "💬 Fråga läraren",
  "daily.askMore": "💬 Fråga igen",
  "daily.askPrompt": "Kan du förklara huvudtanken med det här ämnet på ett enkelt sätt?",
  "daily.askError": "Läraren är inte tillgänglig just nu — försök igen om en stund.",
  "daily.checkIntro": "Svara med egna ord — jag kollar din förståelse och hjälper till där det behövs.",
  "daily.check.placeholder": "Ditt svar…",
  "daily.check.btn": "Kontrollera min förståelse",
  "daily.check.again": "Kontrollera igen",
  "daily.check.understood": "Fattat!",
  "daily.check.partial": "Nästan — låt oss förfina",
  "daily.check.confused": "Låt oss gå igenom detta igen",
  "daily.check.reexplain": "Här är ett annat sätt att se på det",
  "daily.planningIntro": "Här är vad jag har planerat för dig härnäst:",
  "daily.p.welcome": "Välkommen",
  "daily.p.objectives": "Mål",
  "daily.p.revision": "Repetition",
  "daily.p.lesson": "Lektion",
  "daily.p.questions": "Frågor",
  "daily.p.discussion": "Diskussion",
  "daily.p.exercises": "Övningar",
  "daily.p.homework": "Praktiskt / Läxa",
  "daily.p.correction": "Rättelse",
  "daily.p.quiz": "Quiz",
  "daily.p.summary": "Sammanfattning",
  "daily.p.flashcards": "Instuderingskort",
  "daily.p.brain": "Hjärnuppdatering",
  "daily.p.planning": "Autoplanering",
  "cal.title": "Smart kalender",
  "cal.tileDetail": "Tentor, repetitioner med mera – autoenererade",
  "cal.intro": "Autogenererat från allt som AI:n har schemalagt. Lägg till egna tentor och mål; AI:n behåller prioriteten.",
  "cal.loading": "Bygger din kalender…",
  "cal.add": "Lägg till egna",
  "cal.titlePlaceholder": "t.ex. Matteprov",
  "cal.addBtn": "➕ Lägg till i kalender",
  "cal.todayTag": "Idag",
  "cal.nothing": "Inget inplanerat",
  "cal.today": "Idag",
  "cal.tomorrow": "Imorgon",
  "cal.in3": "Om 3 dagar",
  "cal.in7": "Om en vecka",
  "cal.k.exam": "Tenta",
  "cal.k.homework": "Läxa",
  "cal.k.practical": "Praktisk övning",
  "cal.k.language": "Språk",
  "cal.k.aiSession": "AI-session",
  "cal.k.revision": "Repetition",
  "cal.k.quiz": "Quiz",
  "cal.k.objective": "Mål",
  "cal.k.deadline": "Deadline",
  "pred.title": "Prediktiv repetition",
  "pred.tileDetail": "Förutse glömskan innan den sker",
  "pred.intro": "Ett lager ovanför FSRS. FSRS talar om vad som förfaller nu; detta förutser vad du kommer att glömma – så att AI:n agerar i förväg.",
  "pred.loading": "Projekterar dina glömskakurvor…",
  "pred.fsrs": "FSRS: ”Du behöver repetera idag.”",
  "pred.predictive": "Prediktivt: ”Om några dagar passerar din glömska tröskeln.”",
  "pred.empty": "Allt stabilt – inget riskerar att glömmas bort i närtid.",
  "pred.in": "Om",
  "pred.forgettingPass": "kommer din glömska att passera",
  "pred.now": "nu",
  "pred.today": "idag",
  "pred.oneDay": "1 dag",
  "pred.days": "dagar",
  "pred.reviewAhead": "🔁 Repetera nu för att ligga steget före",
  "notif.title": "Smarta aviseringar",
  "notif.tileDetail": "Pedagogiska, alltid motiverade",
  "notif.loading": "Förbereder dina aviseringar…",
  "notif.hello": "Hej",
  "notif.helloNoName": "Hej.",
  "notif.empty": "Inget att flagga just nu – du är på rätt spår.",
  "notif.review": "En kort {m}-minuters repetition av {s} idag skulle höja din behärskning med {p}%.",
  "notif.exam": "Din tenta ”{s}” är om {d} dagar. Jag har automatiskt omorganiserat din plan.",
  "notif.unlock": "Bra jobbat. Vi kan nu starta {next}.",
  "notif.forecast": "Om {d} dagar sjunker din återkallelse av {s} och glömskan passerar {p}%. En snabb repetition nu förhindrar det.",
  "notif.src.mastery": "Baserat på din nuvarande behärskning",
  "notif.src.calendar": "Från din kalender",
  "notif.src.path": "Från din inlärningsväg",
  "notif.src.forecast": "Från prediktiv repetition",
  "notif.cta.review": "🔁 Starta repetitionen",
  "notif.cta.exam": "📅 Se min plan",
  "notif.cta.unlock": "🎓 Starta nu",
  "notif.cta.forecast": "🔮 Repetera i förväg",
  "apath.title": "Adaptiv väg",
  "apath.tileDetail": "AI:n bestämmer din inlärningsordning",
  "apath.intro": "Berätta vad du vill lära dig. Jag kontrollerar kunskapsgrafen och din behärskning, och bestämmer sedan rätt ordning.",
  "apath.loading": "Laddar dina begrepp…",
  "apath.thinking": "Tar fram den bästa ordningen…",
  "apath.pickGoal": "Jag vill lära mig…",
  "apath.noConcepts": "Inga begrepp ännu — studera något först och sätt sedan upp ett mål.",
  "apath.verdictConsolidate": "Innan du börjar med {target}, låt oss befästa {list}. Du kommer att förstå det som följer mycket bättre.",
  "apath.verdictReady": "Allt är klart — du kan börja med {target} direkt!",
  "apath.and": "och",
  "apath.a.ready": "Behärskade",
  "apath.a.consolidate": "Att befästa",
  "apath.a.target": "Mål",
  "profile.preferences": "Inställningar",
  "profile.languages": "Språk",
  "profile.subscription": "Prenumeration",
  "profile.aiSettings": "AI-inställningar",
  "profile.notifications": "Aviseringar",
  "aiteacher.continue": "Idag fortsätter vi med",
  "aiteacher.work": "Idag arbetar vi med",
  "aiteacher.reviewFirst": "Men först tar vi en snabb repetition",
  "aiteacher.startLesson": "Starta lektionen",
  "aiteacher.empty": "Jag är din lärare. Berätta vad du vill lära dig, eller skanna en kurs för att börja.",
  "aiteacher.ready": "När du är redo.",
  "aiteacher.talkTitle": "Prata med din lärare",
  "aiteacher.topicPlaceholder": "Vad vill du prata om?",
  "aiteacher.talk": "Börja prata",
  "aiteacher.resume": "💬 Fortsätt vår konversation",
  "aiteacher.twinPick": "Låt din lärare välja din svaga punkt",
  "aiteacher.recent": "Senaste diskussioner",
  "aiteacher.messages": "meddelanden",
  "aiteacher.focusedOn": "fokuserade på",
  "aiteacher.untitled": "Namnlös diskussion",
  "aiteacher.open": "Öppna",
  "aiteacher.finishedLesson": "Igår avslutade vi lektionen om",
  "aiteacher.todayReview": "Idag föreslår jag att vi repeterar",
  "aiteacher.difficulties": "eftersom jag märkte att du hade vissa svårigheter.",
  "aiteacher.todayDiscover": "Idag sätter vi igång med",
  "aiteacher.thenNext": "Sedan går vi vidare till",
  "aiteacher.sessionCard": "Dagens pass",
  "aiteacher.objective": "Mål",
  "aiteacher.duration": "Beräknad tid",
  "aiteacher.levelLabel": "Nivå",
  "aiteacher.minutes": "min",
  "aiteacher.objReview": "Repetera och befäst",
  "aiteacher.objDiscover": "Förstå",
  "aiteacher.readyQ": "Redo?",
  "aiteacher.start": "▶  Starta",
  "level.beginner": "Nybörjare",
  "level.intermediate": "Medel",
  "level.advanced": "Avancerad",
  "lesson.opening": "Öppnar din lektion…",
  "lesson.pitchedAt": "nivå, anpassad för dig",
  "lesson.objectives": "Mål",
  "lesson.introduction": "Introduktion",
  "lesson.concept": "Begrepp",
  "lesson.explanation": "Förklaring",
  "lesson.objectiveLabel": "Mål",
  "lesson.example": "Exempel",
  "lesson.keyPoints": "Viktiga slutsatser",
  "lesson.examples": "Exempel",
  "lesson.questions": "Frågor",
  "lesson.exercises": "Övningar",
  "lesson.correction": "Rättelse",
  "lesson.summary": "Sammanfattning",
  "lesson.flashcards": "Instuderingskort",
  "lesson.revision": "Repetition",
  "lesson.homework": "Läxa",
  "lesson.reflect": "Fundera på det här innan du går vidare.",
  "lesson.readAloud": "Läs upp det här för mig",
  "lesson.yourAnswer": "Ditt svar",
  "lesson.submit": "Skicka in svar",
  "lesson.answerAgain": "Svara igen",
  "lesson.correct": "✓ Rätt",
  "lesson.notQuite": "✗ Inte helt rätt",
  "lesson.feedback": "Återkoppling",
  "lesson.rootCause": "Grundorsak",
  "lesson.showCorrections": "Visa modellsvaren",
  "lesson.hideCorrections": "Dölj modellsvaren",
  "lesson.reveal": "Tryck för att visa",
  "lesson.noFlashcards": "Inga flashcards för den här lektionen.",
  "lesson.cardsScheduled": "flashcards är schemalagda i din repetitionskö.",
  "lesson.reviewNow": "Repetera nu",
  "lesson.savePdf": "📄 Spara som PDF",
  "lesson.doHomework": "📝 Gör min läxa",
  "lesson.step": "Steg",
  "lesson.of": "av",
  "lesson.continue": "Fortsätt",
  "lesson.previous": "Tillbaka",
  "lesson.finish": "Avsluta lektionen",
  "lesson.finishSession": "Avsluta sessionen",
  "lesson.why": "Varför?",
  "lesson.how": "Hur?",
  "lesson.errorMade": "Vilket fel?",
  "lesson.howToAvoid": "Hur man undviker det?",
  "exercise.qcm": "Flerval",
  "exercise.open": "Öppen fråga",
  "exercise.exercise": "Övning",
  "exercise.case": "Praktiskt fall",
  "lesson.scheduleIn": "Jag schemalägger den här repetitionen om",
  "lesson.days": "dagar",
  "lesson.day": "dag",
  "lesson.scheduleWhy": "Varför? Eftersom intervallbaserad repetition förutsäger när du glömmer – och repeterar precis dessförinnan.",
  "lesson.scheduleNow": "De här datumen är redo. Repetera dem så schemalägger jag nästa precis i det ögonblick du är på väg att glömma.",
  "aiteacher.yesterday": "Igår gicks följande igenom",
  "aiteacher.beforeContinuing": "Innan vi fortsätter ska vi gå igenom de viktigaste idéerna.",
  "lang.dialogue": "Dialog",
  "lang.dialogueHelp": "En kort skriven konversation att studera.",
  "lang.scenarioPlaceholder": "Scenario (valfritt) – t.ex. på marknaden",
  "lang.generateDialogue": "Skapa en dialog",
  "lang.essay": "Rätta min text",
  "lang.essayHelp": "Skriv några meningar så rättar jag dem som en lärare.",
  "lang.essayPlaceholder": ",Skriv din text här…",
  "lang.correctEssay": "Rätta den",
  "lang.assessment": "Bedömning",
  "lang.correctedVersion": "Rättad version",
  "lang.noMistakes": "Inga misstag – snyggt jobbat!",
  "coach.title": "Din coach",
  "coach.suggestToday": "Idag föreslår jag:",
  "coach.min": "min",
  "coach.why": "Varför?",
  "mentor.why": "Varför jag föreslår detta",
  "mentor.act": "Nu kör vi",
  "mentor.dismiss": "Inte nu",
  "coachp.title": "Min studiecoach",
  "coachp.tileDetail": "Tempo, svårighetsgrad och metod — anpassat efter dig",
  "coachp.loading": "Läser av dina studievanor…",
  "coachp.state": "Var du står",
  "coachp.streak": "Svit",
  "coachp.discipline": "Disciplin",
  "coachp.week": "Denna vecka",
  "coachp.mastery": "Bemästring",
  "coachp.goals": "Mål",
  "coachp.pace": "Tempo",
  "coachp.difficulty": "Svårighetsgrad",
  "coachp.method": "Metod",
  "coachp.session": "Sessionslängd",
  "coachp.byCoach": "Coach",
  "coachp.byYou": "Ditt val",
  "coachp.reset": "Lämna tillbaka till coachen",
  "coachp.pace.gentle": "Lugn",
  "coachp.pace.steady": "Jämn",
  "coachp.pace.intensive": "Intensiv",
  "coachp.diff.beginner": "Nybörjare",
  "coachp.diff.intermediate": "Medel",
  "coachp.diff.advanced": "Avancerad",
  "coachp.method.practice": "Övning",
  "coachp.method.reading": "Läsning",
  "coachp.method.socratic": "Sokratisk",
  "coachp.method.mixed": "Blandad",
  "coachp.disc.strong": "Stark",
  "coachp.disc.building": "Bygger upp",
  "coachp.disc.irregular": "Oregelbunden",
  "coach.forgetting": "Du glömmer gradvis bort",
  "risk.title": "Framförhållning",
  "risk.tileDetail": "Risker framför dig – innan de inträffar",
  "risk.loading": "Analyserar vägen framåt…",
  "risk.intro": "Jag ser framåt och flaggar för riskerna på din väg – så att vi kan agera innan de blir problem.",
  "risk.calm": "Inga akuta risker just nu – du är på rätt spår.",
  "risk.cause": "Trolig orsak",
  "risk.action": "Rekommenderad åtgärd",
  "risk.why": "Signaler bakom detta",
  "risk.kind.dropout": "Risk för avhopp",
  "risk.kind.difficulty": "Svårigheter framöver",
  "risk.kind.overload": "Överbelastning",
  "risk.kind.motivation": "Motivationssvacka",
  "risk.kind.forgetting": "Troligt glömska",
  "risk.level.low": "Låg",
  "risk.level.moderate": "Måttlig",
  "risk.level.high": "Hög",
  "reco.title": "För dig",
  "reco.tileDetail": "Lektioner, övningar, läslesonger – utvalda för dig",
  "reco.loading": "Väljer det som passar dig…",
  "reco.intro": "Personliga förslag på allt du kan göra härnäst – var och en med en motivering.",
  "reco.empty": "Inget att föreslå just nu – kom tillbaka efter lite mer studier.",
  "reco.accept": "Nu kör vi",
  "reco.dismiss": "Inte nu",
  "reco.kind.lesson": "Ny lektion",
  "reco.kind.exercise": "Övningar",
  "reco.kind.reading": "Läsning",
  "reco.kind.review": "Repetition",
  "auth.headline": "Aktivera din digitala tvilling",
  "auth.emailPh": "du@example.com",
  "auth.namePh": "Ditt namn",
  "auth.createBtn": "Skapa mitt konto",
  "auth.forgot": "Glömt lösenordet?",
  "auth.noAccount": "Inget konto än?",
  "auth.otpTitle": "Bekräfta din e-post",
  "auth.otpSubtitle": "Ange den 6-siffriga kod som skickades till {email}.",
  "auth.verify": "Verifiera",
  "auth.notReceived": "Fick du den inte?",
  "auth.resend": "Skicka koden igen",
  "auth.resendIn": "Skicka igen om {n}s",
  "auth.skip": "Hoppa över detta steg",
  "auth.expired": "Koden har gått ut — begär en ny.",
  "auth.otpError": "Ogiltig kod. Försök igen.",
  "auth.forgotTitle": "Glömt lösenord",
  "auth.forgotSubtitle": "Ange din e-post så skickar vi en återställningskod.",
  "auth.sendCode": "Skicka kod",
  "auth.back": "Tillbaka",
  "auth.resetTitle": "Återställ lösenord",
  "auth.resetSubtitle": "Ange koden och ditt nya lösenord.",
  "auth.newPassword": "Nytt lösenord",
  "auth.reset": "Återställ",
  "auth.resetSent": "Om det finns ett konto för {email} har en återställningskod skickats.",
  "auth.resetOk": "Lösenordet har återställts — logga in.",
  "auth.codeSent": "En kod skickades till {email}.",
  "auth.newCodeSent": "Ny kod skickad.",
  "auth.2faTitle": "Tvåstegsverifiering",
  "auth.2faSubtitle": "Ange koden från din autentiseringsapp.",
  "auth.useRecovery": "Använd en återställningskod",
  "auth.recoveryPh": "Återställningskod",
  "reco.kind.practical": "Praktiskt",
  "reco.kind.document": "Dokument",
  "ment.title": "AI-mentor",
  "ment.tileDetail": "Ärlig vägledning om hur det faktiskt går för dig",
  "ment.loading": "Tar ett steg tillbaka för att se helheten…",
  "ment.intro": "Utöver dagens lektion – en ärlig bedömning av din framgång, tentaplugg, struktur, metod och självförtroende.",
  "ment.focus": "Fokus",
  "ment.why": "Vad jag baserar detta på",
  "ment.dim.success": "Studieframgång",
  "ment.dim.exams": "Tentaförberedelse",
  "ment.dim.organization": "Struktur",
  "ment.dim.method": "Arbetsmetod",
  "ment.dim.confidence": "Självförtroende",
  "ment.rating.good": "På rätt spår",
  "ment.rating.building": "Bygger",
  "ment.rating.concern": "Kräver arbete",
  "succ.title": "Framgångsprognos",
  "succ.tileDetail": "Dina chanser per tenta – och hur du ökar dem",
  "succ.loading": "Beräknar din tentaberedskap…",
  "succ.intro": "För varje tenta: hur förberedd du är, dina beräknade chanser och hur säker jag är.",
  "succ.note": "Målet är inte att förutsäga framtiden – det är att hjälpa dig förbereda dig bättre.",
  "succ.empty": "Inga kommande tentor – lägg till en för att se din beredskap.",
  "succ.preparation": "Förberedelse",
  "succ.probability": "Chans till framgång",
  "succ.confidence": "Modellens säkerhet",
  "succ.advice": "Så förbereder du dig",
  "succ.why": "Faktorer",
  "succ.in": "om",
  "succ.days": "dagar",
  "succ.today": "idag",
  "succ.band.low": "låg",
  "succ.band.medium": "medel",
  "succ.band.high": "hög",
  "ic.title": "Intelligenscenter",
  "ic.metricValue": "Styrkor, framsteg, nästa steg",
  "ic.loading": "Samlar din intelligens…",
  "ic.intro": "Allt AI:n har lärt sig om dig – styrkor, svagheter, framsteg, vanor, prestanda och vad som kan förbättras. Alltid med motivering.",
  "ic.cat.strengths": "Styrkor",
  "ic.cat.weaknesses": "Svagheter",
  "ic.cat.progress": "Framsteg",
  "ic.cat.habits": "Vanor",
  "ic.cat.performance": "Prestanda",
  "ic.cat.improvement": "Förbättringsområden",
  "dna.title": "Inlärnings-DNA",
  "dna.metricValue": "Hur du läser bäst",
  "dna.loading": "Analyserar ditt inlärnings-DNA…",
  "dna.intro": "Din djupa, stabila inlärningsprofil – hur du minns, när du presterar som bäst, samt vilka modaliteter och format som passar dig. Den förfinas i takt med att du lär dig.",
  "dna.maturity": "DNA kartlagt",
  "dna.interactions": "interaktioner inlärda från",
  "dna.trait.memory": "Hur du memorerar",
  "dna.trait.peakTime": "Topptid",
  "dna.trait.modality": "Inlärningsmodalitet",
  "dna.trait.explanation": "Förklaringsdjup",
  "dna.trait.retentionFormat": "Format med bäst retention",
  "dna.band.emerging": "framväxande",
  "dna.band.forming": "under bildande",
  "dna.band.established": "etablerad",
  "sync.title": "Synkcenter",
  "sync.tileDetail": "Arbeta offline – ändringar synkas när du är tillbaka",
  "sync.intro": "Fortsätt arbeta utan anslutning. Dina ändringar sparas och synkas automatiskt när du är online igen.",
  "sync.online": "Online",
  "sync.online.detail": "Ansluten – ändringar synkas omedelbart.",
  "sync.offline": "Offline",
  "sync.offline.detail": "Ingen anslutning – ändringarna sparas och synkas automatiskt.",
  "sync.pending": "Väntande ändringar",
  "sync.last": "Senaste synk",
  "sync.never": "Aldrig",
  "sync.now": "Synka nu",
  "sync.note": "Läsningar cachas så att din data förblir synlig offline; skrivningar köas och utförs i ordning när anslutningen är tillbaka.",
  "mon.title": "Övervakning",
  "mon.tileDetail": "Systemhälsa – trafik, latens, AI, cache",
  "mon.loading": "Läser systemhälsa…",
  "mon.intro": "Plattformens aktuella hälsa, baserat på processinterna mätvärden (exporteras även till Prometheus).",
  "mon.http": "HTTP-trafik",
  "mon.requests": "förfrågningar",
  "mon.errorRate": "felprocent",
  "mon.ai": "AI-anrop",
  "mon.aiCalls": "anrop",
  "mon.errors": "fel",
  "mon.avgLatency": "genomsnittlig latens",
  "mon.byModel": "Per modell",
  "mon.cache": "Cache",
  "mon.hitRate": "träffsäkerhet",
  "mon.hits": "träffar",
  "mon.misses": "missar",
  "mon.process": "Process",
  "mon.memory": "minne",
  "mon.heap": "heapminne",
  "mon.uptime": "drifttid",
  "mon.note": "Fel skickas också till Sentry/OpenTelemetry-integrationen (aktiv när en DSN har konfigurerats). Prometheus hämtar GET /metrics.",
  "lm.title": "Språk",
  "lm.manage": "Hantera språk",
  "lm.intro": "Alla gränssnittsspråk och hur kompletta de är. Att byta språk ändrar också AI-lärarens språk.",
  "lm.active": "Aktiv",
  "lm.translated": "översatt",
  "lm.fallback": "resten återgår till engelska",
  "lm.note": "Nya språk läggs till genom att lägga till en resursfil – ingen ändring av appens kod krävs. Oöversatta nycklar återgår automatiskt till engelska.",
  "aim.title": "AI-leverantörer",
  "aim.tileDetail": "Multimodell-orkestrerare – välj bäst / billigast / snabbast",
  "aim.loading": "Läser av AI-infrastrukturen…",
  "aim.intro": "Tillgängliga AI-backend-system och strategin som väljer mellan dem. Byte omdirigerar alla AI-anrop.",
  "aim.strategy": "Strategi",
  "aim.active": "Aktiv leverantör",
  "aim.catalog": "Leverantörer",
  "aim.ready": "Redo",
  "aim.off": "Av",
  "aim.cost": "kostnad",
  "aim.speed": "hastighet",
  "aim.quality": "kvalitet",
  "aim.vision": "vision",
  "aim.strat.quality": "Bäst",
  "aim.strat.cost": "Billigast",
  "aim.strat.speed": "Snabbast",
  "aim.strat.balanced": "Balanserad",
  "plg.title": "Tillägg",
  "plg.tileDetail": "Ytor, anslutningar och AI-motorer – färdplanen",
  "plg.loading": "Laddar tillägg…",
  "plg.intro": "Allt som Second Brain kan utvecklas till – enskilda plugin-program som registreras utan att röra kärnan.",
  "plg.active": "Aktiv",
  "plg.available": "Tillgänglig",
  "plg.planned": "Planerad",
  "plg.requires": "Kräver",
  "plg.note": "Plugin-motorn gör att nya Brains, anslutningar och AI-motorer kan läggas till utan en större omskrivning – appen kan utvecklas i åratal.",
  "coach.upToDate": "Du är uppdaterad – inget faller efter just nu.",
  "coach.score": "Inlärningspoäng",
  "coach.wouldRaise": "Denna repetition skulle höja dina inlärningspoäng med",
  "coach.points": "poäng",
  "coach.newScore": "Inte tillräckligt med data än – starta en lektion för att bygga upp dina poäng.",
  "briefing.hello": "Hej",
  "briefing.analyzed": "Jag har analyserat dina framsteg.",
  "briefing.recommend": "Idag rekommenderar jag:",
  "briefing.achievable": "Du kan nå ditt mål på {n} minuter.",
  "briefing.start": "Starta min session",
  "briefing.min": "min",
  "briefing.k.review": "Repetition",
  "briefing.k.lesson": "Ny lektion",
  "briefing.k.vocabulary": "Ordförråd",
  "briefing.upToDate": "Du är helt ajour – inget brådskande idag. En kort repetition hjälper ändå.",
  "homework.title": "Läxa",
  "homework.preparing": "Förbereder din personliga läxa…",
  "homework.focusLabel": "Varför denna läxa",
  "homework.masteryAt": "Anpassad till din nuvarande nivå:",
  "homework.exercises": "Övningar",
  "homework.questions": "Frågor",
  "homework.correction": "Rättelse",
  "homework.reflect": "Tänk igenom dessa – inget betyg, bara reflektion.",
  "homework.showAnswers": "Visa modellsvaren",
  "homework.hideAnswers": "Dölj modellsvaren",
  "homework.regenerate": "↻ Ny läxa",
  "homework.regenHint": "Generera om den, anpassad efter dina senaste framsteg.",
  "homework.back": "Tillbaka",
  "session.startGuided": "▶ Starta min ledda session",
  "session.welcome": "Din session",
  "session.yourSession": "Dagens session",
  "session.defaultPlan": "Jag guidar dig genom hela sessionen, steg för steg, och uppdaterar din Digital Twin i slutet.",
  "session.thePlan": "Planen",
  "session.start": "▶ Starta lektionen",
  "session.noLesson": "Den här sessionen har ingen lektion än.",
  "session.home": "Tillbaka till start",
  "session.closing": "Avslutar din session och uppdaterar din Digital Twin…",
  "session.done": "Sessionen slutförd",
  "session.whatWeDid": "Vad vi gjorde",
  "session.twinUpdate": "Uppdatering av Digital Twin",
  "session.before": "Före",
  "session.after": "Efter",
  "session.points": "p",
  "session.conceptMastery": "Behärskning av detta koncept:",
  "session.nowTracked": "Din Digital Twin spårar nu detta koncept.",
  "session.results": "Resultat",
  "session.exercisesRight": "övningar rätt",
  "session.cardsScheduled": "flashcards schemalagda (FSRS)",
  "session.nextReview": "Nästa repetition:",
  "session.reviewNow": "🔁 Repetera nu",
  "session.today": "idag",
  "session.tomorrow": "imorgon",
  "session.inDays": "dagar",
  "session.stageLesson": "Lektion",
  "session.stageQuestions": "Frågor",
  "session.stageExercises": "Övningar",
  "session.stageCorrection": "Rättning",
  "session.stageSummary": "Sammanfattning",
  "session.stageFlashcards": "Instuderingskort",
  "session.stageFsrs": "FSRS-schemaläggning",
  "session.stageTwin": "Uppdatering av Digital Twin",
  "twin.title": "Digital tvilling",
  "twin.intro": "Din inlärningsprofil – den utvecklas efter varje interaktion.",
  "twin.loading": "Läser av din Digital Twin…",
  "twin.notEnough": "Inte tillräckligt med data än",
  "twin.progress": "Totala framsteg",
  "twin.conceptsTracked": "koncept spårade",
  "twin.lessons": "lektioner",
  "twin.evolves": "Lär sig kontinuerligt",
  "twin.interactions": "interaktioner hittills",
  "twin.level": "Verklig nivå",
  "twin.speed": "Inlärningstakt",
  "twin.subjects": "Favoritämnen",
  "twin.style": "Inlärningsstil",
  "twin.depth": "Förklaringsdjup",
  "twin.language": "Föredraget språk",
  "twin.rhythm": "Arbetsrytm",
  "twin.focus": "Fokustimmar",
  "twin.band.new": "Precis startat",
  "twin.band.weak": "Bräcklig",
  "twin.band.building": "Bygger upp",
  "twin.band.strong": "Stark",
  "twin.speed.building": "Bygger upp",
  "twin.speed.steady": "Jämn",
  "twin.speed.fast": "Snabb",
  "twin.style.voice": "Talad",
  "twin.style.handsOn": "Praktiskt",
  "twin.style.reading": "Läsning",
  "twin.depth.simple": "Enkelt, steg för steg",
  "twin.depth.balanced": "Balanserat",
  "twin.depth.deep": "På djupet",
  "twin.rhythm.occasional": "Sällan",
  "twin.rhythm.regular": "Regelbunden",
  "twin.rhythm.intensive": "Intensiv",
  "twin.focus.morning": "Morgon",
  "twin.focus.afternoon": "Eftermiddag",
  "twin.focus.evening": "Kväll",
  "twin.focus.night": "Natt",
  "memory.title": "Inlärningsminne",
  "memory.intro": "Allt du har gjort – så att AI:n aldrig börjar från noll.",
  "memory.loading": "Öppnar ditt inlärningsminne…",
  "memory.remembered": "minnen som kom ihåg",
  "memory.timeline": "Tidslinje",
  "memory.empty": "Inget minne än – starta en lektion så visas det här.",
  "memory.exercises": "Övningar",
  "memory.successes": "Framgångar",
  "memory.errors": "Misstag",
  "memory.revisions": "Repetitionen",
  "memory.conversations": "Konversationer",
  "memory.homework": "Läxor",
  "memory.reports": "Rapporter",
  "memory.documents": "Dokument",
  "memory.k.lesson": "Lektion",
  "memory.k.success": "Framgång",
  "memory.k.error": "Misstag",
  "memory.k.revision": "Repetition",
  "memory.k.conversation": "Konversation",
  "memory.k.homework": "Läxa",
  "memory.k.report": "Sessionsrapport",
  "memory.k.document": "Dokument",
  "mastery.title": "Begreppsbehärskning",
  "mastery.intro": "Varje begrepp får en poäng – det mest brådskande att repetera först.",
  "mastery.loading": "Beräknar poäng för dina begrepp…",
  "mastery.empty": "Inga begrepp ännu – studera en lektion kopplad till ett begrepp för att se dess poäng.",
  "mastery.mastery": "Bemästring",
  "mastery.confidence": "Självförtroende",
  "mastery.errors": "Misstag",
  "mastery.forgetting": "Glömska",
  "mastery.priority": "Repetitions-prioritet",
  "mastery.conf.low": "Låg",
  "mastery.conf.medium": "Medel",
  "mastery.conf.high": "Hög",
  "mastery.err.none": "Ingen",
  "mastery.err.low": "Sällsynt",
  "mastery.err.high": "Frekvent",
  "mastery.prio.low": "Låg",
  "mastery.prio.medium": "Medel",
  "mastery.prio.high": "Hög",
  "mastery.prio.urgent": "Brådskande",
  "graph.title": "Kunskapsgraf",
  "graph.intro": "Hur dina begrepp är beroende av varandra – grunderna först.",
  "graph.loading": "Karterar dina begrepp…",
  "graph.empty": "Inga begrepp ännu – studera några och länka dem sedan för att se grafen.",
  "graph.s.mastered": "Bemästrade",
  "graph.s.in_progress": "Pågår",
  "graph.s.ready": "Redo",
  "graph.s.at_risk": "I riskzonen",
  "graph.s.blocked": "Blockerad",
  "sw.title": "Styrkor & svagheter",
  "sw.intro": "Det du är bra på och det som börjar glömma bort — AI:n planerar dina nästa pass utifrån detta.",
  "sw.loading": "Väger dina begrepp…",
  "sw.strengths": "Styrkor",
  "sw.weaknesses": "Svagheter",
  "sw.noStrengths": "Inga starka begrepp ännu – fortsätt så!",
  "sw.noWeaknesses": "Inget som glöms bort just nu. Bra jobbat!",
  "sw.aiNote": "AI:n kommer att fokusera dina nästa pass på dessa svaga punkter först.",
  "sw.startWeakest": "▶ Arbeta på mina svaga punkter",
  "rec.title": "Rekommendationer",
  "rec.intro": "Din mentors nästa steg – inte bara analys, utan vad du bör göra nu.",
  "rec.loading": "Funderar på ditt nästa steg…",
  "rec.empty": "Inget att rekommendera ännu – plugga lite så vägleder jag dig.",
  "rec.review": "Jag rekommenderar en repetition på {m} minuter av {s}.",
  "rec.consolidate": "Konsolidera {s} innan du tar dig an något nytt.",
  "rec.levelUp": "Du har bemästrat {s} – redo för nästa nivå.",
  "rec.advance": "Allt är stabilt – du är redo att lära dig något nytt.",
  "rec.cta.review": "🔁 Repetera nu",
  "rec.cta.consolidate": "🧱 Konsolidera",
  "rec.cta.levelUp": "🎓 Gå till nästa nivå",
  "rec.cta.advance": "🚀 Lär dig något nytt",
  "insight.title": "AI-insikter",
  "insight.intro": "Varför AI:n föreslår det den gör – hämtat från din faktiska aktivitet.",
  "insight.loading": "Läser av signalerna…",
  "insight.empty": "Inte tillräckligt med aktivitet ännu – plugga lite så dyker det upp insikter.",
  "insight.days": "dagar",
  "insight.interactions": "interaktioner",
  "insight.strengthA": "Du gör goda framsteg i",
  "insight.forgetA": "Du tenderar att glömma",
  "insight.forgetB": "efter ungefär",
  "insight.atRiskA": "Du glömmer bort",
  "insight.atRiskB": "– repetera det först.",
  "insight.focusA": "Du läser bäst mellan",
  "insight.focusB": "och",
  "insight.accA": "Du svarar",
  "insight.accB": "av dina övningar korrekt.",
  "insight.rhythmA": "Du har arbetat",
  "insight.styleA": "Du läser bäst genom",
  "insight.rhythm.occasional": "ibland",
  "insight.rhythm.regular": "regelbundet",
  "insight.rhythm.intensive": "intensivt",
  "insight.style.voice": "lyssning",
  "insight.style.handsOn": "övning",
  "insight.style.reading": "läsning",
  "tutor.discussion": "Diskussion",
  "tutor.opening": "Öppnar diskussionen…",
  "tutor.focusedOn": "Fokuserad på",
  "tutor.placeholder": "Fråga din lärare…",
  "tutor.send": "Skicka",
  "tutor.slower": "🐢 Långsammare",
  "tutor.faster": "🐇 Snabbare",
  "tutor.slowerMsg": "Kan du sakta ner och förklara det enklare?",
  "tutor.stopSend": "Stoppa & skicka",
  "tutor.cancel": "Avbryt",
  "tutor.speak": "🎤 Tala i stället",
  "tutor.voiceUnsupported": "Rösten behöver en mikrofon – inte tillgänglig i den här plattformsversionen än.",
  "tutor.recording": "Spelar in… prata och stoppa sedan.",
  "tutor.you": "Du",
  "tutor.teacher": "Lärare",
  "tutor.spoken": "🎤 talad",
  "tutor.transcribing": "Transkriberar, svarar och skriver lektionen denna omgång lämnar efter sig…",
  "tutor.teacherSpeaking": "🔊 Läraren svarar högt…",
  "tutor.heard": "Hört:",
  "tutor.filedA": "— en skriven lektion",
  "tutor.filedInto": "arkiverades i ditt minne med",
  "tutor.flashcards": "instuderingskort",
  "tutor.groundedPre": "Baserat på",
  "tutor.groundedPassage": "textstycke",
  "tutor.groundedPassages": "textstycken",
  "tutor.groundedPost": "från dina anteckningar:",
  "header.lesson": "Lektion",
  "header.newLesson": "Ny lektion",
  "header.aiTeacher": "AI-lärare",
  "header.teacher": "Lärare",
  "header.homework": "Läxa",
  "header.session": "Studiepass",
  "header.twin": "Digital tvilling",
  "header.memory": "Inlärningsminne",
  "header.mastery": "Begreppsbehärskning",
  "header.graph": "Kunskapsgraf",
  "header.strengths": "Styrkor och svagheter",
  "header.insights": "AI-insikter",
  "header.recommend": "Rekommendationer",
  "header.revEngine": "Revisionsmotor",
  "header.planner": "Studieplanerare",
  "header.daily": "Dagligt pass",
  "header.calendar": "Smart kalender",
  "header.predictions": "Prediktiv repetition",
  "header.notifications": "Smarta aviseringar",
  "header.adaptivePath": "Anpassad väg",
  "header.goals": "Mål",
  "header.exams": "Kommande tentor",
  "header.library": "Bibliotek",
  "header.document": "Dokument",
  "header.ask": "Fråga mitt bibliotek",
  "header.resource": "Studieresurs",
  "header.workspace": "Akademisk arbetsyta",
  "lib.title": "Bibliotek",
  "lib.tileDetail": "Ditt levande, AI-organiserade bibliotek",
  "lib.intro": "Varje dokument du lägger till förstås av AI:n: sammanfattning, ämne, språk, begrepp och svårighetsgrad – allt sker automatiskt.",
  "lib.loading": "Öppnar ditt bibliotek…",
  "lib.all": "Alla",
  "lib.favorites": "Favoriter",
  "lib.recent": "Senaste",
  "lib.shared": "Delade",
  "lib.trash": "Papperskorg",
  "lib.subjects": "Ämnen",
  "lib.languages": "Språk",
  "lib.collections": "Samlingar",
  "lib.empty": "Inga dokument här än.",
  "lib.sharedSoon": "Delning kommer i ett senare skede – inget har delats än.",
  "lib.analysing": "AI:n analyserar fortfarande detta dokument…",
  "lib.pipelineRunning": "Automatisk bearbetning…",
  "lib.stage.cleaning": "Rensar",
  "lib.stage.segmenting": "Segmenterar",
  "lib.stage.embedding": "Inbäddningar",
  "lib.stage.indexing": "Indexerar",
  "lib.stage.graphing": "Kunskapsgraf",
  "lib.add": "＋ Lägg till",
  "lib.scan": "Skanna",
  "lib.addText": "📝 Text",
  "lib.addUrl": "🔗 URL",
  "lib.addTitle": "Titel",
  "lib.addBody": "Klistra in dina anteckningar / din text här…",
  "lib.addBtn": "Lägg till i biblioteket",
  "lib.addFile": "📄 Importera en fil (PDF, txt, md)",
  "lib.addTextRequired": "En titel och lite text krävs.",
  "lib.addUrlRequired": "En URL krävs.",
  "lib.diff.beginner": "Nybörjare",
  "lib.diff.intermediate": "Medel",
  "lib.diff.advanced": "Avancerad",
  "lib.status.pending": "I kö",
  "lib.status.processing": "Analyserar",
  "lib.status.ready": "Klar",
  "lib.status.failed": "Misslyckades",
  "lib.summary": "AI-sammanfattning",
  "lib.concepts": "Identifierade begrepp",
  "lib.noConcepts": "Inga begrepp identifierade än — tryck på \"Identifiera begrepp\".",
  "lib.content": "Innehåll",
  "lib.unknown": "Ej identifierat",
  "lib.chars": "tecken",
  "lib.m.subject": "Ämne",
  "lib.m.language": "Språk",
  "lib.m.difficulty": "Svårighetsgrad",
  "lib.m.author": "Författare",
  "lib.m.collection": "Samling",
  "lib.m.added": "Tillagd",
  "lib.m.size": "Storlek",
  "lib.reanalyse": "🤖 Analysera om",
  "lib.detectConcepts": "🧩 Identifiera begrepp",
  "lib.restore": "♻️ Återställ",
  "lib.moveToTrash": "🗑️ Flytta till papperskorgen",
  "lib.deleteForever": "Radera permanent",
  "lib.askLibrary": "Fråga",
  "lib.askThisDoc": "❓ Fråga om det här dokumentet",
  "lib.ask.title": "Fråga mitt bibliotek",
  "lib.ask.intro": "Ställ en fråga – besvaras endast utifrån dina egna dokument, med källhänvisningar. Inget hittas på.",
  "lib.ask.scope": "Sök i",
  "lib.ask.all": "Hela biblioteket",
  "lib.ask.thisDoc": "Det här dokumentet",
  "lib.ask.placeholder": "t.ex. Vilka är fotosyntesens faser?",
  "lib.ask.btn": "Fråga",
  "lib.ask.answer": "Svar",
  "lib.ask.noContext": "Inget relevant hittades inom detta omfång – prova en annan fråga eller utöka omfånget.",
  "lib.ask.sources": "Källor",
  "lib.u.title": "AI-förståelse",
  "lib.u.summarize": "Sammanfatta",
  "lib.u.rephrase": "Omformulera",
  "lib.u.simplify": "Förenkla",
  "lib.u.explain": "Förklara",
  "lib.u.adapted": "Anpassat till din nivå:",
  "lib.u.compareTitle": "Jämför",
  "lib.u.compare": "Jämför med ett annat dokument",
  "lib.u.noOther": "Inget annat dokument att jämföra med än.",
  "lib.u.prereqTitle": "Förkunskaper",
  "lib.u.reviewFirst": "Gå igenom dessa innan du studerar det här dokumentet:",
  "lib.u.untracked": "ej spårad",
  "lib.level.new": "ny",
  "lib.level.beginner": "nybörjare",
  "lib.level.intermediate": "medel",
  "lib.level.advanced": "avancerad",
  "lib.r.title": "Studiematerial",
  "lib.r.saved": "Sparat material",
  "lib.r.summary": "Sammanfattning",
  "lib.r.revisionSheet": "Revisionsblad",
  "lib.r.flashcards": "Instuderingskort",
  "lib.r.quiz": "Quiz",
  "lib.r.exercises": "Övningar",
  "lib.r.openQuestions": "Öppna frågor",
  "lib.r.coursePlan": "Kursplan",
  "lib.r.mindmap": "Mindmap (kommer snart)",
  "lib.r.review": "🎴 Repetera nu",
  "lib.workspace": "🎓 Akademisk arbetsyta",
  "ws.title": "Akademisk arbetsyta",
  "ws.analysing": "Läraren analyserar detta arbete…",
  "ws.analysisTitle": "Analys",
  "ws.levelAdapted": "anpassat till:",
  "ws.objectives": "Mål",
  "ws.skills": "Utvärderade färdigheter",
  "ws.prerequisites": "Förkunskaper",
  "ws.successCriteria": "Framgångskriterier",
  "ws.keyNotions": "Nyckelbegrepp",
  "ws.likelyHard": "Troligen svårt för dig",
  "ws.chooseMode": "Välj typ av stöd",
  "ws.mode.guide": "Vägledning",
  "ws.mode.accompany": "Lös tillsammans",
  "ws.mode.solve": "Fullständig lösning",
  "ws.thinking": "Läraren tänker…",
  "ws.placeholder": "Fråga, svara eller dela ditt försök…",
  "ws.send": "Skicka",
  "ws.finishTitle": "Gör det här arbetet till ett lärtillfälle",
  "ws.finishHint": "Generera en sammanfattning, flashcards och ett quiz från detta arbete — sparats i ditt bibliotek och matas in i din repetition.",
  "ws.generate": "Generera studiematerial",
  "ws.generated": "✅ Resurser genererade och sparade — kolla dokumentets resurser.",
  "lib.integ.title": "Hjärnintegration",
  "lib.integ.summary": "Detta dokument lade till {c} koncept, {ch} minnesavsnitt och {e} grafkoppling(ar) till din hjärna.",
  "lib.integ.new": "Nya koncept",
  "lib.integ.known": "Redan kända (från andra dok.)",
  "lib.integ.mastered": "Redan bemästrade",
  "lib.integ.fragile": "Fortfarande svaga",
  "lib.integ.prereq": "Förkunskaper",
  "lib.integ.dependents": "Bygger mot",
  "lib.integ.links": "Kopplingar till befintlig kunskap",
  "goals.tileDetail": "Dagligen, veckovis och månadsvis mål",
  "goals.title": "Mål",
  "goals.intro": "Vad vill du uppnå? Sätt upp mål för idag, den här veckan och den här månaden.",
  "goals.placeholder": "t.ex. Slutför genetikkapitlet",
  "goals.addBtn": "Lägg till mål",
  "goals.daily": "Dagligen",
  "goals.weekly": "Veckovis",
  "goals.monthly": "Månadsvis",
  "goals.none": "Inga mål än.",
  "goals.loading": "Laddar dina mål…",
  "exams.tileDetail": "Ämnen, datum och beredskap",
  "exams.title": "Kommande tentor",
  "exams.intro": "Dina tentor, sorterade efter datum. Beredskapen uppskattas utifrån din begreppsmisär.",
  "exams.placeholder": "Ämne (t.ex. Genetik)",
  "exams.addBtn": "Lägg till tenta",
  "exams.none": "Ingen tenta schemalagd.",
  "exams.loading": "Laddar dina tentor…",
  "exams.prep": "Redo",
  "exams.prepUnknown": "Inte tillräckligt med data än",
  "exams.p.high": "Hög",
  "exams.p.medium": "Medel",
  "exams.p.low": "Låg",
  "exams.in3": "Om 3 dagar",
  "exams.in7": "Om 1 vecka",
  "exams.in14": "Om 2 veckor",
  "exams.in30": "Om 1 månad",
  "exams.past": "Tidigare",
  "exams.today": "Idag",
  "exams.tomorrow": "Imorgon",
  "exams.in": "om",
  "exams.days": "dagar",
  "header.languages": "Språk",
  "header.language": "Språk",
  "header.scan": "Skanna en kurs",
  "header.revision": "Repetition",
  "header.progress": "Framsteg",
  "header.health": "Systemhälsa",
  "verdict.correct": "rätt",
  "verdict.partial": "delvis",
  "verdict.incorrect": "fel",
  "rating.good": "bra",
  "rating.fair": "godkänd",
  "rating.needs_work": "kräver arbete",
  "examiner.title": "📝 AI-examinator",
  "examiner.intro": "Läraren blir din examinerande — skapar bedömningen och rättar den sedan med förklaringar och råd. Betyget står aldrig ensamt.",
  "examiner.create": "Skapa en bedömning",
  "examiner.topicPlaceholder": "Ämne – t.ex. franska revolutionen",
  "examiner.difficulty": "Svårighetsgrad",
  "examiner.createTake": "Skapa och gör",
  "examiner.emptyTitle": "Inga bedömningar än",
  "examiner.emptyDetail": "Välj en typ och ett ämne ovan – flervalsfrågor, öppna frågor, uppsatser, övningar, fallstudier, provtenta eller muntlig utvärdering.",
  "examiner.questionsCount": "{n} fråga/frågor",
  "examiner.scored": "fick {n}/100",
  "examiner.notTaken": "ej gjord",
  "examiner.review": "Granska",
  "examiner.take": "Gör den",
  "examiner.levelWord": "nivå",
  "examiner.question": "Fråga",
  "examiner.points": "{n} p",
  "examiner.yourAnswer": "Ditt svar…",
  "examiner.why": "Varför: ",
  "examiner.how": "Hur: ",
  "examiner.mistake": "Misstag: ",
  "examiner.avoid": "Undvik detta: ",
  "examiner.submit": "Skicka in för rättning",
  "examiner.next": "Vad du bör göra härnäst",
  "examiner.back": "Tillbaka till bedömningar",
  "examiner.t.mcq": "Flervalsfråga",
  "examiner.t.open": "Öppna frågor",
  "examiner.t.dissertation": "Uppsats",
  "examiner.t.exercise": "Övningar",
  "examiner.t.case_study": "Fallstudie",
  "examiner.t.mock_exam": "Provtenta",
  "examiner.t.oral": "Muntlig utvärdering",
  "writing.title": "✍️ Skrivcoach",
  "writing.intro": "Lämna in en text – läraren analyserar struktur, logik, tydlighet, stavning, grammatik, argumentation och akademisk kvalitet, och förklarar sedan exakt hur du kan förbättra den.",
  "writing.new": "Ny inlämning",
  "writing.titlePlaceholder": "Titel (valfritt)",
  "writing.briefPlaceholder": "Uppgiften / instruktionen som besvaras (valfritt)",
  "writing.textPlaceholder": "Klistra in din text här…",
  "writing.review": "Granska min text",
  "writing.emptyTitle": "Inga inlämningar än",
  "writing.emptyDetail": "Klistra in en uppsats, rapport, avhandling eller valfri text ovan för en fullständig och strukturerad genomgång.",
  "writing.scored": "fick {n}/100",
  "writing.open": "Öppna granskning",
  "writing.reviewTitle": "Textgranskning",
  "writing.works": "Vad som fungerar",
  "writing.improve": "Förbättringsförslag: ",
  "writing.first": "Börja med detta",
  "writing.back": "Tillbaka till texten",
  "writing.t.redaction": "Uppsats",
  "writing.t.dissertation": "Avhandling",
  "writing.t.memoire": "Examensarbete",
  "writing.t.rapport": "Rapport",
  "writing.t.compte_rendu": "Sammanfattning",
  "writing.t.devoir": "Läxa",
  "writing.d.structure": "Struktur",
  "writing.d.logic": "Logik",
  "writing.d.clarity": "Tydlighet",
  "writing.d.spelling": "Stavning",
  "writing.d.grammar": "Grammatik",
  "writing.d.argumentation": "Argumentation",
  "writing.d.academic_quality": "Akademisk kvalitet",
  "reading.title": "📖 Läs-tränare",
  "reading.intro": "Få en text anpassad för din nivå med läsförståelsefrågor. Tränaren rättar dina svar och anpassar svårighetsgraden automatiskt.",
  "reading.yourLevel": "Din läsnivå",
  "reading.topicPlaceholder": "Ämne (valfritt) – t.ex. vulkaner, ekonomin…",
  "reading.generate": "Generera en text",
  "reading.emptyTitle": "Inga texter än",
  "reading.emptyDetail": "Generera din första text ovan – nivån anpassas allt eftersom.",
  "reading.scored": "fick {n}/100",
  "reading.notTaken": "ej gjord",
  "reading.review": "Granska",
  "reading.read": "Läs den",
  "reading.levelWord": "nivå",
  "reading.question": "Fråga",
  "reading.yourAnswer": "Ditt svar…",
  "reading.mistake": "Misstag: ",
  "reading.avoid": "Undvik detta: ",
  "reading.submit": "Lämna in svar",
  "reading.back": "Tillbaka till läsning",
  "reading.levelUp": "⬆ Nivå upp: {from} → {to}",
  "reading.levelDown": "⬇ Enklare nästa gång: {from} → {to}",
  "reading.levelHeld": "Nivån behålls på {to}",
  "reading.lvl.beginner": "nybörjare",
  "reading.lvl.intermediate": "medel",
  "reading.lvl.advanced": "avancerad",
  "reading.lvl.expert": "expert",
  "lang.learnTitle": "Lär dig ett språk",
  "lang.langPlaceholder": "Språk (t.ex. spanska)",
  "lang.nativePlaceholder": "Ditt modersmål (för översättningar)",
  "lang.teachingMode": "Undervisningsläge",
  "lang.start": "Starta",
  "lang.noLangsTitle": "Inga språk än",
  "lang.noLangsDetail": "Din lärare bygger in glosor i din vanliga repetitionskö, leder inlevelsefulla konversationer och bedömer hur väl du blir förstådd när du läser högt.",
  "lang.fromNative": "från {native}",
  "lang.open": "Öppna",
  "lang.metaWords": "ord",
  "lang.metaDue": "förfaller",
  "lang.metaLessons": "lektioner",
  "lang.immersionBadge": "🌊 Språkbad · ~{pct}% {lang}",
  "lang.immersionHelp": "Din lärare stannar kvar på {lang}, omformulerar och förklarar kort om du tappar tråden, och återgår sedan till {lang} — och pratar mer {lang} i takt med att din CEFR-nivå stiger.",
  "lang.skills": "Grammatik, böjning och förståelse",
  "lang.skillsHelp": "Anpassad efter din CEFR-nivå ({level}). Lämna rutan tom för att låta läraren välja, eller ange ett ämne / ett verb.",
  "lang.skillPlaceholder": "Ämne eller verb (valfritt) — t.ex. preteritum, être",
  "lang.grammar": "📖 Grammatik",
  "lang.conjugation": "🔤 Böjning",
  "lang.comprehension": "📝 Förståelse",
  "lang.listen": "🔊 Lyssna (hörförståelse)",
  "lang.conversation": "Konversation",
  "lang.conversationHelp": "Övningen körs i din vanliga diskussionsskärm — läraren behåller sin roll och lämnar aldrig målspråket i immersion-läget.",
  "lang.scenarioConvo": "Scenario (valfritt) — t.ex. på apoteket",
  "lang.startTalking": "Börja prata",
  "lang.vocabulary": "Ordforråd",
  "lang.vocabularyHelp": "Klistra in vad som helst du läser. Orden blir vanliga FSRS-kort så att de dyker upp i din repetitionskö tillsammans med allt annat.",
  "lang.vocabPlaceholder": "Klistra in text på ditt målspråk…",
  "lang.mineVocab": "Plocka glosor",
  "lang.vocabResult": "{n} nya ord har lagts till i din repetitionskö{had}.",
  "lang.vocabHad": " ({n} hade du redan)",
  "lang.lesson": "Lektion",
  "lang.lessonPlaceholder": "Vad ska vi gå igenom? t.ex. beställa mat",
  "lang.writeLesson": "Skriv en lektion åt mig",
  "lang.sayOutLoud": "Säg det högt",
  "lang.sayHelp": "Detta mäter om ditt tal KÄNDES IGJEN som frasen — en verklig kontroll av att bli förstådd, inte en poäng på brytning.",
  "lang.phrasePlaceholder": "Fras att läsa högt",
  "lang.needsMic": "Kräver mikrofon — endast webbversionen tills vidare.",
  "lang.stopScore": "Stoppa och betygsätt",
  "lang.record": "🎤 Spela in",
  "lang.understoodPct": "{pct}% av orden förstods",
  "lang.heard": "Hörde: “{text}”",
  "lang.pronCoach": "Uttalscoach",
  "lang.pronCoachHelp": "Tala fritt — läraren lyssnar och coachar dig i uttal, brytning, rytm, flyt och intonation. Målet är att bli förstådd, inte perfektion.",
  "lang.coachContextPlaceholder": "Vad pratar ni om? (valfritt) — t.ex. presentera dig själv",
  "lang.stopCoaching": "⏹ Stoppa och få coaching",
  "lang.speakFreely": "🎙️ Tala fritt",
  "lang.whyMatters": "Varför det är viktigt",
  "lang.howImprove": "Hur du kan förbättra dig",
  "lang.coachExercises": "Övningar",
  "lang.d.pronunciation": "uttal",
  "lang.d.accent": "brytning",
  "lang.d.rhythm": "rytm",
  "lang.d.fluency": "flyt",
  "lang.d.intonation": "intonation",
  "langmode.beginner": "nybörjare",
  "langmode.intermediate": "medel",
  "langmode.advanced": "avancerad",
  "langmode.academic": "akademisk",
  "langmode.professional": "professionell",
  "langmode.exam_prep": "inför prov",
  "langmode.immersion": "språkbad",
  "strategy.socratic": "Sokratiska metoden",
  "strategy.project_based": "Projektbaserat",
  "strategy.problem_solving": "Problemlösning",
  "strategy.case_study": "Fallstudie",
  "strategy.task_based": "Uppgiftsbaserat",
  "strategy.guided_demonstration": "Guidad demonstration",
  "strategy.active_learning": "Aktivt lärande",
  "strategy.experiential": "Erfarenhetsbaserat",
  "common.backToday": "Tillbaka till idag",
  "health.title": "Systemhälsa",
  "health.unreachable": "Inte nåbar",
  "health.allOk": "Alla system fungerar",
  "health.degraded": "Nedsatt funktion",
  "health.up": "uppe",
  "health.down": "nede",
  "health.refresh": "Uppdatera",
  "revision.loading": "Laddar din kö…",
  "revision.queueCleared": "Kön är tom",
  "revision.nothingDue": "Inget att göra just nu",
  "revision.clearedDetail": "Du har repeterat {n} kort. Din nästa revision är redan schemalagd till den tidpunkt då du mest sannolikt kommer att glömma.",
  "revision.nothingDetail": "FSRS schemalägger varje kort till stunden precis innan du skulle glömma det. Kom tillbaka när något förfaller.",
  "revision.counter": "{i} av {total} · {done} klara",
  "revision.tapReveal": "Tryck för att visa",
  "revision.reveal": "Visa svar",
  "revision.again": "Igen",
  "revision.hard": "Svårt",
  "revision.good": "Bra",
  "revision.easy": "Enkelt",
  "lessonNew.writing": "Skriver din lektion",
  "lessonNew.detail": "Din lärare skriver hela lektionen, genererar övningar och flashcards och lagrar det i ditt långtidsminne. Detta tar en stund.",
  "scan.title": "Skanna din kurs",
  "scan.help": "Fotografera en sida, en whiteboard eller dina handskrivna anteckningar. Din lärare läser den, behåller originalspråket och lagrar det i ditt långtidsminne – upp till {max} sidor åt gången.",
  "scan.takePhoto": "📷 Ta ett foto",
  "scan.chooseImages": "Välj bilder",
  "scan.pagesReady": "{n} sida(-or) redo",
  "scan.remove": "Ta bort",
  "scan.titlePlaceholder": "Titel (valfritt – hämtas annars från sidan)",
  "scan.readPages": "Läs dessa sidor",
  "scan.reading": "Läser dina sidor… detta tar en stund.",
  "scan.scanAnother": "Skanna en till",
  "scan.filed": "Sparat i ditt minne",
  "scan.filedDetail": "{n} tecken lästa. Det indexeras nu – när det är klart är det sökbart, och din lärare kan bygga lektioner kring det.",
  "scan.cameraRefused": "Kameraåtkomst nekades. Tillåt kameran och försök igen.",
  "progress.currentStreak": "Nuvarande svit",
  "progress.longest": "Längsta",
  "progress.activeDays": "Aktiva dagar",
  "progress.days": "dagar",
  "progress.yourNumbers": "Dina siffror",
  "progress.cardsReviewed": "Kort repeterade",
  "progress.retention": "Minnesgrad",
  "progress.noReviews": "inga recensioner än",
  "progress.dueNow": "Förfaller just nu",
  "progress.conceptsMastered": "Bemästrade koncept",
  "progress.atRisk": "Koncept i riskzonen",
  "progress.lessonsCompleted": "Genomförda lektioner",
  "progress.exercisesCorrect": "Rätt svarade övningar",
  "progress.milestones": "Milstolpar",
  "progress.askMentor": "Fråga din mentor",
  "sub.tileDetail": "Din plan och tillgängliga planer.",
  "sub.title": "Prenumeration",
  "sub.intro": "Din nuvarande plan och allt som erbjuds. Gränser och förmåner per plan definieras – priser och utcheckning kommer snart.",
  "sub.current": "Nuvarande plan",
  "sub.currentPlan": "Nuvarande plan",
  "sub.choose": "Välj",
  "sub.pricingSoon": "Priser kommer snart",
  "sub.note": "Planen kan bytas fritt för tillfället – betalning och begränsningar per plan kommer i en senare uppdatering.",
  "sub.status.active": "Aktiv",
  "sub.status.trialing": "Provperiod",
  "sub.status.past_due": "Förfallen",
  "sub.status.canceled": "Avbruten",
  "sub.status.incomplete": "Ofullständig",
  "sub.audience.individual": "Individuell",
  "sub.audience.organization": "Organisation",
  "sub.cancel": "Säg upp plan",
  "sub.willCancel": "sägs upp vid periodens slut",
  "sub.invoices": "Fakturor",
  "sub.noInvoices": "Inga fakturor ännu.",
  "profile.usage": "Användning och kvoter",
  "usage.tileDetail": "Hur mycket av dina plankvoter du har använt.",
  "usage.title": "Användning och kvoter",
  "usage.intro": "Vad du har använt under denna period i förhållande till dina plankvoter.",
  "usage.note": "Gränserna beror på din plan och nollställs varje period.",
  "usage.unlimited": "Obegränsat",
  "usage.gb": "GB",
  "usage.min": "min",
  "usage.metric.documents": "Dokument",
  "usage.metric.storage": "Lagring",
  "usage.metric.ai_questions": "AI-frågor",
  "usage.metric.voice_minutes": "Röstminuter",
  "profile.orgs": "Organisationer",
  "org.tileDetail": "Skolor, universitet och team som du tillhör.",
  "org.title": "Organisationer",
  "org.intro": "Skolor, universitet, utbildningscentra och företag som du tillhör.",
  "org.create": "Skapa en organisation",
  "org.createBtn": "Skapa",
  "org.namePlaceholder": "Namn – t.ex. Lincoln High School",
  "org.type.school": "Skola",
  "org.type.university": "Universitet",
  "org.type.training_center": "Utbildningscenter",
  "org.type.enterprise": "Företag",
  "org.role.admin": "Administratör",
  "org.role.teacher": "Lärare",
  "org.role.student": "Student",
  "org.memberCount": "{n} medlemmar",
  "org.open": "Öppna",
  "org.emptyTitle": "Inga organisationer ännu",
  "org.emptyDetail": "Skapa en ovan, eller be en administratör att lägga till dig i sin.",
  "org.members": "Medlemmar",
  "org.addMember": "Lägg till medlem",
  "org.addMemberBtn": "Lägg till medlem",
  "org.emailPlaceholder": "Medlemmens e-post",
  "org.groups": "Klasser och grupper",
  "org.noGroups": "Inga klasser eller grupper ännu.",
  "org.createGroup": "Skapa en klass",
  "org.createGroupBtn": "Skapa klass",
  "org.groupNamePlaceholder": "Klassnamn – t.ex. Årskurs 12 – Naturvetenskap",
  "org.kind.class": "Klass",
  "org.kind.group": "Grupp",
  "org.back": "Tillbaka till organisationer",
  "org.insights": "🌐 Tenant-insikter",
  "org.insightsMembers": "{s} studenter · {t} lärare",
  "org.insightsActive": "{n} aktiva denna vecka",
  "org.difficultSubjects": "Svåraste ämnena",
  "org.recommendations": "Rekommendationer",
  "profile.admin": "Administratörspanel",
  "admin.tileDetail": "Plattformens administration (endast administratörer).",
  "admin.title": "Admin-instrumentpanel",
  "admin.intro": "Plattformsöversikt för alla användare och organisationer.",
  "admin.stat.users": "Användare",
  "admin.stat.orgs": "Organisationer",
  "admin.stat.docs": "Dokument",
  "admin.stat.revenue": "Intäkter",
  "admin.stat.incidents": "Öppna incidenter",
  "admin.stat.reports": "Öppna rapporter",
  "admin.aiUsage": "AI-användning",
  "admin.aiQuestions": "AI-frågor",
  "admin.voiceMinutes": "Röstminuter",
  "admin.users": "Användare",
  "admin.suspend": "Avstäng",
  "admin.reactivate": "Aktivera igen",
  "admin.suspended": "avstängd",
  "admin.incidents": "Incidenter",
  "admin.incidentPlaceholder": "Incidenttitel",
  "admin.createIncident": "Skapa incident",
  "admin.resolve": "Lös",
  "admin.sev.low": "Låg",
  "admin.sev.medium": "Medel",
  "admin.sev.high": "Hög",
  "admin.sev.critical": "Kritisk",
  "admin.istatus.open": "Öppen",
  "admin.istatus.investigating": "Utrede",
  "admin.istatus.resolved": "Löst",
  "admin.reports": "Rapporter",
  "admin.noReports": "Inga rapporter.",
  "admin.review": "Markera som granskad",
  "admin.rstatus.open": "Öppen",
  "admin.rstatus.reviewed": "Granskad",
  "admin.rstatus.dismissed": "Avfärdad",
  "admin.logs": "Revisionslogg",
  "profile.analytics": "Analys",
  "an.tileDetail": "Plattformens affärsanalys (endast administratörer).",
  "an.title": "Analys",
  "an.intro": "Plattformsindikatorer för att driva ständig förbättring.",
  "an.active": "Aktiva användare",
  "an.stickiness": "Klistrighet",
  "an.retention": "7-dagarsretention",
  "an.newUsers": "Nya (7d)",
  "an.business": "Affärer",
  "an.revenue": "Intäkter",
  "an.conversion": "Konvertering",
  "an.paid": "Betalande användare",
  "an.learning": "Lärande & AI",
  "an.studyTime": "Studietid",
  "an.mastery": "Genomsnittlig behärskning",
  "an.lessons": "Lektioner",
  "an.aiQuestions": "AI-frågor",
  "an.voiceMinutes": "Röstminuter",
  "an.topFeatures": "Mest använda funktioner",
  "an.feature.tutor": "AI-lärare",
  "an.feature.lessons": "Lektioner",
  "an.feature.assessments": "Bedömningar",
  "an.feature.writing": "Skrivning",
  "an.feature.reading": "Läsning",
  "an.feature.documents": "Dokument",
  "an.feature.languages": "Språk",
  "profile.privacy": "Integritet och data",
  "priv.tileDetail": "Samtycken, dataexport och kontoborttagning.",
  "priv.title": "Integritet och data",
  "priv.intro": "Hantera dina samtycken, exportera din data eller radera ditt konto.",
  "priv.consents": "Samtycken",
  "priv.consent.analytics": "Produktanalys",
  "priv.consent.marketing": "Marknadsföringskommunikation",
  "priv.consent.product_emails": "E-post med produktuppdateringar",
  "priv.granted": "Godkänt",
  "priv.notGranted": "Inte godkänt",
  "priv.grant": "Godkänn",
  "priv.withdraw": "Återkalla",
  "priv.export": "Exportera din data",
  "priv.exportHelp": "Ladda ner all data vi har om dig som en JSON-fil.",
  "priv.exportBtn": "Exportera min data",
  "priv.exportDone": "Din dataexport har laddats ner.",
  "priv.exportReady": "Din dataexport är klar.",
  "priv.danger": "Farsozon",
  "priv.deleteHelp": "Radera ditt konto och all din data permanent. Detta kan inte ångras.",
  "priv.deleteBtn": "Radera mitt konto",
  "priv.passwordPlaceholder": "Bekräfta med ditt lösenord",
  "priv.cancel": "Avbryt",
  "priv.confirmDelete": "Radera för alltid",
  "h.hero.analyzed": "Jag har analyserat dina framsteg och förberett din dag.",
  "h.ctx.new": "Välkommen. Låt oss bygga din första inlärningsväg.",
  "h.ctx.active": "Jag har förberett dagens session.",
  "h.ctx.exam": "Din tentamen närmar sig – jag har anpassat ditt program.",
  "h.ctx.revision": "Några begrepp riskerar att glida bort idag.",
  "h.ctx.success": "Du har precis befäst ett viktigt begrepp.",
  "h.ctx.inactive": "Det har gått några dagar – låt oss mjukstarta igen.",
  "h.hero.start": "Starta min session",
  "h.hero.detail": "Visa detaljer",
  "h.hero.activities": "aktiviteter",
  "h.hero.min": "min",
  "h.hero.priorityHigh": "hög prioritet",
  "h.nba.title": "Din nästa åtgärd",
  "h.nba.priority": "PRIORITET",
  "h.nba.why": "Varför?",
  "h.nba.start": "Starta",
  "h.nba.review": "Repetera",
  "h.nba.learn": "Lär dig",
  "h.nba.r.at_risk": "Din behärskning sviktar – en kort repetition idag gör stor skillnad.",
  "h.nba.r.ready": "Förkunskaperna sitter – detta är nästa ideala steg.",
  "h.nba.r.in_progress": "Du läser redan detta – låt oss hålla ångan uppe.",
  "h.nba.r.review": "Kort att repetera idag.",
  "h.nba.none": "Inget brådskande – du är ajour. En kort repetition hjälper ändå.",
  "h.capture.title": "Vad vill du lära dig?",
  "h.capture.placeholder": "Förklara derivator… / ställ en fråga",
  "h.capture.write": "Skriv",
  "h.capture.speak": "Tala",
  "h.capture.drop": "Släpp",
  "h.capture.scan": "Skanna",
  "h.capture.import": "Importera",
  "h.proactive.badge": "ANPASSAD PLAN",
  "h.today.title": "Idag",
  "h.today.none": "Inget inplanerat idag.",
  "h.today.summary": "{min} min · {n} aktiviteter",
  "h.st.done": "klart",
  "h.st.in_progress": "pågår",
  "h.st.pending": "att göra",
  "h.st.skipped": "uppskjuten",
  "h.continue.title": "Fortsätt",
  "h.continue.reached": "Du hade nått:",
  "h.continue.btn": "Fortsätt",
  "h.progress.week": "Denna vecka",
  "h.progress.reviews": "Repetitioner",
  "h.progress.streak": "dagars svit",
  "h.mastery.title": "Bemästring",
  "h.mastery.none": "Inga koncept spåras ännu.",
  "h.exams.title": "Kommande tentor",
  "h.exams.prep": "Förberedelse",
  "h.exams.none": "Ingen kommande tenta.",
  "h.exams.hint": "Du kan lägga till en tenta när du vill.",
  "h.exams.plan": "Visa schema",
  "h.exams.inDays": "om {n} dagar",
  "h.exams.today": "idag",
  "h.exams.tomorrow": "imorgon",
  "h.recs.title": "Råd från din lärare",
  "h.recs.none": "Inga råd just nu.",
  "h.recs.act": "Starta",
  "h.capacity.title": "Dagens kapacitet",
  "h.capacity.recommended": "{n} minuter rekommenderas",
  "h.streak.title": "Kontinuitet",
  "h.streak.days": "dagar",
  "h.block.error": "Kunde inte läsa in detta block.",
  "h.block.retry": "Försök igen",
  "h.open": "Öppna",
  "error.title": "Något gick fel",
  "error.detail": "Ett problem uppstod på den här skärmen. Du kan försöka igen.",
  "learn.section.modes": "Hur vill du arbeta?",
  "study.section.cards": "Smarta kort",
  "onboarding.preparing": "Förbereder ditt utrymme…",
  "onboarding.gen.title": "Skapar din digitala hjärna…",
  "onboarding.gen.analyzing": "Analyserar din profil…",
  "onboarding.gen.graph": "Bygger din kunskapskarta…",
  "onboarding.gen.teacher": "Anpassar din AI-professor…",
  "onboarding.gen.forming": "Din digitala hjärna tar form…",
  "profile.manageSubscription": "Hantera min prenumeration",
  "onb.progress": "Ditt utrymme tar form…",
  "onb.why": "Varför frågar jag detta?",
  "onb.continue": "Fortsätt",
  "onb.back": "Tillbaka",
  "onb.skip": "Hoppa över",
  "onb.cat.kindergarten": "Förskola",
  "onb.cat.primary": "Grundskola",
  "onb.cat.secondary": "Högstadieskola",
  "onb.cat.highschool": "Gymnasium",
  "onb.cat.university": "Universitet",
  "onb.cat.research": "Forskning / Doktorand",
  "onb.cat.professional": "Yrkesutbildning",
  "onb.cat.language": "Lära sig ett språk",
  "onb.cat.personal": "Personligt lärande",
  "onb.age.under12": "Under 12 år",
  "onb.age.12to15": "12–15",
  "onb.age.16to18": "16–18",
  "onb.age.18to25": "18–25",
  "onb.age.25to40": "25–40",
  "onb.age.over40": "40 och över",
  "onb.goal.understand": "Förstå mina kurser",
  "onb.goal.exams": "Klara mina prov",
  "onb.goal.grades": "Förbättra mina betyg",
  "onb.goal.language": "Lära sig ett språk",
  "onb.goal.contest": "Förbereda för ett urvalsprov",
  "onb.goal.homework": "Göra mina läxor",
  "onb.goal.labs": "Slutföra mitt laborationsarbete",
  "onb.goal.reports": "Skriva mina rapporter",
  "onb.goal.projects": "Arbeta med mina projekt",
  "onb.goal.research": "Bedriva forskning",
  "onb.goal.skills": "Bygga upp mina färdigheter",
  "onb.goal.curiosity": "Lära av nyfikenhet",
  "onb.subj.math": "Matematik",
  "onb.subj.physics": "Fysik",
  "onb.subj.chemistry": "Kemi",
  "onb.subj.biology": "Biologi",
  "onb.subj.cs": "Datavetenskap",
  "onb.subj.law": "Juridik",
  "onb.subj.economics": "Ekonomi",
  "onb.subj.history": "Historia",
  "onb.subj.geography": "Geografi",
  "onb.subj.languages": "Språk",
  "onb.subj.medicine": "Medicin",
  "onb.subj.philosophy": "Filosofi",
  "onb.pref.visual": "Visuella förklaringar",
  "onb.pref.examples": "Exempel",
  "onb.pref.practice": "Praktik",
  "onb.pref.exercises": "Övningar",
  "onb.pref.conversation": "Konversation",
  "onb.pref.reading": "Läsning",
  "onb.pref.listening": "Lyssnande",
  "onb.pref.repetition": "Repetition",
  "onb.pref.problems": "Problemlösning",
  "onb.tone.supportive": "Stödjande",
  "onb.tone.balanced": "Balanserad",
  "onb.tone.demanding": "Krävande",
  "onb.expl.short": "Kort",
  "onb.expl.balanced": "Balanserad",
  "onb.expl.detailed": "Detaljerad",
  "onb.interv.let_me_think": "Låt mig tänka",
  "onb.interv.guide_me": "Vägled mig steg för steg",
  "onb.interv.interactive": "Var mycket interaktiv",
  "onb.corr.immediate": "Rätta direkt",
  "onb.corr.let_me_finish": "Låt mig avsluta",
  "onb.corr.adaptive": "Anpassa efter situationen",
  "onb.sup.guide": "Vägled mig",
  "onb.sup.understand": "Hjälp mig att förstå",
  "onb.sup.step_by_step": "Hjälp mig steg för steg",
  "onb.sup.verify": "Kontrollera mitt resonemang",
  "onb.sup.solution": "Visa mig en förklarad lösning",
  "onb.skill.comprehension": "Förståelse",
  "onb.skill.speaking": "Muntlig framställning",
  "onb.skill.pronunciation": "Uttal",
  "onb.skill.writing": "Skriftlig framställning",
  "onb.skill.grammar": "Grammatik",
  "onb.skill.vocabulary": "Ordförråd",
  "onb.rate.high": "Det här kan jag",
  "onb.rate.medium": "Medel",
  "onb.rate.low": "Behöver övas",
  "onb.welcome.title": "Välkommen till Second Brain.",
  "onb.welcome.start": "Starta",
  "onb.welcome.body": "Låt oss bygga din lärandemiljö utifrån hur du lär dig.",
  "onb.welcome.teacher": "Jag lära känna dig för att anpassa din AI-professor efter din nivå, dina mål och ditt sätt att lära.",
  "onb.identity.teacher": "Låt oss lära känna varandra – bara det viktigaste, inget mer.",
  "onb.identity.title": "Vem är du?",
  "onb.identity.firstName": "Förnamn",
  "onb.identity.firstNamePh": "Ditt förnamn",
  "onb.identity.lastName": "Efternamn (valfritt)",
  "onb.identity.lastNamePh": "Ditt efternamn",
  "onb.identity.avatar": "Avatar (valfritt)",
  "onb.identity.age": "Åldersintervall",
  "onb.identity.ageWhy": "Åldersintervallet används endast för att anpassa ton och presentation. Ingen födelsedag efterfrågas och upplevelsen för yngre inlärare förblir skyddad.",
  "onb.identity.country": "Land / region (valfritt)",
  "onb.identity.countryPh": "t.ex. Frankrike",
  "onb.category.teacher": "Detta hjälper mig att förstå var du befinner dig i din resa.",
  "onb.category.title": "Var befinner du dig?",
  "onb.category.subtitle": "Välj det som passar dig bäst.",
  "onb.academic.teacher": "Beskriv dina studier – välj, sök eller skriv fritt.",
  "onb.academic.title": "Dina studier",
  "onb.academic.subtitle": "Inget är obligatoriskt: fyll i det som gäller för dig.",
  "onb.academic.level": "Nivå",
  "onb.academic.levelPh": "t.ex. Universitet",
  "onb.academic.system": "Land / utbildningssystem",
  "onb.academic.systemPh": "t.ex. Frankrike — LMD",
  "onb.academic.field": "Område",
  "onb.academic.fieldPh": "t.ex. Datavetenskap",
  "onb.academic.domain": "Domän",
  "onb.academic.domainPh": "t.ex. Programvaruteknik",
  "onb.academic.specialty": "Specialitet (valfritt)",
  "onb.academic.specialtyPh": "t.ex. Distribuerade system",
  "onb.academic.year": "År / nivå",
  "onb.academic.yearPh": "t.ex. 3:e året",
  "onb.goals.teacher": "Berätta varför du är här – du kan välja flera.",
  "onb.goals.title": "Varför använder du Second Brain?",
  "onb.subjects.teacher": "Dessa ämnen kommer att fylla på ditt minne, din kunskapsgraf och ditt schema.",
  "onb.subjects.title": "Dina ämnen",
  "onb.subjects.add": "Lägg till ett ämne",
  "onb.subjects.addPh": "t.ex. Astrofysik",
  "onb.subjects.addBtn": "Lägg till",
  "onb.languages.teacher": "Språket formar mina förklaringar och det stöd jag kan ge dig.",
  "onb.languages.title": "Dina språk",
  "onb.languages.native": "Modersmål",
  "onb.languages.interface": "Gränssnittsspråk",
  "onb.languages.interfaceWhy": "Gränssnittsspråket ändrar visningen och det språk som AI-professorn undervisar dig på.",
  "onb.languages.study": "Stud språk (valfritt)",
  "onb.languages.studyWhy": "Om du studerar på ett annat språk än ditt modersmål aktiverar jag tvåspråkigt stöd och akademisk vokabulär.",
  "onb.mobility.title": "Internationell rörlighet",
  "onb.mobility.subtitle": "Studerar du för närvarande på ett annat språk än ditt modersmål?",
  "onb.mobility.yes": "Ja",
  "onb.mobility.no": "Nej",
  "onb.mobility.alertTitle": "Språkstöd aktiverat",
  "onb.mobility.alertDetail": "Kontextuell översättning, akademisk vokabulär, tvåspråkig förklaring och gradvis nedsänkning.",
  "onb.ll.teacher": "Låt oss bygga din språkresa, skräddarsydd för dig.",
  "onb.ll.title": "Lär dig ett språk",
  "onb.ll.target": "Jag vill lära mig",
  "onb.ll.currentLevel": "Nuvarande nivå",
  "onb.ll.goalLevel": "Mål",
  "onb.ll.mainGoal": "Huvudmål",
  "onb.ll.mainGoalPh": "t.ex. Konversation",
  "onb.ll.skills": "Vad du vill arbeta med",
  "onb.prefs.teacher": "Preferenser, inte en diagnos. Du kan ändra dem när som helst.",
  "onb.prefs.title": "Hur föredrar du att lära dig?",
  "onb.teacher.teacher": "Ställ in mig. Jag anpassar mig sedan utifrån dina resultat.",
  "onb.teacher.title": "Din AI-professor",
  "onb.teacher.tone": "Ton",
  "onb.teacher.explanations": "Förklaringar",
  "onb.teacher.intervention": "Intervention",
  "onb.teacher.correction": "Rättelse",
  "onb.support.teacher": "Laborationer, läxor, rapporter, projekt, avhandlingar – hur vill du att jag ska hjälpa till?",
  "onb.support.title": "Akademisk hjälp",
  "onb.assess.teacher": "Låt oss snabbt se vad du redan kan – några frågor, inte ett prov.",
  "onb.assess.title": "Snabb avstämning",
  "onb.assess.save": "Spara",
  "onb.assess.noSubjectTitle": "Inget ämne valt",
  "onb.assess.noSubjectDetail": "Lägg till ett ämne i föregående steg för att göra en avstämning, eller hoppa över detta steg.",
  "onb.assess.whichSubject": "I vilket ämne?",
  "onb.assess.preparing": "Förbereder...",
  "onb.assess.run": "Starta avstämningen",
  "onb.assess.unavailableTitle": "Avstämning ej tillgänglig",
  "onb.assess.unavailableDetail": "Du kan självbedöma din nivå nedan.",
  "onb.assess.selfRate": "Självbedöm din nivå i",
  "onb.assess.answerPh": "Ditt svar (valfritt)",
  "onb.twin.title": "Här är vad jag har förstått om dig",
  "onb.twin.subtitle": "Du kan direkt korrigera det som Second Brain har förstått.",
  "onb.twin.confirm": "Det stämmer",
  "onb.twin.profile": "Profil",
  "onb.twin.langs": "Språk",
  "onb.twin.goals": "Mål",
  "onb.twin.subjects": "Ämnen",
  "onb.twin.prof": "Professor",
  "onb.twin.target": "Mål",
  "onb.twin.native": "modersmål",
  "onb.twin.study": "studera",
  "onb.twin.hi": "Hej",
  "onb.twin.almost": "vi är snart klara.",
  "onb.twin.toAdapt": "För att anpassa",
  "onb.adapt.title": "Så här kommer din AI-professor att fungera",
  "onb.adapt.enter": "Gå in i Second Brain",
  "onb.adapt.preparing": "Förbereder...",
  "onb.adapt.willBody": "Jag kommer att:",
  "onb.adapt.p1": "anpassa mina förklaringar till din nivå",
  "onb.adapt.p2": "upptäcka dina svårigheter",
  "onb.adapt.p3": "få dig att öva",
  "onb.adapt.p4": "planera dina repetitioner",
  "onb.adapt.p5": "använda dina dokument",
  "onb.adapt.p6": "hjälpa dig med dina uppgifter",
  "onb.edit": "Redigera",
  "error.serverBusy": "Tjänsten är upptagen just nu. Försök igen om en liten stund.",
  "error.network": "Anslutningsproblem. Kontrollera nätverket och försök igen.",
  "onb.cfg.title": "Konfiguration tillämpad",
  "onb.cfg.profileUpdated": "Profilen har uppdaterats",
  "onb.cfg.langCreated": "Språkprofil skapad",
  "onb.cfg.concepts": "inledande begrepp",
  "auth.brandTitle": "Din AI-förstärkta hjärna",
  "auth.brandSubtitle": "Lär dig. Förstå. Kom ihåg. Din AI-professor växer med dig.",
  "auth.badgeLangs": "34 språk",
  "auth.badgeModels": "Multimodell-AI",
  "auth.badgeGraph": "Kunskapsgraf",
  "auth.sceneQuestion": "Förklara det här begreppet enkelt för mig.",
  "auth.sceneAnswer": "Självklart — här är det, steg för steg, på din nivå.",
  "auth.sceneConcept": "Begrepp",
  "auth.sceneRelation": "Relation",
  "auth.sceneMastery": "Behärskning",
  "auth.welcomeBack": "Välkommen tillbaka",
  "auth.signUpSubtitle": "Det tar bara några sekunder att bygga din inlärningsmiljö.",
  "auth.signInSubtitle": "Fortsätt precis där du slutade.",
  "auth.showPassword": "Visa lösenord",
  "auth.hidePassword": "Dölj lösenord",
  "auth.themeToggle": "Byt tema",
  "auth.strengthLabel": "Lösenordsstyrka",
  "auth.strengthWeak": "Svagt",
  "auth.strengthMedium": "Medel",
  "auth.strengthStrong": "Starkt",
  "auth.emailFieldHint": "t.ex. du@example.com",
  "auth.retry": "Försök igen",
  "nav.expand": "Expandera meny",
  "nav.collapse": "Minimera meny",
  "profile.kyc.title": "Min profil",
  "profile.kyc.complete": "Slutförd",
  "profile.kyc.incomplete": "Att slutföra",
  "profile.kyc.detail": "Informationen som skräddarsyr din AI-professor och digitala tvilling.",
  "profile.kyc.verify": "Granska min profil",
  "profile.kyc.name": "Namn",
  "profile.kyc.path": "Väg",
  "profile.kyc.languagesRow": "Språk",
  "profile.kyc.goalsRow": "Mål",
  "profile.kyc.goalsN": "mål",
  "profile.footer": "Dina ändringar uppdaterar omedelbart din AI-professor och digitala tvilling i hela appen.",
  "lib.learnWithTeacher": "Lär dig med läraren",
  "sub.popular": "Populärast",
  "sub.perMonth": "/mån",
  "sub.free": "Gratis",
  "landing.brand": "Second Brain",
  "landing.signature": "Aktivera din digitala tvilling",
  "landing.nav.features": "Funktioner",
  "landing.nav.how": "Så här fungerar det",
  "landing.nav.professor": "AI-professor",
  "landing.nav.academic": "Akademisk arbetsyta",
  "landing.nav.languages": "Språk",
  "landing.nav.faq": "FAQ",
  "landing.cta.signin": "Logga in",
  "landing.cta.start": "Börja gratis",
  "landing.cta.startShort": "Starta",
  "landing.cta.discover": "Se hur det fungerar",
  "landing.hero.title": "Din digitala tvilling för lärande",
  "landing.hero.subtitle": "En AI-professor som förstår din resa, minns det du lärt dig och undervisar dig – helt skräddarsytt.",
  "landing.hero.promise1": "Lär dig",
  "landing.hero.promise2": "Förstå",
  "landing.hero.promise3": "Memorera",
  "landing.hero.promise4": "Framsteg",
  "landing.hero.reassure1": "Adaptiv AI-professor",
  "landing.hero.reassure2": "Bestående minne",
  "landing.hero.reassure3": "34 språk",
  "landing.hero.reassure4": "Smarta dokument",
  "landing.mock.os": "SECOND BRAIN OS",
  "landing.mock.brain": "Mitt hjärta",
  "landing.mock.professor": "AI-professor",
  "landing.mock.msg": "\"Förklara det här konceptet för mig…\"",
  "landing.mock.memory": "Minne",
  "landing.mock.progress": "Framsteg",
  "landing.mock.mastery": "Bemästring",
  "landing.signals.multipdf": "Multi-PDF",
  "landing.signals.fsrs": "FSRS",
  "landing.flow.documents": "Dokument",
  "landing.flow.intelligence": "Intelligens",
  "landing.flow.graph": "Kunskapsgraf",
  "landing.flow.professor": "AI-professor",
  "landing.flow.twin": "Digital tvilling",
  "landing.flow.revision": "Granskning och framsteg",
  "landing.compare.title": "Vad som förändras",
  "landing.compare.message": "Second Brain behåller inte bara din kunskap. Den läror sig hur du läror dig.",
  "landing.compare.classicTitle": "En klassisk app",
  "landing.compare.sbTitle": "Second Brain OS",
  "landing.compare.classic1": "Isolerade dokument",
  "landing.compare.classic2": "Statiska anteckningar",
  "landing.compare.classic3": "Grundläggande sökning",
  "landing.compare.classic4": "Sammanfattningar",
  "landing.compare.classic5": "Spridd historik",
  "landing.compare.sb1": "Personligt minne",
  "landing.compare.sb2": "AI-professor",
  "landing.compare.sb3": "Kunskapsgraf",
  "landing.compare.sb4": "Adaptivt lärande",
  "landing.compare.sb5": "Smart granskning",
  "landing.compare.sb6": "Kontinuerliga framsteg",
  "landing.compare.classicFlow": "Lagra → Sök → Läs",
  "landing.compare.sbFlow": "Fånga → Förstå → Lär ut → Memorera → Framsteg",
  "landing.how.title": "Hur det fungerar",
  "landing.how.s1.title": "Fånga",
  "landing.how.s1.desc": "PDF:er, foton, skanningar, anteckningar och allt lärandeinnehåll.",
  "landing.how.s2.title": "Förstå",
  "landing.how.s2.desc": "Systemet strukturerar informationen och identifierar begreppen.",
  "landing.how.s3.title": "Lär ut",
  "landing.how.s3.desc": "AI-professorn förvandlar kunskap till en lärandeupplevelse.",
  "landing.how.s4.title": "Memorera",
  "landing.how.s4.desc": "Din digitala tvilling och granskningssystemet spårar vad du tillgodogör dig.",
  "landing.how.s5.title": "Framsteg",
  "landing.how.s5.desc": "FSRS, bedömningar och rekommendationer befäster din kunskap.",
  "landing.exp.title": "En del innehåll → en lärandeupplevelse",
  "landing.exp.lead": "Ingenting importeras någonsin bara och glöms bort. Varje dokument blir något du kan lära dig, öva på och minnas.",
  "landing.exp.s1": "PDF",
  "landing.exp.s2": "Analysera",
  "landing.exp.s3": "Förstå",
  "landing.exp.s4": "Lär dig med professorn",
  "landing.exp.s5": "Frågor",
  "landing.exp.s6": "Övningar",
  "landing.exp.s7": "Granska",
  "landing.exp.s8": "Minne",
  "landing.exp.actionLearn": "Lär dig med Professorn",
  "landing.exp.actionSolve": "Lös det med mig",
  "landing.showcase.title": "En produkt, en upplevelse",
  "landing.showcase.brain.tab": "🧠 Min hjärna",
  "landing.showcase.brain.title": "Min hjärna",
  "landing.showcase.brain.desc": "Din visuella digitala tvilling: Kunskapsgraf, inlärnings-DNA, styrkor och svagheter på en enda levande karta.",
  "landing.showcase.professor.tab": "👨‍🏫 AI-professor",
  "landing.showcase.professor.title": "AI-professor",
  "landing.showcase.professor.desc": "Skriftlig konversation, undervisning och pedagogik som anpassar sig till din exakta nivå och dina mål.",
  "landing.showcase.search.tab": "🔎 Fri sökning",
  "landing.showcase.search.title": "Fri AI-sökning",
  "landing.showcase.search.desc": "Fråga vad som helst – en spontan, teknisk, akademisk eller allmänbildande fråga – direkt i lärandeupplevelsen.",
  "landing.showcase.documents.tab": "📚 Massiva dokument",
  "landing.showcase.documents.title": "Massiva dokument",
  "landing.showcase.documents.desc": "PDF-filer, foton, skanningar och hela ämnen grupperade tillsammans – arbeta med en hel kurs, inte bara en enskild fil.",
  "landing.showcase.voice.tab": "🎙️ Röst & tal",
  "landing.showcase.voice.title": "Röst & tal",
  "landing.showcase.voice.desc": "Muntlig konversation, muntliga övningar och muntliga tentor för att öva högt.",
  "landing.showcase.academic.tab": "🎓 Akademisk arbetsyta",
  "landing.showcase.academic.title": "Akademisk arbetsyta",
  "landing.showcase.academic.desc": "Laborationer, läxor, rapporter, projekt, uppsatser, essäer och examensämnen – vägledda, steg för steg.",
  "landing.showcase.revise.tab": "📅 Repetera",
  "landing.showcase.revise.title": "Repetera",
  "landing.showcase.revise.desc": "FSRS, flashcards, quiz och progression som befäster det du litar dig.",
  "landing.professor.title": "En professor som lär känna den du är",
  "landing.professor.lead": "Inte en generisk chattbot – en lärare som anpassar sig efter din nivå, dina mål och ditt sätt att lära.",
  "landing.professor.a1": "Nivå",
  "landing.professor.a2": "Mål",
  "landing.professor.a3": "Svårigheter",
  "landing.professor.a4": "Inlärningshistorik",
  "landing.professor.a5": "Språk",
  "landing.professor.a6": "Kursplan",
  "landing.professor.a7": "Takt",
  "landing.professor.a8": "Framsteg",
  "landing.professor.modesTitle": "Undervisningslägen",
  "landing.professor.m1": "Undervisa",
  "landing.professor.m2": "Förklara",
  "landing.professor.m3": "Diskutera",
  "landing.professor.m4": "Ledd session",
  "landing.professor.m5": "Muntlig övning",
  "landing.professor.m6": "Muntlig tenta",
  "landing.professor.flow": "Förstå → öva → examineras → korrigera → memorera",
  "landing.academic.title": "Akademisk arbetsyta",
  "landing.academic.badge": "En funktion i Lär-miljön",
  "landing.academic.lead": "Målet är inte bara att ge dig svaret – det är att lära dig metoden.",
  "landing.academic.w1": "Laboration",
  "landing.academic.w2": "Läxa",
  "landing.academic.w3": "Rapport",
  "landing.academic.w4": "Projekt",
  "landing.academic.w5": "Examensarbete",
  "landing.academic.w6": "Essä",
  "landing.academic.w7": "Fallstudie",
  "landing.academic.w8": "Övning",
  "landing.academic.w9": "Examensämne",
  "landing.academic.mode1.title": "Pedagogisk vägledning",
  "landing.academic.mode1.desc": "AI:n vägleder dig steg för steg.",
  "landing.academic.mode2.title": "Assisterad lösning",
  "landing.academic.mode2.desc": "Ni arbetar igenom det tillsammans med AI:n.",
  "landing.academic.mode3.title": "Fullständigt förklarad lösning",
  "landing.academic.mode3.desc": "Lösningen förklaras pedagogiskt, inte bara lämnas ut.",
  "landing.languages.title": "Språk och immersion",
  "landing.languages.lead": "Lär dig ett språk och förstå språket i din egen läroplan.",
  "landing.languages.l1": "Språkbad",
  "landing.languages.l2": "Konversation",
  "landing.languages.l3": "Muntlig",
  "landing.languages.l4": "Skuggning",
  "landing.languages.l5": "Progression",
  "landing.languages.l6": "Ordförråd",
  "landing.languages.l7": "Grammatik",
  "landing.languages.mobilityTitle": "Akademisk rörlighet",
  "landing.languages.mob1": "Fransktalande student",
  "landing.languages.mob2": "Engelskspråkigt universitet",
  "landing.languages.mob3": "Kontextuell översättning",
  "landing.languages.mob4": "Akademiskt ordförråd",
  "landing.languages.mob5": "Progressiv immersion",
  "landing.kyc.title": "Systemet anpassar sig efter eleven",
  "landing.kyc.lead": "Inte ett administrativt formulär – en anpassningsmotor. Den finjusterar nivå, ordförråd, ton, pedagogik och svårighetsgrad efter dig.",
  "landing.kyc.p1.title": "Primär",
  "landing.kyc.p1.desc": "Ett visuellt, åldersanpassat undervisningssätt.",
  "landing.kyc.p2.title": "Gymnasium / Universitet",
  "landing.kyc.p2.desc": "En strukturerad metod, examinationer och befästande.",
  "landing.kyc.p3.title": "Specialiserat område",
  "landing.kyc.p3.desc": "Medicin, juridik, datavetenskap, teknik, arkitektur...",
  "landing.kyc.p4.title": "Forskare",
  "landing.kyc.p4.desc": "Vetenskaplig stringens och djupare utforskning.",
  "landing.kyc.p5.title": "Språkinlärare",
  "landing.kyc.p5.desc": "Immersion och språklig progression.",
  "landing.twin.title": "Ditt lärande blir ett levande minne",
  "landing.twin.lead": "Ju mer du läser med Second Brain, desto mer personligt blir ditt system.",
  "landing.twin.i1": "Det du läser",
  "landing.twin.i2": "Det du förstår",
  "landing.twin.i3": "Det du glömmer",
  "landing.twin.i4": "Det du behärskar",
  "landing.twin.i5": "Dina mål",
  "landing.twin.result": "Digital tvilling",
  "landing.graph.title": "Kunskapsgraf",
  "landing.graph.lead": "Den levande kartan över samborden mellan allt du lär dig.",
  "landing.revision.title": "Smart repetition",
  "landing.revision.message": "Repetera inte mer. Repetera i rätt ögonblick.",
  "landing.revision.lead": "FSRS är ett behållningslager för hela ditt system – inte bara en hög med flashcards.",
  "landing.revision.c1": "FSRS",
  "landing.revision.c2": "Intervallrepetition",
  "landing.revision.c3": "Instuderingskort",
  "landing.revision.c4": "Frågesporter",
  "landing.revision.c5": "Bedömningar",
  "landing.revision.c6": "Progression",
  "landing.one.title": "En enda sammanhållen upplevelse",
  "landing.one.s1": "Fånga",
  "landing.one.s2": "Förstå",
  "landing.one.s3": "Lära ut",
  "landing.one.s4": "Öva",
  "landing.one.s5": "Memorera",
  "landing.one.s6": "Repetera",
  "landing.one.s7": "Utvecklas",
  "landing.faq.title": "Vanliga frågor",
  "landing.faq.q1": "Är Second Brain bara en chattbot?",
  "landing.faq.a1": "Nej. Det är en personlig lärandemiljö: den förstår ditt innehåll, lär ut det och kommer ihåg dina framsteg över tid.",
  "landing.faq.q2": "Kan jag arbeta med flera PDF-filer och dokument?",
  "landing.faq.a2": "Ja. Du kan gruppera PDF-filer, foton, skanningar och anteckningar till ett helt ämne och lära dig från hela uppsättningen, inte bara en enskild fil.",
  "landing.faq.q3": "Vad kan jag göra med AI-professorn?",
  "landing.faq.a3": "Få undervisning, be om förklaringar, diskutera, kör ledda sessioner och öva med övningar – anpassade efter din nivå.",
  "landing.faq.q4": "Kan jag prata högt med AI-professorn?",
  "landing.faq.a4": "Ja. Röstkonversationer, muntliga övningar och muntliga tentor låter dig öva högt.",
  "landing.faq.q5": "Vad är Digital Twin?",
  "landing.faq.a5": "Ett personligt minne av ditt lärande – vad du förstår, behärskar, glömmer och siktar mot.",
  "landing.faq.q6": "Hur fungerar minne och repetition?",
  "landing.faq.a6": "En repetitionsmotor med mellanrum (FSRS) schemalägger repetitioner i rätt ögonblick så att du behåller mer med mindre ansträngning.",
  "landing.faq.q7": "Kan jag använda Second Brain för mitt akademiska arbete?",
  "landing.faq.a7": "Ja. The Academic Workspace guidar laborationer, läxor, rapporter med mera – och läser ut metoden, inte bara svaret.",
  "landing.faq.q8": "Hur fungerar språkinlärning?",
  "landing.faq.a8": "Fördjupning, konversation, muntlig träning och shadowing – samt hjälp med att förstå språket i din egen läroplan.",
  "landing.faq.q9": "Hur skyddas mina uppgifter?",
  "landing.faq.a9": "Dina inlärningsdata driver din upplevelse. Du styr ditt konto och kan hantera dina data från din profil.",
  "landing.pricing.title": "Välj din inlärningsnivå",
  "landing.pricing.subtitle": "Utforska → Lär dig på riktigt → Gå all in",
  "landing.pricing.billing.monthly": "Månadsvis",
  "landing.pricing.billing.annual": "Årsvis",
  "landing.pricing.billing.saving": "Spara",
  "landing.pricing.free.name": "Gratis",
  "landing.pricing.free.description": "För att utforska ekosystemet Second Brain.",
  "landing.pricing.free.cta": "Börja gratis",
  "landing.pricing.pro.name": "Pro",
  "landing.pricing.pro.description": "För seriöst vardagslärande.",
  "landing.pricing.pro.badge": "Rekommenderas",
  "landing.pricing.pro.cta": "Satsa på Pro",
  "landing.pricing.max.name": "Max",
  "landing.pricing.max.description": "För forskare, intensiva studenter och yrkesverksamma.",
  "landing.pricing.max.cta": "Lås upp Max",
  "landing.final.title": "Ditt lärande förtjänar mer än ett bibliotek",
  "landing.final.subtitle": "Aktivera din Digital Twin.",
  "landing.footer.tagline": "Din personliga AI-förstärkta inlärningsmiljö.",
  "landing.footer.product": "Produkt",
  "landing.footer.product1": "Funktioner",
  "landing.footer.product2": "AI-professor",
  "landing.footer.product3": "Bibliotek",
  "landing.footer.product4": "Min hjärna",
  "landing.footer.product5": "Repetition",
  "landing.footer.learn": "Lär dig",
  "landing.footer.learn1": "Språk",
  "landing.footer.learn2": "Akademisk arbetsyta",
  "landing.footer.learn3": "Konversation",
  "landing.footer.learn4": "Dokument",
  "landing.footer.resources": "Resurser",
  "landing.footer.resources1": "FAQ",
  "landing.footer.resources2": "Hjälp",
  "landing.footer.resources3": "Dokumentation",
  "landing.footer.company": "Företag",
  "landing.footer.company1": "Om",
  "landing.footer.company2": "Kontakt",
  "landing.footer.legal": "Juridiskt",
  "landing.footer.legal1": "Integritet",
  "landing.footer.legal2": "Villkor",
  "landing.footer.legal3": "Säkerhet",
  "landing.footer.copy": "© 2026 Second Brain – Din personliga AI-inlärningsmiljö."
  ,"languageSelector.recent": "Senaste"
  ,"languageSelector.nativeLabel": "Modersmål"
  ,"voice11.state.ready": "Redo"
  ,"voice11.state.listening": "Lyssnar"
  ,"voice11.state.transcription": "Transkriberar"
  ,"voice11.state.thinking": "Professorn tänker"
  ,"voice11.state.response": "Svaret är klart"
  ,"voice11.state.paused": "Inspelningen är pausad"
  ,"voice11.state.error": "Röstfel"
  ,"voice11.transcribe": "Stoppa och transkribera"
  ,"voice11.pause": "Pausa"
  ,"voice11.resume": "Fortsätt"
  ,"voice11.transcript.edit": "Transkriberingen är klar – granska eller redigera den innan du skickar."
  ,"state.processing": "Bearbetar…"
  ,"state.partial": "Vissa resultat är fortfarande inte tillgängliga"
  ,"state.success": "Slutfört"
  ,"state.stale": "Visar tidigare inlästa data"
  ,"state.offline": "Du är offline"
  ,"state.quota-limited": "Användningsgränsen har nåtts"
  ,"learning.notTracked": "Spåras inte"
  ,"profile.kyc.goalsImpact": "Dessa mål vägleder Repetera, AI-professorn och din digitala tvilling."
  ,"profile.kyc.languagesEmpty": "Inga ännu."
  ,"learn.component.dropTitle": "Släpp dokumentet här"
  ,"learn.component.dropDetail": "PDF, foto, skanning, bok, anteckningsbok…"
  ,"learn.component.documentQuestion": "Vad är det här för dokument?"
  ,"learn.component.yourTurn": "Din tur."
  ,"ai.professor": "AI-professor"
  ,"ai.recommendation": "AI-rekommendation"
  ,"ai.insight": "AI-insikt"
  ,"ai.explanation": "Förklaring"
  ,"ai.warning": "Svårighet upptäckt"
  ,"ai.progress": "Framsteg"
  ,"ai.posture.supportive": "Stöttande"
  ,"ai.posture.challenging": "Utmanande"
  ,"ai.posture.examiner": "Examinator"
  ,"review.due": "förfaller"
  ,"profile.card.photo": "Profilbild"
  ,"profile.card.editPhoto": "Redigera profilbild"
  ,"profile.card.takePhoto": "Ta ett foto"
  ,"profile.card.gallery": "Välj från galleriet"
  ,"profile.card.avatar": "Eller välj en avatar"
  ,"profile.card.removePhoto": "Ta bort foto"
  ,"profile.card.identity": "Identitet och studieväg"
  ,"profile.card.name": "Namn"
  ,"profile.card.namePh": "Ditt namn"
  ,"profile.card.category": "Elevkategori"
  ,"profile.card.curriculum": "Kurs/område"
  ,"profile.card.level": "Nivå"
  ,"profile.card.institution": "Lärosäte"
  ,"profile.card.nativeLanguage": "Modersmål"
  ,"profile.card.studyLanguage": "Studiespråk"
  ,"profile.card.mobility": "Internationell mobilitet"
  ,"profile.card.mobilityOn": "Du studerar på ett annat språk än ditt modersmål: automatiskt språkstöd och kontextanpassat språkbad är aktiverade."
  ,"profile.card.mobilityOff": "Aktivera detta om du studerar på ett annat språk än ditt modersmål."
  ,"profile.card.languageSupport": "🌍 Språkstöd aktiverat"
  ,"profile.card.aiTeacher": "AI-professor"
  ,"profile.card.posture": "Förhållningssätt"
  ,"profile.card.toneSupportive": "🟢 Stöttande"
  ,"profile.card.toneBalanced": "🟡 Utmanande"
  ,"profile.card.toneDemanding": "🔴 Sträng/examinator"
  ,"profile.card.explanations": "Förklaringar"
  ,"profile.card.explShort": "Korta"
  ,"profile.card.explBalanced": "Balanserade"
  ,"profile.card.explDetailed": "Detaljerade"
  ,"profile.card.cognitive": "Kognitiv profil (digital tvilling)"
  ,"profile.card.strengths": "Dina styrkor"
  ,"profile.card.strengthsEmpty": "De visas efter hand som du lär dig."
  ,"profile.card.targetRetention": "Mål för minnesbevarande"
  ,"profile.card.target90": "Mål: 90 %"
  ,"profile.card.retentionCurrent": "aktuellt · mål: 90 %"
  ,"profile.card.dailyPace": "Dagligt tempo"
  ,"profile.card.minDay": "min/dag"
  ,"profile.card.systemData": "System och data"
  ,"profile.card.theme": "Tema"
  ,"profile.card.light": "☀︎ Ljust"
  ,"profile.card.dark": "☾ Mörkt"
  ,"profile.card.system": "⚙︎ System"
  ,"profile.card.statistics": "Statistik"
  ,"profile.card.concepts": "begrepp"
  ,"profile.card.reviews": "repetitioner"
  ,"profile.card.privacyMemory": "Integritet och minne"
  ,"profile.card.privacyData": "🔒 Integritet och data"
  ,"profile.card.vectorMemory": "🧠 Hantera vektorminne"
  ,"profile.card.cat.child": "Barn"
  ,"profile.card.cat.student": "Student"
  ,"profile.card.cat.researcher": "Forskare"
  ,"profile.card.cat.adult": "Vuxen"
  ,"profile.card.cat.language": "Språkinlärare"
  ,"brain.panel.overview": "Översikt"
  ,"brain.panel.mastered": "bemästrade"
  ,"brain.panel.fragile": "bräckliga"
  ,"brain.panel.average": "genomsnittlig behärskning"
  ,"brain.panel.cognitive": "Kognitiv profil"
  ,"brain.panel.cognitiveEmpty": "Det finns ännu inte tillräckligt med data för att kartlägga din profil."
  ,"brain.panel.indicators": "Interna indikatorer på behärskning, inte skolbetyg."
  ,"brain.panel.maturity": "mognad"
  ,"brain.panel.dnaEmpty": "Ditt inlärnings-DNA tar form när du slutför sessioner."
  ,"brain.panel.dnaNote": "Observationer under utveckling, inte en diagnos."
  ,"brain.panel.studied": "studerade"
  ,"brain.panel.toReview": "att repetera"
  ,"brain.panel.memoryNote": "Second Brain följer automatiskt hur din kunskap förändras."
  ,"brain.panel.attention": "Det här behöver din uppmärksamhet"
  ,"brain.panel.reviewNow": "Repetera nu"
  ,"brain8.intro": "En levande bild av vad du kan, hur du lär dig, vad som håller på att bli bräckligt och vad du bör göra härnäst."
  ,"brain8.nav.overview": "Översikt"
  ,"brain8.nav.knowledge": "Kunskap"
  ,"brain8.nav.learning": "Hur jag lär mig"
  ,"brain8.nav.memory": "Minne"
  ,"brain8.nav.history": "Historik"
  ,"brain8.map.title": "Din levande kunskapskarta"
  ,"brain8.maturity.sparse": "Tar form"
  ,"brain8.maturity.medium": "Sammankopplad"
  ,"brain8.maturity.dense": "Utforskningsbar"
  ,"brain8.maturity.sparse.detail": "Second Brain börjar med dina första verkliga källor och aktiviteter."
  ,"brain8.maturity.medium.detail": "Dina begrepp, övningar och källor visar nu användbara mönster."
  ,"brain8.maturity.dense.detail": "Din karta har tillräckligt med underlag för fokuserad utforskning och filtrering."
  ,"brain8.metrics.concepts": "begrepp"
  ,"brain8.metrics.connections": "kopplingar"
  ,"brain8.metrics.events": "inlärningshändelser"
  ,"brain8.sparse.title": "Din hjärna tar form"
  ,"brain8.sparse.detail": "Lär dig, importera en källa eller sätt upp ett mål. Varje verklig interaktion berikar den här vyn."
  ,"brain8.action.learn": "Börja lära dig"
  ,"brain8.action.import": "Importera en källa"
  ,"brain8.action.goal": "Sätt upp ett mål"
  ,"brain8.recent.documents": "Senaste källor"
  ,"brain8.recent.knowledge": "Nyligen aktiv kunskap"
  ,"brain8.openKnowledge": "Utforska"
  ,"brain8.knowledge.empty": "Det finns ännu inget matchande begrepp."
  ,"brain8.knowledge.list": "Tillgänglig lista"
  ,"brain8.knowledge.graph": "Visuell karta"
  ,"brain8.graph.bounded": "{shown} av {total} begrepp har lästs in. Använd sökning eller läs in fler för att avgränsa kartan."
  ,"brain8.loadMore": "Läs in fler"
  ,"brain8.mastery.unknown": "Inte uppmätt"
  ,"brain8.mastery.unknown.detail": "Behärskning mäts inte förrän det finns tillräckligt med underlag från repetitioner."
  ,"brain8.mastery.value": "Uppskattad behärskning: {value}%"
  ,"brain8.strength.title": "Styrkor och bräcklig kunskap"
  ,"brain8.strength.note": "Dessa indikatorer kommer från repeterad kunskap, inte skolbetyg."
  ,"brain8.nba.badge": "Bästa nästa åtgärd"
  ,"brain8.nba.learn.title": "Förstå {concept}"
  ,"brain8.nba.learn.reason": "Det här begreppet är redo eller redan påbörjat i din nuvarande kunskapsväg."
  ,"brain8.nba.learn.action": "Fråga professorn"
  ,"brain8.nba.review.title": "Befäst {concept}"
  ,"brain8.nba.review.reason": "Dina befintliga repetitions- och minnessignaler visar att det här begreppet behöver uppmärksamhet."
  ,"brain8.nba.review.action": "Repetera nu"
  ,"brain8.nba.why": "Varför detta?"
  ,"brain8.nba.hideWhy": "Dölj förklaring"
  ,"brain8.nba.due": "Antal länkade repetitioner som förfaller: {count}"
  ,"brain8.memory.title": "Inlärningsminne"
  ,"brain8.memory.reviews": "slutförda repetitioner"
  ,"brain8.memory.due": "repetitioner som förfaller"
  ,"brain8.memory.sources": "inlärda källor"
  ,"brain8.memory.note": "Här räknas endast sparade lektioner, källor och repetitioner."
  ,"brain8.memory.open": "Öppna minnet"
  ,"brain8.memory.fragile": "Kunskap att befästa"
  ,"brain8.memory.review": "Öppna Repetera"
  ,"brain8.declared.title": "Det jag har berättat för Second Brain"
  ,"brain8.declared.detail": "Dina uttryckliga preferenser för lärande och professorn."
  ,"brain8.declared.empty": "Ingen angiven preferens ännu. Du kan fylla i den från din profil."
  ,"brain8.observed.title": "Det Second Brain observerar"
  ,"brain8.observed.detail": "Mönster som bygger på verkliga interaktioner och visas först när det finns tillräckligt med underlag."
  ,"brain8.observed.empty": "Det finns ännu inte tillräckligt med aktivitet för att identifiera ett tillförlitligt mönster."
  ,"brain8.observed.evidence": "Antal registrerade interaktioner: {count}"
  ,"brain8.observed.style.voice": "Använder ofta röst"
  ,"brain8.observed.style.handsOn": "Lär sig genom övning"
  ,"brain8.observed.style.reading": "Lär sig genom läsning"
  ,"brain8.observed.depth.simple": "Föredrar kortfattade förklaringar"
  ,"brain8.observed.depth.balanced": "Använder balanserade förklaringar"
  ,"brain8.observed.depth.deep": "Arbetar med detaljerade förklaringar"
  ,"brain8.observed.rhythm.occasional": "Sporadisk rytm"
  ,"brain8.observed.rhythm.regular": "Regelbunden rytm"
  ,"brain8.observed.rhythm.intensive": "Intensiv rytm"
  ,"brain8.observed.focus.morning": "Mer aktiv på morgonen"
  ,"brain8.observed.focus.afternoon": "Mer aktiv på eftermiddagen"
  ,"brain8.observed.focus.evening": "Mer aktiv på kvällen"
  ,"brain8.observed.focus.night": "Mer aktiv på natten"
  ,"brain8.dna.title": "Inlärnings-DNA"
  ,"brain8.dna.note": "Observationer under utveckling, inte en diagnos eller fast identitet."
  ,"brain8.dna.empty": "Inlärnings-DNA visas när upprepade interaktioner ger tillräckligt med underlag."
  ,"brain8.history.title": "Kognitiv historik"
  ,"brain8.history.empty": "Ingen inlärningshändelse har registrerats ännu."
  ,"brain8.history.kind.lesson": "Lektion"
  ,"brain8.history.kind.success": "Rätt svar"
  ,"brain8.history.kind.error": "Rättat misstag"
  ,"brain8.history.kind.revision": "Repetition"
  ,"brain8.history.kind.conversation": "Samtal med professorn"
  ,"brain8.history.kind.homework": "Läxa"
  ,"brain8.history.kind.report": "Slutförd session"
  ,"brain8.history.kind.document": "Källa tillagd"
  ,"brain8.history.kind.concept": "Begrepp tillagt"
  ,"brain8.history.kind.connection": "Koppling skapad"
  ,"brain8.foresight.title": "Insikt om din utveckling"
  ,"brain8.foresight.forecast": "Prognos"
  ,"brain8.foresight.note": "Detta är en uppskattning utifrån aktuella signaler, inte ett faktum."
  ,"brain8.foresight.action": "Se föreslagen åtgärd"
  ,"brain8.foresight.kind.dropout": "Risk för avbrott"
  ,"brain8.foresight.kind.difficulty": "Risk för svårigheter"
  ,"brain8.foresight.kind.overload": "Risk för överbelastning"
  ,"brain8.foresight.kind.motivation": "Risk för bristande motivation"
  ,"brain8.foresight.kind.forgetting": "Risk att glömma"
  ,"brain8.foresight.reason.dropout": "Dina senaste kontinuitetssignaler tyder på ett möjligt avbrott i din nuvarande rytm."
  ,"brain8.foresight.reason.difficulty": "Din nuvarande väg mot behärskning tyder på en möjlig svårighet längre fram."
  ,"brain8.foresight.reason.overload": "Signalerna från din nuvarande arbetsbelastning tyder på möjlig överbelastning."
  ,"brain8.foresight.reason.motivation": "Dina senaste aktivitetssignaler tyder på att du kan vara på väg att tappa farten."
  ,"brain8.foresight.reason.forgetting": "Din repetitionsprognos visar att viss kunskap kan bli svårare att minnas."
  ,"brain8.search.label": "Sök i din hjärna"
  ,"brain8.search.placeholder": "Begrepp, källa eller mål…"
  ,"brain8.search.action": "Sök"
  ,"brain8.search.kind.concept": "Begrepp"
  ,"brain8.search.kind.document": "Källa"
  ,"brain8.search.kind.goal": "Mål"
  ,"brain8.ask.title": "Fråga din hjärna…"
  ,"brain8.ask.detail": "Second Brain svarar endast utifrån dina begrepp och källor."
  ,"brain8.ask.placeholder": "Vad kan jag om nätverk?"
  ,"brain8.ask.action": "Fråga"
  ,"brain8.ask.answer.weakest": "Antal bräckliga begrepp som hittades: {count}"
  ,"brain8.ask.answer.neglected": "{count} begrepp med förfallna repetitioner hittades."
  ,"brain8.ask.answer.documents": "{count} matchande källor eller begrepp hittades."
  ,"brain8.ask.answer.knowledge": "{count} matchande element hittades i din hjärna."
  ,"brain8.ask.answer.no-results": "Dina aktuella data ger inget underlag för ett svar på den här frågan."
  ,"brain8.ask.grounded": "Svaret är begränsat till dina sparade data i Second Brain."
  ,"brain8.concept.pick": "Välj ett begrepp för att granska dess underlag och kopplingar."
  ,"brain8.concept.cards": "{count} kort"
  ,"brain8.concept.due": "{count} förfaller"
  ,"brain8.concept.stability": "{days} dagars minnesstabilitet"
  ,"brain8.concept.nextReview": "Nästa schemalagda repetition: {date}"
  ,"brain8.concept.tutor": "Fråga professorn"
  ,"brain8.concept.practice": "Öva"
  ,"brain8.concept.review": "Repetera"
  ,"brain8.concept.sources": "Källor"
  ,"brain8.concept.relations": "Kopplingar"
  ,"brain8.concept.activity": "Senaste interaktioner"
  ,"brain8.concept.truncated": "Endast de första tillgängliga källorna visas."
  ,"brain8.relation.prerequisite": "förkunskapskrav"
  ,"brain8.relation.related": "relaterat"
  ,"brain8.context.document": "Aktivt dokument"
  ,"brain8.context.session": "Professorssession"
  ,"brain8.context.goal": "Inlärningsmål"
  ,"brain8.partial": "Vissa avsnitt är tillfälligt otillgängliga, men tillgängliga data går fortfarande att använda."
  ,"brain8.error.load": "Din hjärna kunde inte läsas in just nu."
  ,"tutor6.result.brain": "Se påverkan på Min hjärna"
  ,"voice.error.playback": "Det gick inte att spela upp din lärares röst."
  ,"voice.error.blocked": "Ljuduppspelningen blockerades."
  ,"voice.error.recordUnsupported": "Ljudinspelning är inte tillgänglig på den här enheten."
  ,"voice.error.micDenied": "Åtkomst till mikrofonen nekades. Tillåt mikrofonåtkomst och försök igen."
  ,"voice.error.notRecording": "Ingen inspelning pågår."
  ,"voice.error.empty": "Inget spelades in. Kontrollera mikrofonen och försök igen."
  ,"error.timeout": "Begäran tog för lång tid. Försök igen."
  ,"error.unauthorized": "Din session har löpt ut eller inloggningsuppgifterna är ogiltiga."
  ,"error.forbidden": "Den här åtgärden är inte tillgänglig för detta konto."
  ,"error.notFound": "Det efterfrågade objektet är inte längre tillgängligt."
  ,"error.conflict": "Den här ändringen strider mot det aktuella tillståndet. Uppdatera och försök igen."
  ,"error.rateLimit": "För många försök. Vänta en stund innan du försöker igen."
  ,"error.validation": "Vissa uppgifter är ogiltiga. Kontrollera fälten och försök igen."
  ,"error.upload": "Uppladdningen misslyckades. Ditt befintliga arbete har bevarats."
  ,"error.download": "Filen kunde inte läsas in. Försök igen."
  ,"onb.languages.explanation": "Förklaringsspråk"
  ,"onb.languages.explanationWhy": "AI-professorn använder detta språk för allmänna förklaringar och vägledning."
  ,"mfa.title": "Tvåstegsverifiering"
  ,"mfa.intro": "Skydda ditt konto med en kod från din autentiseringsapp."
  ,"mfa.profileTitle": "Kontosäkerhet"
  ,"mfa.profileDetail": "Konfigurera tvåstegsverifiering från den säkra registreringssidan på webben."
  ,"mfa.open": "Konfigurera tvåstegsverifiering"
  ,"mfa.idleTitle": "Lägg till en autentiseringsapp"
  ,"mfa.idleDetail": "Börja först när din autentiseringsapp är redo. En ny privat konfigurationsnyckel skapas."
  ,"mfa.start": "Starta säker konfiguration"
  ,"mfa.setupTitle": "Anslut din autentiseringsapp"
  ,"mfa.setupDetail": "Lägg till kontot manuellt med nyckeln nedan eller importera otpauth-URI:n i en kompatibel autentiseringsapp."
  ,"mfa.secretLabel": "Manuell Base32-nyckel"
  ,"mfa.secretWarning": "Behandla den här nyckeln som ett lösenord. Dela den inte och spara den inte i en oskyddad anteckning."
  ,"mfa.uriLabel": "URI för autentiseringsapp"
  ,"mfa.uriDetail": "Använd endast detta i en autentiseringsapp som du litar på."
  ,"mfa.codeLabel": "6-siffrig autentiseringskod"
  ,"mfa.codeHint": "Ange den aktuella 6-siffriga koden som visas i din autentiseringsapp."
  ,"mfa.enable": "Verifiera och aktivera"
  ,"mfa.alreadyEnabled": "Tvåstegsverifiering kan redan vara aktiverad. Logga ut och logga in igen för att kontrollera den."
  ,"mfa.setupError": "Den säkra konfigurationen kunde inte startas. Ingenting aktiverades. Försök igen."
  ,"mfa.enableError": "Koden kunde inte verifieras. Kontrollera den aktuella koden och försök igen."
  ,"mfa.recoveryTitle": "Spara dina återställningskoder nu"
  ,"mfa.recoveryWarning": "Dessa koder visas bara en gång."
  ,"mfa.recoveryDetail": "Spara dem i en betrodd lösenordshanterare eller på en annan säker plats innan du lämnar den här sidan."
  ,"mfa.saved": "Jag har sparat mina återställningskoder"
  ,"mfa.doneTitle": "Tvåstegsverifiering är aktiverad"
  ,"mfa.doneDetail": "Nästa inloggning kräver din autentiseringsapp eller en oanvänd återställningskod."
  ,"mfa.backProfile": "Tillbaka till Profil"
  ,"nav.back": "Tillbaka"
  ,"shell.backToApp": "Tillbaka till appen"
  ,"shell.adminArea": "Administration"
  ,"shell.technicalArea": "Tekniskt område"
  ,"shell.demoArea": "Demoområde"
  ,"shell.legacyArea": "Äldre upplevelse"
  ,"shell.designSystem": "Designsystem"
  ,"learn.backToLearn": "Tillbaka till Lär dig"
  ,"learn.free.kicker": "Fri sökning"
  ,"learn.free.title": "Fråga vad som helst"
  ,"learn.free.subtitle": "En spontan fråga – akademisk, teknisk eller allmän. Skild från din pedagogiska AI-professor."
  ,"learn.free.placeholder": "Skriv din fråga…"
  ,"learn.free.submit": "Fråga"
  ,"learn.deep.kicker": "Fördjupad undersökning"
  ,"learn.deep.title": "Utforska ett ämne på djupet"
  ,"learn.deep.subtitle": "Professorn undersöker ditt ämne grundligt och återkommer med en strukturerad analys."
  ,"learn.deep.placeholder": "Vad vill du utforska på djupet?"
  ,"learn.deep.submit": "Undersök"
  ,"learn.deep.frame": "Ge en grundlig, strukturerad analys (sammanhang, huvudpunkter, nyanser, slutsats) av:"
  ,"learn.deep.note": "Livekällor och en stegvis undersökningsplan tillkommer i takt med att backend utvecklas."
  ,"learn.oral.kicker": "Muntlig övning"
  ,"learn.oral.title": "Svara högt"
  ,"learn.oral.subtitle": "Professorn ställer frågor. Du svarar med rösten och blir bedömd."
  ,"learn.oral.frame": "Genomför en kort muntlig övning anpassad till min profil. Ställ en fråga i taget. Jag svarar med rösten."
  ,"learn.oral.record": "Svara med rösten"
  ,"learn.oral.stop": "Stoppa"
  ,"learn.oral.ready": "Redo"
  ,"learn.oral.recording": "Lyssnar…"
  ,"learn.oral.analyzing": "Analyserar…"
  ,"learn.oral.you": "Du"
  ,"learn.oral.teacher": "Professor"
  ,"learn.oral.noVoice": "Röstinspelning är inte tillgänglig på den här enheten."
  ,"learn.oral.starting": "Förbereder övningen…"
  ,"learn.explain.kicker": "Förklara"
  ,"learn.explain.title": "Få ett begrepp förklarat"
  ,"learn.explain.subtitle": "En tydlig förklaring med exempel och analogier på den nivå du väljer."
  ,"learn.explain.levelLabel": "Nivå"
  ,"learn.explain.lvlBeginner": "Nybörjare"
  ,"learn.explain.lvlIntermediate": "Mellannivå"
  ,"learn.explain.lvlAdvanced": "Avancerad"
  ,"learn.explain.placeholder": "Vilket begrepp vill du förstå?"
  ,"learn.explain.submit": "Förklara"
  ,"learn.explain.frame": "Förklara det här begreppet tydligt, med exempel och analogier. Nivå:"
  ,"learn.discuss.kicker": "Samtal"
  ,"learn.discuss.title": "Prata med professorn"
  ,"learn.discuss.subtitle": "Ett fritt pedagogiskt samtal – professorn känner till din nivå och dina mål."
  ,"learn.discuss.placeholder": "Vad vill du prata om?"
  ,"learn.discuss.submit": "Starta"
  ,"learn.exam.kicker": "Muntlig tenta"
  ,"learn.exam.title": "Simulering av muntlig tenta"
  ,"learn.exam.subtitle": "Professorn blir examinator: ställer frågor, du svarar högt och blir sedan bedömd."
  ,"learn.exam.consignes": "Svara högt, en fråga i taget. Ta den tid du behöver."
  ,"learn.exam.start": "Starta tentan"
  ,"learn.exam.starting": "Startar tentan…"
  ,"learn.exam.elapsed": "Tid"
  ,"learn.exam.examiner": "Examinator"
  ,"learn.exam.end": "Avsluta tentan"
  ,"learn.exam.evaluating": "Bedömer…"
  ,"learn.exam.startFrame": "Ge mig en muntlig tenta. Presentera omfattningen kort och ställ sedan din första fråga. En fråga i taget. Jag svarar högt."
  ,"learn.exam.endFrame": "Avsluta tentan nu. Ge mig din bedömning: styrkor, förbättringsområden och rekommendationer. Var pedagogisk."
  ,"teach.kicker": "Undervisa"
  ,"teach.title": "Vad ska jag lära dig?"
  ,"teach.subtitle": "Ange ett ämne så bygger professorn en stegvis lektion åt dig."
  ,"teach.placeholder": "T.ex. fotosyntes, franska revolutionen, derivator…"
  ,"teach.submit": "Skapa lektionen"
  ,"learn.mode.errTitle": "Okänd upplevelse"
  ,"learn.mode.errDetail": "Det här inlärningsläget finns inte eller är ännu inte tillgängligt."
  ,"home4.loading": "Förbereder din nästa användbara åtgärd…"
  ,"home4.context.new": "Nu bygger vi ditt Second Brain."
  ,"home4.context.active": "Här är det mest användbara nästa steget utifrån dina aktuella framsteg."
  ,"home4.context.exam": "Din tenta i {focus} närmar sig."
  ,"home4.context.revision": "Du har repetition som faktiskt behöver göras nu."
  ,"home4.context.resume": "Du kan fortsätta med {focus} utan att förlora sammanhanget."
  ,"home4.context.caught-up": "Du är i fas. Det finns ingen konstgjord brådska."
  ,"home4.recommended": "Rekommenderas nu"
  ,"home4.whyClose": "Dölj orsaker"
  ,"home4.whyIntro": "Baserat på dessa verifierbara signaler:"
  ,"home4.confidence": "Uppskattad säkerhet: {value}%"
  ,"home4.resume": "Fortsätt där du slutade"
  ,"home4.resumeDetail": "Dina senaste sessioner behåller sitt sammanhang och arbete."
  ,"home4.resumeAction": "Fortsätt"
  ,"home4.session.type.learning": "Inlärning"
  ,"home4.session.type.tutor": "Handledare"
  ,"home4.session.type.research": "Undersökning"
  ,"home4.session.type.review": "Repetition"
  ,"home4.session.type.language": "Språk"
  ,"home4.session.type.workspace": "Arbetsyta"
  ,"home4.session.type.document-processing": "Dokument"
  ,"home4.lastActivity": "Senaste aktivitet"
  ,"home4.artifact": "Senaste arbete"
  ,"home4.upcoming": "Kommande"
  ,"home4.upcomingDetail": "Nästa inlärningshändelser som behöver din uppmärksamhet."
  ,"home4.upcomingEmpty": "Inget är schemalagt inom kort."
  ,"home4.planning": "Inlärningskalender"
  ,"home4.upcoming.kind.exam": "Tenta"
  ,"home4.upcoming.kind.homework": "Läxa"
  ,"home4.upcoming.kind.practical": "Praktiskt moment"
  ,"home4.upcoming.kind.language": "Språkövning"
  ,"home4.upcoming.kind.aiSession": "AI-session"
  ,"home4.upcoming.kind.revision": "Repetition"
  ,"home4.upcoming.kind.quiz": "Quiz"
  ,"home4.upcoming.kind.objective": "Mål"
  ,"home4.upcoming.kind.deadline": "Deadline"
  ,"home4.mainGoal": "Huvudmål"
  ,"home4.goal.period.daily": "Dagligt mål"
  ,"home4.goal.period.weekly": "Veckomål"
  ,"home4.goal.period.monthly": "Månadsmål"
  ,"home4.goal.open": "Öppna målet"
  ,"home4.progress.title": "Dina framsteg"
  ,"home4.progress.detail": "En kompakt bild av det som förändras i ditt lärande."
  ,"home4.progress.due": "repetitioner som förfaller"
  ,"home4.progress.mastered": "bemästrade begrepp"
  ,"home4.progress.streak": "dagars svit"
  ,"home4.progress.open": "Öppna Min hjärna"
  ,"home4.other": "Andra sätt att börja"
  ,"home4.otherDetail": "Fånga eller uttryck något när rekommendationen inte motsvarar det du behöver."
  ,"home4.date.today": "Idag"
  ,"home4.date.tomorrow": "Imorgon"
  ,"home4.date.yesterday": "Igår"
  ,"home4.date.unknown": "Okänt datum"
  ,"home4.partial": "Vissa källor är tillfälligt otillgängliga. Tillgängliga prioriteringar använder fortfarande verifierade data."
  ,"home4.stale": "Visar din senast tillgängliga startsida medan uppdateringen försöker igen."
  ,"home4.unavailable": "Ingen verifierad prioritering kunde läsas in just nu."
  ,"learn5.eyebrow": "Lär dig"
  ,"learn5.title": "Börja med det du vill uppnå"
  ,"learn5.subtitle": "Fråga, tala, fotografera, skanna eller importera. Second Brain väljer den befintliga upplevelse som passar din avsikt och behåller ditt sammanhang."
  ,"learn5.question": "Vad vill du lära dig eller göra?"
  ,"learn5.composer.badge": "En intelligent ingång"
  ,"learn5.composer.detail": "Beskriv resultatet med egna ord. Det är valfritt att välja en avsikt."
  ,"learn5.composer.placeholder": "Till exempel: förklara fotosyntesen, hjälp mig öva spanska eller skapa ett quiz från mina anteckningar…"
  ,"learn5.composer.inputLabel": "Det du vill lära dig eller åstadkomma"
  ,"learn5.composer.submit": "Fortsätt"
  ,"learn5.examples.label": "Prova något av detta"
  ,"learn5.examples.understand": "Förstå ett ämne"
  ,"learn5.examples.understandPrompt": "Förklara det här ämnet för mig: "
  ,"learn5.examples.practice": "Öva ett språk"
  ,"learn5.examples.practicePrompt": "Hjälp mig öva på att samtala på engelska"
  ,"learn5.examples.scan": "Skanna en sida"
  ,"learn5.examples.import": "Importera en kurs"
  ,"learn5.intent.label": "Avsikt (valfritt)"
  ,"learn5.intent.understand": "Förstå"
  ,"learn5.intent.learn": "Lär dig"
  ,"learn5.intent.practice": "Öva"
  ,"learn5.intent.research": "Undersök"
  ,"learn5.intent.create": "Skapa"
  ,"learn5.intent.suggested": "föreslaget"
  ,"learn5.depth.label": "Undersökningens djup"
  ,"learn5.depth.quick": "Snabbt svar"
  ,"learn5.depth.standard": "Källbelagd undersökning"
  ,"learn5.depth.deep": "Fördjupad undersökning"
  ,"learn5.modality.write": "Skriv"
  ,"learn5.modality.speak": "Tala"
  ,"learn5.modality.capture": "Fotografera"
  ,"learn5.modality.import": "Importera"
  ,"learn5.modality.export": "Exportera"
  ,"learn5.modality.exportData": "Öppna din dataexport"
  ,"learn5.route.prefix": "Nästa:"
  ,"learn5.route.capture": "öppna skannern, förhandsgranska sidorna och bekräfta sedan."
  ,"learn5.route.import": "importera den här filen till Biblioteket och dess dokumentflöde för förståelse."
  ,"learn5.route.voice": "starta ett muntligt utbyte med din AI-professor."
  ,"learn5.route.free-question": "fråga din AI-professor direkt."
  ,"learn5.route.document-understanding": "ställ frågor om det aktiva dokumentet och få källgrundade svar."
  ,"learn5.route.concept-explanation": "öppna en fokuserad förklaring av det aktiva begreppet."
  ,"learn5.route.explanation": "be din AI-professor om en strukturerad förklaring."
  ,"learn5.route.lesson": "skapa en vägledd lektion om det här ämnet."
  ,"learn5.route.guided-session": "starta den befintliga upplevelsen för vägledd session."
  ,"learn5.route.learning-path": "öppna din adaptiva inlärningsväg."
  ,"learn5.route.document-learning": "lär dig från det aktiva dokumentet."
  ,"learn5.route.practice": "förbered en övning."
  ,"learn5.route.document-practice": "skapa en övningsform utifrån det aktiva dokumentet."
  ,"learn5.route.oral-practice": "öppna muntlig övning med professorn."
  ,"learn5.route.language-practice": "fortsätt i det specialiserade språkområdet."
  ,"learn5.route.research-quick": "få ett kortfattat svar från professorn."
  ,"learn5.route.research-library": "undersök hela ditt Bibliotek och synliga källor."
  ,"learn5.route.research-deep": "öppna den avancerade upplevelsen för en fördjupad undersökning."
  ,"learn5.route.create-quiz": "förbered ett quiz på bedömningsarbetsytan."
  ,"learn5.route.create-course": "skapa en vägledd kurs."
  ,"learn5.route.create-work": "öppna Akademisk arbetsyta med dessa instruktioner."
  ,"learn5.route.create-from-document": "skapa utifrån det aktiva dokumentet."
  ,"learn5.clarify.question": "Vad vill du göra med det här ämnet?"
  ,"learn5.deep.confirmTitle": "Fördjupad undersökning använder ett avancerat arbetsflöde"
  ,"learn5.deep.confirmDetail": "Det kan ta längre tid och använda mer av din tilldelning. Din begäran förblir sparad om tjänsten inte är tillgänglig."
  ,"learn5.deep.confirm": "Bekräfta fördjupad undersökning"
  ,"learn5.attachment.ready": "redo att importeras"
  ,"learn5.attachment.remove": "Ta bort"
  ,"learn5.attachment.import": "Importera och fortsätt"
  ,"learn5.attachment.error": "Den här filen kunde inte väljas."
  ,"learn5.attachment.missing": "Välj filen igen innan du importerar den."
  ,"learn5.capture.title": "Fånga eller importera"
  ,"learn5.capture.detail": "En skanning förhandsgranskas före uppladdning. Filer går in i samma dokumentflöde för förståelse."
  ,"learn5.capture.scan": "Fotografera eller skanna en sida"
  ,"learn5.capture.file": "Välj en fil"
  ,"learn5.voice.stop": "Stoppa och skicka"
  ,"learn5.voice.error": "Inspelningen kunde inte slutföras."
  ,"learn5.voice.missing": "Ingen inspelning är redo att skickas."
  ,"learn5.voice.unavailable": "Mikrofonen är inte tillgänglig på den här enheten"
  ,"learn5.error.generic": "Den här åtgärden kunde inte startas."
  ,"learn5.error.preserved": "Din text, ditt sammanhang och din bilaga har bevarats. Du kan försöka igen eller använda en annan funktion utan AI."
  ,"learn5.draft.restored": "Utkast återställt"
  ,"learn5.draft.restoredDetail": "Din tidigare begäran och dess sammanhang finns kvar."
  ,"learn5.draft.clear": "Rensa"
  ,"learn5.cancel": "Avbryt"
  ,"learn5.context.user-profile": "Profil"
  ,"learn5.context.brain": "Min hjärna"
  ,"learn5.context.document": "Dokument"
  ,"learn5.context.document-collection": "Dokumentsamling"
  ,"learn5.context.concept": "Begrepp"
  ,"learn5.context.lesson": "Lektion"
  ,"learn5.context.goal": "Mål"
  ,"learn5.context.exam": "Tenta"
  ,"learn5.context.language": "Inlärningsspråk"
  ,"learn5.context.workspace": "Arbetsyta"
  ,"learn5.context.tutor-session": "Handledarsession"
  ,"learn5.context.research": "Undersökning"
  ,"learn5.context.revision": "Repetition"
  ,"learn5.context.learning-path": "Inlärningsväg"
  ,"learn5.resume.unavailable": "Sessioner är tillfälligt otillgängliga"
  ,"learn5.resume.unavailableDetail": "Skrivfältet är fortfarande tillgängligt och ditt utkast sparas."
  ,"learn5.spaces.title": "Specialiserade områden"
  ,"learn5.spaces.detail": "Öppna en särskild miljö när uppgiften gynnas av det."
  ,"learn5.spaces.languages": "Språk"
  ,"learn5.spaces.languagesDetail": "Språkbad, uttal och samtal."
  ,"learn5.spaces.library": "Bibliotek"
  ,"learn5.spaces.libraryDetail": "Dina dokument och källor på ett ställe."
  ,"learn5.spaces.workspace": "Akademisk arbetsyta"
  ,"learn5.spaces.workspaceDetail": "Skapa och förbättra strukturerade akademiska arbeten."
  ,"learn5.advanced.title": "Avancerade lägen"
  ,"learn5.advanced.detail": "Befintliga specialiserade upplevelser, tillgängliga när du vill ha direkt kontroll."
  ,"learn5.advanced.explain": "Förklara"
  ,"learn5.advanced.teach": "Lär mig"
  ,"learn5.advanced.guided": "Vägledd session"
  ,"learn5.advanced.oral": "Muntlig övning"
  ,"learn5.advanced.exam": "Muntlig tenta"
  ,"learn5.advanced.deep": "Fördjupad undersökning"
  ,"teacher.mode.lesson": "Lektion"
  ,"teacher.mode.exercise": "Övning"
  ,"teacher.mode.training": "Träning"
  ,"teacher.mode.assessed": "Bedömd"
  ,"teacher.mode.exam": "Tenta"
  ,"teacher.exam.rulesTitle": "Tentamensregler"
  ,"teacher.exam.mode": "Tentamensläge"
  ,"teacher.exam.grading": "Betygssättning"
  ,"teacher.exam.rubric": "Bedömningsmatris"
  ,"teacher.exam.help": "Tillåten hjälp"
  ,"teacher.exam.helpLimited": "Begränsad hjälp"
  ,"teacher.exam.helpNone": "Ingen hjälp"
  ,"teacher.exam.feedbackAfter": "Återkoppling efter inlämning"
  ,"profile.intro": "Hantera din identitet, dina inställningar för Second Brain, språk, abonnemang och data."
  ,"profile.section.myProfile": "Min profil"
  ,"profile.section.myProfileDetail": "Din identitet och det inlärningssammanhang som används i hela produkten."
  ,"profile.section.personalization": "Anpassning av Second Brain"
  ,"profile.section.personalizationDetail": "Välj hur din AI-professor undervisar. Ditt detaljerade inlärnings-DNA finns kvar i Min hjärna."
  ,"profile.section.languages": "Språk och upplevelse"
  ,"profile.section.languagesDetail": "Ställ in gränssnittsspråket separat från språket du lär dig."
  ,"profile.section.billing": "Abonnemang och användning"
  ,"profile.section.billingDetail": "Se ditt nuvarande abonnemang, verkliga gränser, återstående användning och återställningsdatum."
  ,"profile.section.privacy": "Data och integritet"
  ,"profile.section.privacyDetail": "Styr utseende, AI-minne, dokument, samtycken och dina personuppgifter."
  ,"profile.billing.current": "Nuvarande abonnemang"
  ,"profile.billing.unavailable": "Abonnemanget är inte tillgängligt"
  ,"profile.billing.usageUnavailable": "Användningsuppgifterna är tillfälligt otillgängliga."
  ,"profile.billing.viewUsage": "Visa användning och kvoter"
  ,"profile.brainPreview.title": "Inlärningsprofil"
  ,"profile.brainPreview.detail": "En kort förhandsvisning. Ditt inlärnings-DNA, minne och din behärskning finns i Min hjärna."
  ,"profile.brainPreview.empty": "Din inlärningsprofil visas när du slutför sessioner."
  ,"profile.brainPreview.open": "Öppna Min hjärna"
  ,"profile.languages.specialized": "Gränssnittsspråket är skilt från språket du lär dig."
  ,"profile.languages.open": "Öppna Språk och språkbad"
  ,"profile.privacy.detail": "Dina detaljerade inställningar för integritet och minne är alltid tillgängliga."
  ,"profile.privacy.memory": "AI-minne"
  ,"profile.privacy.documents": "Mina dokument"
  ,"profile.partial": "Vissa profiluppgifter kunde inte uppdateras. De tillgängliga inställningarna går fortfarande att använda."
  ,"profile.teacher.title": "Min AI-professor"
  ,"profile.teacher.detail": "Mindre krävande ger fler ledtrådar och nya försök. Normalläget är livfullt, uppmuntrande och strukturerat. Krävande begär djupare resonemang och exakta rättelser."
  ,"profile.teacher.auto": "Automatisk anpassning"
  ,"profile.teacher.autoDetail": "Second Brain fortsätter att anpassa vägledning, tempo och svårighetsgrad utifrån dina verkliga framsteg. Normal är standard utanför aviserade bedömningar."
  ,"profile.teacher.learning": "Undervisningsnivå"
  ,"profile.teacher.learning.guided": "Mindre krävande"
  ,"profile.teacher.learning.balanced": "Normal"
  ,"profile.teacher.learning.demanding": "Krävande"
  ,"profile.teacher.conversation": "Samtalsläge"
  ,"profile.teacher.conversation.training": "Träning"
  ,"profile.teacher.conversation.assessed": "Bedömt"
  ,"profile.teacher.conversation.trainingDetail": "Öva fritt med ledtrådar och rättelser."
  ,"profile.teacher.conversation.assessedDetail": "Genomför ett aviserat bedömt samtal med begränsad hjälp och evidensbaserad återkoppling."
  ,"profile.teacher.exam": "Tentamensläge"
  ,"profile.teacher.exam.standard": "Standard"
  ,"profile.teacher.exam.strict": "Strikt"
  ,"profile.teacher.examDetail": "Tentamensreglerna styr tillgänglig hjälp, betygssättning och tidpunkten för återkoppling."
  ,"profile.teacher.advancedOpen": "Visa avancerade inställningar"
  ,"profile.teacher.advancedClose": "Dölj avancerade inställningar"
  ,"profile.teacher.correction": "Tidpunkt för rättelse"
  ,"profile.teacher.correction.immediate": "Rätta omedelbart"
  ,"profile.teacher.correction.let_me_finish": "Låt mig avsluta"
  ,"profile.teacher.correction.adaptive": "Anpassa efter situationen"
  ,"profile.teacher.summary": "Sessionssammanfattning"
  ,"profile.teacher.encouragement": "Uppmuntran"
  ,"profile.teacher.encouragement.measured": "Återhållsam"
  ,"profile.teacher.encouragement.supportive": "Stöttande"
  ,"profile.teacher.reset": "Återställ standardvärden"
  ,"profile.settings.saveError": "Dessa inställningar kunde inte sparas."
  ,"profile.settings.preserved": "Dina tidigare inställningar har bevarats."
  ,"tutor.fasterMsg": "Jag förstår – kan du gå lite snabbare?"
  ,"tutor.loadFailed": "Klassrummet kunde inte öppnas."
  ,"tutor6.lobby.loading": "Öppnar dina inlärningssessioner…"
  ,"tutor6.lobby.eyebrow": "AI-professor"
  ,"tutor6.lobby.title": "Vad vill du arbeta med?"
  ,"tutor6.lobby.subtitle": "Fortsätt precis där du slutade eller starta en fokuserad begäran."
  ,"tutor6.lobby.continueTitle": "Fortsätt där du slutade"
  ,"tutor6.lobby.resumeDetail": "Ditt mål, sammanhang och din historik har bevarats."
  ,"tutor6.lobby.resume": "Fortsätt sessionen"
  ,"tutor6.lobby.newTitle": "Ny begäran"
  ,"tutor6.lobby.placeholder": "Förklara ett begrepp, ställ frågor till mig, hjälp mig öva…"
  ,"tutor6.lobby.start": "Fråga professorn"
  ,"tutor6.lobby.openSaved": "Öppna den sparade sessionen"
  ,"tutor6.lobby.recent": "Senaste sessioner"
  ,"tutor6.lobby.completed": "Slutförda sessioner"
  ,"tutor6.lobby.modes": "Andra sätt att arbeta"
  ,"tutor6.lobby.mode.explain": "Förklara"
  ,"tutor6.lobby.mode.discuss": "Diskutera"
  ,"tutor6.lobby.mode.oral": "Muntlig övning"
  ,"tutor6.lobby.mode.deep": "Fördjupad undersökning"
  ,"tutor6.objective": "Inlärningsmål"
  ,"tutor6.strategy": "Undervisningsmetod"
  ,"tutor6.empty": "Ställ din första fråga. Ditt mål och aktiva sammanhang förblir kopplade till den här sessionen."
  ,"tutor6.loading.detail": "Återställer målet, sammanhanget och det senaste samtalet."
  ,"tutor6.backTutor": "Tillbaka till Professorn"
  ,"tutor6.pause": "Pausa och lämna"
  ,"tutor6.complete": "Slutför sessionen"
  ,"tutor6.options": "Sessionsalternativ"
  ,"tutor6.state.ready": "Redo"
  ,"tutor6.state.listening": "Lyssnar"
  ,"tutor6.state.transcription": "Transkriberar din röst…"
  ,"tutor6.state.thinking": "Professorn förbereder ett svar…"
  ,"tutor6.state.response": "Svaret är klart"
  ,"tutor6.state.error": "Åtgärd krävs"
  ,"tutor6.voice.heard": "Transkriberingen har sparats: ”{text}”"
  ,"tutor6.voice.saved": "Ditt muntliga inlägg och den skrivna lektionen ”{topic}” har sparats."
  ,"tutor6.error.provider": "Professorn är tillfälligt otillgänglig"
  ,"tutor6.error.preserved": "Ditt utkast och din session har bevarats."
  ,"tutor6.error.retry": "Försök med begäran igen"
  ,"tutor6.quota.title": "Gränsen för AI-användning har nåtts"
  ,"tutor6.quota.detail": "Den här AI-åtgärden är pausad. Du kan fortfarande läsa dina dokument och använda områden utan AI."
  ,"tutor6.quota.reset": "AI-åtgärder blir tillgängliga igen efter {date}. Din session förblir sparad."
  ,"tutor6.quota.usage": "Visa användning"
  ,"tutor6.quota.library": "Öppna Biblioteket"
  ,"tutor6.block.text": "Svar"
  ,"tutor6.block.teaching": "Förklaring"
  ,"tutor6.block.example": "Exempel"
  ,"tutor6.block.question": "Kontrollera din förståelse"
  ,"tutor6.block.exercise": "Övning"
  ,"tutor6.block.quiz": "Quiz"
  ,"tutor6.block.summary": "Sammanfattning"
  ,"tutor6.block.source": "Källa"
  ,"tutor6.block.action": "Nästa steg"
  ,"tutor6.block.progress": "Framsteg"
  ,"tutor6.progress.title": "Det som förändrades under sessionen"
  ,"tutor6.progress.count": "{done} av {total} verkliga steg slutförda"
  ,"tutor6.progress.completed": "{done} slutförda steg"
  ,"tutor6.impact.concept-added": "Ett begrepp lades till i din hjärna"
  ,"tutor6.impact.connection-added": "En kunskapskoppling lades till"
  ,"tutor6.impact.mastery": "Behärskningen av begreppet förändrades"
  ,"tutor6.impact.memory": "Ditt minnesschema förändrades"
  ,"tutor6.impact.progress": "Dina inlärningsframsteg förändrades"
  ,"tutor6.result.title": "Välj nästa steg"
  ,"tutor6.result.detail": "Fortsätt, befäst eller återvänd till sammanhanget du kom från."
  ,"tutor6.result.continue": "Fortsätt lära dig"
  ,"tutor6.result.consolidate": "Befäst genom övning"
  ,"tutor6.result.origin": "Återvänd till det ursprungliga sammanhanget"
  ,"strategy.reason.socratic": "Vägledande frågor hjälper dig att själv bygga resonemanget innan professorn bekräftar det."
  ,"strategy.reason.project_based": "En konkret produktion ger varje begrepp en omedelbar användning."
  ,"strategy.reason.problem_solving": "Det här ämnet blir tydligare när du löser ett meningsfullt steg i taget."
  ,"strategy.reason.case_study": "Ett realistiskt fall gör de bakomliggande principerna lättare att undersöka."
  ,"strategy.reason.task_based": "Att använda färdigheten i en verklig uppgift stödjer aktivt lärande."
  ,"strategy.reason.guided_demonstration": "Ett genomarbetat exempel ger stöd innan du stegvis tar över."
  ,"strategy.reason.active_learning": "Korta, återkommande aktiviteter håller dig aktivt engagerad."
  ,"strategy.reason.experiential": "Att tillämpa begreppet och reflektera över resultatet hjälper dig att fördjupa behärskningen."
  ,"library7.owned": "Det jag äger"
  ,"library7.mission": "Allt du har gett till Second Brain – organiserat, förstått och redo att lära dig av."
  ,"library7.offline": "Biblioteket är offline just nu."
  ,"library7.stale.title": "Offlinevy"
  ,"library7.stale.detail": "Detta är de senast sparade uppgifterna i Biblioteket. Åtgärder som behöver Second Brain blir tillgängliga efter återanslutning."
  ,"library7.import": "Importera"
  ,"library7.scan": "Skanna"
  ,"library7.batch": "Flera dokument"
  ,"library7.ask": "Fråga mina källor"
  ,"library7.search": "Sök efter filer, ämnen eller sammanfattningar…"
  ,"library7.sort.newest": "Nyaste"
  ,"library7.sort.oldest": "Äldsta"
  ,"library7.sort.title": "Titel"
  ,"library7.more": "Läs in fler"
  ,"library7.favorite": "Lägg till eller ta bort från favoriter"
  ,"library7.conceptsCount": "Upptäckta begrepp: {n}"
  ,"library7.documentsCount": "{n} dokument"
  ,"library7.collection.create": "Ny samling"
  ,"library7.collection.name": "Samlingens namn"
  ,"library7.collection.none": "Ingen samling"
  ,"library7.empty.title": "Ditt Bibliotek är fortfarande tomt"
  ,"library7.empty.detail": "Lägg till en kurs, bok, artikel eller dina anteckningar. Second Brain kan förstå dem, koppla dem till din hjärna och hjälpa dig att lära dig innehållet."
  ,"library7.empty.pipeline": "Det här händer efter en import"
  ,"library7.empty.import": "Importera"
  ,"library7.empty.read": "Läsa"
  ,"library7.empty.understand": "Förstå"
  ,"library7.empty.connect": "Koppla"
  ,"library7.empty.ready": "Klart"
  ,"library7.import.title": "Lägg till en källa"
  ,"library7.import.file": "Fil"
  ,"library7.import.text": "Anteckningar"
  ,"library7.import.url": "Webbsida"
  ,"library7.import.formats": "PDF, text, Markdown och bilder använder samma dokumentflöde."
  ,"library7.import.choose": "Välj en fil"
  ,"library7.quota.title": "Användningsgränsen har nåtts"
  ,"library7.quota.reset": "Tillgängligt igen: {date}."
  ,"library7.quota.usage": "Visa användning"
  ,"library7.quota.alternatives": "Fortfarande tillgängligt"
  ,"document.pipeline.queued": "Väntar på att läsas"
  ,"document.pipeline.reading": "Läser dokumentet"
  ,"document.pipeline.extracting": "Extraherar användbart innehåll"
  ,"document.pipeline.indexing": "Förbereder dokumentsökning"
  ,"document.pipeline.connecting": "Kopplar samman begrepp"
  ,"document.pipeline.completed": "Dokumentet är klart"
  ,"document.pipeline.failed": "Bearbetningen stoppades"
  ,"document.pipeline.noEstimate": "Aktuellt steg – ingen tillförlitlig tidsuppskattning"
  ,"document.pipeline.retry": "Försök med dokumentet igen"
  ,"document.pipeline.retryOcr": "Läs den sparade skanningen igen"
  ,"document.pipeline.ocrFailed": "Textigenkänningen misslyckades. Dina fotograferade eller inskannade sidor är fortfarande sparade."
  ,"document.pipeline.ocrRetryHelp": "De fotograferade eller inskannade sidorna har bevarats. Den här åtgärden försöker med textigenkänningen igen. Den indexerar inte om ett tomt dokument."
  ,"document.batch.title": "Importera flera dokument"
  ,"document.batch.detail": "Varje fil bearbetas oberoende. Ett fel avbryter aldrig dokument som har lyckats."
  ,"document.batch.choose": "Välj dokument"
  ,"document.batch.start": "Starta importen"
  ,"document.batch.cancel": "Stoppa väntande importer"
  ,"document.batch.summary": "Totalt: {total} · Klara: {done} · Bearbetas: {processing} · Misslyckades: {failed}"
  ,"document.batch.waiting": "Väntar"
  ,"document.batch.uploading": "Laddar upp…"
  ,"document.batch.result": "Importsammanfattning"
  ,"document.batch.resultDetail": "Klara dokument: {documents} · Upptäckta begrepp: {concepts}"
  ,"document.batch.subjects": "Upptäckta ämnen"
  ,"source.passage": "Textavsnitt {n}"
  ,"source.close": "Stäng förhandsvisningen av källan"
  ,"source.openDocument": "Öppna dokumentet"
  ,"library7.document.loading": "Öppnar Dokumentintelligens…"
  ,"library7.document.intelligence": "Dokumentintelligens"
  ,"library7.document.processingHelp": "Du kan lämna den här sidan. Bearbetningen fortsätter utan att det importerade dokumentet går förlorat."
  ,"library7.document.previewLimited": "Begränsad förhandsvisning"
  ,"library7.document.previewLimitedDetail": "Endast den första delen läses in här för att sidan ska förbli responsiv."
  ,"library7.backLibrary": "Tillbaka till Biblioteket"
  ,"library7.action.ask": "Fråga det här dokumentet"
  ,"library7.action.learn": "Lär dig det här dokumentet"
  ,"library7.action.more": "Fler åtgärder"
  ,"library7.action.less": "Färre åtgärder"
  ,"library7.action.advanced": "Omvandla eller organisera"
  ,"library7.action.quiz": "Skapa quiz"
  ,"library7.action.flashcards": "Skapa flashcards"
  ,"library7.action.workspace": "Lägg till i ett arbete"
  ,"library7.tab.document": "Dokument"
  ,"library7.tab.understand": "Förstå"
  ,"library7.tab.ask": "Fråga"
  ,"library7.understood": "Det Second Brain förstår"
  ,"library7.summaryUnavailable": "Ingen sammanfattning är tillgänglig ännu. Originaldokumentet är fortfarande åtkomligt."
  ,"library7.concepts": "Upptäckta begrepp: {n}"
  ,"library7.noConcepts": "Dokumentmotorn returnerade inget begrepp."
  ,"library7.brainImpact": "{known} redan kända · {new} nya · {links} kopplingar skapade"
  ,"library7.brain.open": "Visa i Min hjärna"
  ,"library7.resources": "Omvandlingar"
  ,"library7.resources.trace": "Skapat från {title}"
  ,"library7.compare.with": "Jämför med…"
  ,"library7.nba.title": "Föreslaget nästa steg"
  ,"library7.nba.learn": "Lär dig de {n} nya begreppen"
  ,"library7.nba.ask": "Fråga det här dokumentet"
  ,"library7.nba.flashcards": "Skapa flashcards"
  ,"library7.nba.brain": "Se kopplingar i hjärnan"
  ,"library7.ask.documentTitle": "Fråga det här dokumentet"
  ,"library7.ask.noAnswer": "De valda källorna innehåller inget svar"
  ,"library7.ask.ownedSources": "Endast mina källor"
  ,"library7.ask.title": "Fråga mina källor"
  ,"library7.ask.detail": "Välj exakt omfattning. Second Brain svarar endast utifrån hämtade textavsnitt och visar sina källor."
  ,"library7.ask.scope.all": "Alla"
  ,"library7.ask.scope.collection": "Samling"
  ,"library7.ask.scope.selected": "Valda"
  ,"library7.ask.noCollections": "Skapa först en samling i Biblioteket."
  ,"library7.ask.selectedCount": "Antal valda: {n}"
  ,"library7.ask.chooseScope": "Välj källor"
  ,"library7.ask.chooseScopeDetail": "Välj en samling eller minst ett dokument innan du frågar."
  ,"research10.eyebrow": "Undersökning"
  ,"research10.title": "Undersök med belägg"
  ,"research10.subtitle": "Hitta, dubbelkontrollera, analysera och syntetisera det som dina egna källor faktiskt stödjer."
  ,"research10.question": "Undersökningsfråga"
  ,"research10.placeholder": "T.ex. jämför TCP och UDP med hjälp av mina kursdokument."
  ,"research10.depth": "Djup"
  ,"research10.depth.quick": "Snabb fråga"
  ,"research10.depth.sourced": "Källbelagd undersökning"
  ,"research10.depth.deep": "Fördjupad undersökning"
  ,"research10.depth.quick.detail": "Ett kortfattat svar från tillgängliga källor."
  ,"research10.depth.sourced.detail": "Analys med uttryckliga källor och hänvisningar."
  ,"research10.depth.deep.detail": "En plan, samling, jämförelse och strukturerad syntes."
  ,"research10.scope": "Källor att söka i"
  ,"research10.scope.edit": "Välj källor · {count} valda"
  ,"research10.scope.apply": "Använd källor"
  ,"research10.scope.brain": "Min hjärna"
  ,"research10.scope.library": "Mitt Bibliotek"
  ,"research10.scope.documents": "Valda dokument"
  ,"research10.scope.collection": "Samling"
  ,"research10.scope.external": "Externa källor"
  ,"research10.scope.web": "Webben"
  ,"research10.webUnavailable": "Webbundersökning är inte tillgänglig"
  ,"research10.webUnavailableDetail": "Ingen extern undersökningsleverantör är konfigurerad. Din hjärna och ditt Bibliotek är fortfarande tillgängliga."
  ,"research10.documents": "Välj dokument"
  ,"research10.documents.empty": "Inget färdigt dokument är tillgängligt."
  ,"research10.collections": "Välj en samling"
  ,"research10.collections.empty": "Ingen samling är tillgänglig."
  ,"research10.deep.costTitle": "Undersökning med högre användning"
  ,"research10.deep.costDetail": "Fördjupad undersökning läser fler källor. Granska planen innan du börjar. Inget kostsamt startar i tysthet."
  ,"research10.reviewPlan": "Granska undersökningsplanen"
  ,"research10.launch": "Starta en undersökning"
  ,"research10.cancel": "Avbryt"
  ,"research10.cancelled": "Undersökningen avbröts. Din sparade session är fortfarande tillgänglig."
  ,"research10.plan.title": "Föreslagen undersökningsplan"
  ,"research10.plan.find": "Identifiera relevanta källor inom den valda omfattningen."
  ,"research10.plan.compare": "Jämför de ståndpunkter som stöds av dessa källor."
  ,"research10.plan.verify": "Synliggör motsägelser och luckor i underlaget."
  ,"research10.plan.synthesize": "Ta fram den strukturerade syntesen med källhänvisningar."
  ,"research10.running": "Undersökning pågår"
  ,"research10.runningDetail": "Second Brain söker i de valda källorna. Ingen uppskattad procent för färdigställande visas."
  ,"research10.running.collect": "Samlar in valda källor"
  ,"research10.noSources": "Ingen stödjande källa hittades"
  ,"research10.noSourcesDetail": "Second Brain skapade inget svar eftersom de valda källorna inte ger stöd för ett. Ändra omfattningen eller frågan."
  ,"research10.partial": "Delvis genomförd undersökning"
  ,"research10.partialDetail": "Vissa valda källor var otillgängliga. Resultatet nedan använder endast de källor som faktiskt lästes."
  ,"research10.synthesis": "Syntes"
  ,"research10.keyPoints": "Huvudpunkter"
  ,"research10.comparison": "Källjämförelse"
  ,"research10.agreements": "Överensstämmelser"
  ,"research10.divergences": "Skillnader"
  ,"research10.specificities": "Särdrag"
  ,"research10.sources": "Använda källor"
  ,"research10.stage.sources-found": "Källor hittade"
  ,"research10.stage.sources-read": "Källor lästa"
  ,"research10.stage.compared": "Källor jämförda"
  ,"research10.stage.synthesized": "Syntesen slutförd"
  ,"research10.next": "Fortsätt från den här undersökningen"
  ,"research10.next.reason": "En källbelagd syntes är redo att omvandlas till aktivt lärande."
  ,"research10.action.learn": "Lär dig det här ämnet"
  ,"research10.action.workspace": "Lägg till i Arbetsytan"
  ,"research10.action.deepen": "Fördjupa"
  ,"research10.quota": "Undersökningsgränsen har nåtts"
  ,"research10.quotaDetail": "Undersökningen startades inte igen. Du kan fortfarande använda områden utan AI eller granska din användning."
  ,"research10.openUsage": "Visa användning"
  ,"workspace10.eyebrow": "Akademisk arbetsyta"
  ,"workspace10.title": "Bygg ditt arbete"
  ,"workspace10.subtitle": "Organisera en plan, skriv, ange källor och be om kontextuell hjälp utan att lämna ifrån dig författarskapet."
  ,"workspace10.create": "Skapa en arbetsyta"
  ,"workspace10.createAction": "Skapa arbetsyta"
  ,"workspace10.template.memoire": "Avhandling"
  ,"workspace10.template.tfc": "Examensarbete"
  ,"workspace10.template.dissertation": "Uppsats"
  ,"workspace10.template.report": "Rapport"
  ,"workspace10.template.article": "Artikel"
  ,"workspace10.template.assignment": "Inlämningsuppgift"
  ,"workspace10.template.academic-research": "Akademisk forskning"
  ,"workspace10.template.other": "Annat"
  ,"workspace10.field.title": "Titel"
  ,"workspace10.field.titlePlaceholder": "Namnge arbetet"
  ,"workspace10.field.objective": "Mål"
  ,"workspace10.field.objectivePlaceholder": "Vad försöker du visa eller ta fram?"
  ,"workspace10.field.due": "Valfritt slutdatum"
  ,"workspace10.sources": "Källor"
  ,"workspace10.sourceCount": "{n} valda"
  ,"workspace10.sourceMode.documents": "Dokument"
  ,"workspace10.sourceMode.collections": "Samlingar"
  ,"workspace10.structure": "Startstruktur"
  ,"workspace10.defaultPlan.0": "Inledning"
  ,"workspace10.defaultPlan.1": "Huvuddel"
  ,"workspace10.defaultPlan.2": "Slutsats"
  ,"workspace10.integrity": "Ditt resonemang står i centrum"
  ,"workspace10.integrityDetail": "Second Brain hjälper dig att förstå, ange källor och verifiera. Det skriver inte i hemlighet ett fullständigt akademiskt arbete åt dig."
  ,"workspace10.resume": "Fortsätt i en arbetsyta"
  ,"workspace10.resumeDetail": "Din plan, ditt innehåll, dina källor och assistenthistoriken hålls samlade."
  ,"workspace10.loading": "Läser in dina arbetsytor…"
  ,"workspace10.empty": "Ingen arbetsyta ännu"
  ,"workspace10.emptyDetail": "Skapa en för att organisera ett verkligt arbete och fortsätta med det senare."
  ,"workspace10.open": "Fortsätt"
  ,"workspace10.sourcesN": "{n} källor"
  ,"workspace10.steps": "{done} av {total} verkliga steg slutförda"
  ,"workspace10.status.active": "Aktiv"
  ,"workspace10.status.paused": "Pausad"
  ,"workspace10.status.completed": "Slutförd"
  ,"workspace10.status.archived": "Arkiverad"
  ,"workspace10.opening": "Öppnar din arbetsyta…"
  ,"workspace10.openingDetail": "Läser in den sparade planen, utkastet, källorna och assistenthistoriken."
  ,"workspace10.unavailable": "Arbetsytan är inte tillgänglig"
  ,"workspace10.noObjective": "Inget mål har lagts till ännu."
  ,"workspace10.area.plan": "Plan"
  ,"workspace10.area.work": "Arbete"
  ,"workspace10.area.sources": "Källor"
  ,"workspace10.area.assistant": "Assistent"
  ,"workspace10.plan": "Plan"
  ,"workspace10.plan.new": "Nytt avsnitt"
  ,"workspace10.plan.rename": "Byt namn på avsnitt"
  ,"workspace10.plan.remove": "Ta bort"
  ,"workspace10.plan.add": "Lägg till ett avsnitt"
  ,"workspace10.editor.heading": "Rubrik"
  ,"workspace10.editor.list": "Lista"
  ,"workspace10.editor.quote": "Citat"
  ,"workspace10.editor.reference": "Referens"
  ,"workspace10.editor.placeholder": "Börja skriva här…"
  ,"workspace10.editor.label": "Arbetsytans innehåll"
  ,"workspace10.save.idle": "Oförändrat"
  ,"workspace10.save.dirty": "Ändringarna har inte sparats ännu"
  ,"workspace10.save.saving": "Sparar…"
  ,"workspace10.save.saved": "Sparat"
  ,"workspace10.save.error": "Fel vid sparande"
  ,"workspace10.save.offline": "Offline – ändringarna finns kvar på skärmen"
  ,"workspace10.saveNow": "Spara nu"
  ,"workspace10.conflict": "Den här arbetsytan har ändrats någon annanstans. Läs in den på nytt innan du sparar igen så att inget arbete skrivs över."
  ,"workspace10.sourcesEmpty": "Ingen källa har bifogats ännu."
  ,"workspace10.addSource": "Lägg till en källa"
  ,"workspace10.assistant": "Second Brain-assistent"
  ,"workspace10.assistantDetail": "Kontextuell hjälp för det här arbetet. Ditt utkast förblir den huvudsakliga arbetsytan."
  ,"workspace10.assist.explain": "Förklara"
  ,"workspace10.assist.challenge": "Utmana"
  ,"workspace10.assist.suggest": "Föreslå"
  ,"workspace10.assist.structure": "Strukturera"
  ,"workspace10.assist.compare-sources": "Jämför källor"
  ,"workspace10.assist.check-coherence": "Kontrollera sammanhållningen"
  ,"workspace10.assist.rephrase": "Formulera om"
  ,"workspace10.selection": "Valt textavsnitt"
  ,"workspace10.assistantQuestion": "Begäran"
  ,"workspace10.assistantPlaceholder": "Fråga om det aktuella arbetet eller det valda textavsnittet…"
  ,"workspace10.assistantSend": "Fråga assistenten"
  ,"workspace10.next": "Bästa nästa åtgärd"
  ,"workspace10.nextSection": "Fortsätt: {section}"
  ,"workspace10.nextSources": "Lägg till en källa innan du utvecklar argumentet."
  ,"workspace10.continue": "Fortsätt skriva"
  ,"workspace10.askTutor": "Fråga professorn"
  ,"workspace10.research": "Starta en undersökning"
  ,"languages11.eyebrow": "Språk och språkbad"
  ,"languages11.title": "Din språkträning"
  ,"languages11.description": "Ett fokuserat område för samtal, ordförråd, förståelse, skrivande och muntlig övning."
  ,"languages11.preferences": "Språk"
  ,"languages11.goal.empty": "Lägg till ett mål för att göra övningen mer träffsäker."
  ,"languages11.goal.label": "Inlärningsmål"
  ,"languages11.goal.placeholder": "Resa, tenta, arbete, samtal…"
  ,"languages11.level.title": "Din nivå"
  ,"languages11.level.declared": "angiven nivå"
  ,"languages11.level.notEvaluated": "Den här nivån har du själv angett. Ingen bedömning har utvärderat den ännu."
  ,"languages11.metric.words": "ord"
  ,"languages11.metric.due": "förfaller"
  ,"languages11.metric.sessions": "sessioner"
  ,"languages11.metric.lessons": "lektioner"
  ,"languages11.lastActivity": "Senaste aktivitet: {date}"
  ,"languages11.lastActivity.none": "Ingen aktivitet ännu."
  ,"languages11.nba.badge": "NÄSTA ÖVNING"
  ,"languages11.nba.start": "Starta"
  ,"languages11.nba.review": "Repetera {count} ord och uttryck"
  ,"languages11.nba.reasonDue": "Dessa objekt förfaller nu enligt ditt FSRS-schema för minnet."
  ,"languages11.nba.firstConversation": "Starta ditt första vägledda samtal"
  ,"languages11.nba.reasonStart": "Ett kort utbyte skapar ditt första aktiva övningssammanhang."
  ,"languages11.nba.lesson": "Bygg din första fokuserade lektion"
  ,"languages11.nba.reasonLesson": "Du har övat, men ingen språklektion har skapats ännu."
  ,"languages11.nba.conversation": "Fortsätt med ett kort samtal"
  ,"languages11.nba.reasonPractice": "Regelbunden produktion håller språket aktivt."
  ,"languages11.resume.title": "Fortsätt en språksession"
  ,"languages11.resume.action": "Fortsätt"
  ,"languages11.resume.empty": "Ingen avbruten session"
  ,"languages11.resume.emptyDetail": "Din nästa meningsfulla övning visas här när du har börjat."
  ,"languages11.openSpace": "Öppna det här språkområdet"
  ,"languages11.empty.title": "Välj ett språk för att börja"
  ,"languages11.empty.detail": "Second Brain kopplar samman lektioner, samtal och verkliga FSRS-repetitioner av ordförråd."
  ,"languages11.create.title": "Börja lära dig {language}"
  ,"languages11.create.action": "Skapa språkområde"
  ,"languages11.other.title": "Andra språk"
  ,"languages11.space.eyebrow": "Fokuserat språkområde"
  ,"languages11.formats.title": "Övningsformer"
  ,"languages11.formats.detail": "Välj en aktivitet. Arbetsytan förblir fokuserad på den."
  ,"languages11.practice.focused": "En aktivitet i taget, med din nivå och ditt mål bevarade."
  ,"languages11.practice.conversation": "Samtal"
  ,"languages11.practice.vocabulary": "Ordförråd"
  ,"languages11.practice.grammar": "Grammatik"
  ,"languages11.practice.conjugation": "Böjning"
  ,"languages11.practice.comprehension": "Förståelse"
  ,"languages11.practice.reading": "Läsning"
  ,"languages11.practice.writing": "Skrivande"
  ,"languages11.practice.pronunciation": "Uttal"
  ,"languages11.practice.oral": "Muntligt"
  ,"languages11.practice.quiz": "Quiz"
  ,"languages11.conversation.detail": "Samma AI-professor anpassar andelen målspråk och rättelserna till den här sessionen."
  ,"languages11.conversation.start": "Starta samtal"
  ,"languages11.oral.detail": "Tala med samma professor. Din transkribering förblir synlig och redigerbar innan den skickas."
  ,"languages11.oral.start": "Starta muntlig övning"
  ,"languages11.scenario.label": "Scenario"
  ,"languages11.scenario.placeholder": "På apoteket, anställningsintervju, vardagsliv…"
  ,"languages11.immersion.title": "Språkbad"
  ,"languages11.immersion.guided": "Vägledd"
  ,"languages11.immersion.mixed": "Blandad"
  ,"languages11.immersion.full": "Fullständig"
  ,"languages11.correction.title": "Rättelser"
  ,"languages11.correction.light": "Lätta"
  ,"languages11.correction.balanced": "Balanserade"
  ,"languages11.correction.detailed": "Detaljerade"
  ,"languages11.generate": "Skapa övning"
  ,"languages11.quiz.detail": "Repetera ordförråd som förfaller med den befintliga FSRS-motorn för minnet."
  ,"languages11.quiz.action": "Öppna språkrepetition"
  ,"languages11.review.return": "Tillbaka till språket"
  ,"languages11.reading.history": "Öppna läshistorik"
  ,"languages11.writing.workspace": "Öppna hela skrivarbetsytan"
  ,"languages11.writing.instruction": "Skriv på {language}."
  ,"languages11.offline.title": "Röst och AI är inte tillgängliga offline"
  ,"languages11.offline.detail": "Ditt lokala utkast har bevarats. Anslut igen innan du transkriberar eller frågar professorn."
  ,"rlle.ui.hub.learn": "Lär dig {language}"
  ,"rlle.ui.hub.resume": "Fortsätt min kurs i {language}"
  ,"rlle.ui.hub.courseDetail": "En strukturerad, adaptiv CEFR-kurs byggd kring det du behöver göra i verkliga livet."
  ,"rlle.ui.hub.openCourse": "Öppna min kurs"
  ,"rlle.ui.hub.courseUnavailable": "Kurstjänsten är inte tillgänglig ännu. Dina övningsverktyg är fortfarande tillgängliga."
  ,"rlle.ui.course.eyebrow": "SPRÅKMOTOR FÖR VERKLIGA LIVET"
  ,"rlle.ui.course.title": "Kurs i {language}"
  ,"rlle.ui.course.subtitle": "Lär dig stegvis och visa sedan vad du kan göra i verkliga situationer."
  ,"rlle.ui.course.loading": "Läser in din kurs…"
  ,"rlle.ui.course.notStarted": "Bygg min kurs"
  ,"rlle.ui.course.notStartedDetail": "Välj var du vill börja och ditt mål i verkliga livet. De grundläggande byggstenarna tas aldrig bort."
  ,"rlle.ui.course.startZero": "Börja från noll"
  ,"rlle.ui.course.startDeclared": "Börja på min angivna nivå"
  ,"rlle.ui.course.declaredWarning": "{level} är en angiven nivå, inte ett utvärderat resultat."
  ,"rlle.ui.course.targetLevel": "Målnivå"
  ,"rlle.ui.course.goalDomain": "Prioritet i verkliga livet"
  ,"rlle.ui.course.goal.general": "Allmänt"
  ,"rlle.ui.course.goal.travel": "Resor"
  ,"rlle.ui.course.goal.work": "Arbete"
  ,"rlle.ui.course.goal.studies": "Studier"
  ,"rlle.ui.course.goal.social": "Socialt liv"
  ,"rlle.ui.course.start": "Starta min kurs"
  ,"rlle.ui.course.resume": "Fortsätt min kurs"
  ,"rlle.ui.course.pause": "Pausa kursen"
  ,"rlle.ui.course.current": "Fortsätt den aktuella lektionen"
  ,"rlle.ui.course.curriculum": "Inlärningsväg enligt CEFR"
  ,"rlle.ui.course.curriculumDetail": "Målenheter prioriteras samtidigt som hela inlärningsstommen bevaras."
  ,"rlle.ui.course.goalPriority": "Ditt mål"
  ,"rlle.ui.course.core": "Grund"
  ,"rlle.ui.course.unit.open": "Öppna enhet"
  ,"rlle.ui.course.status.locked": "Låst"
  ,"rlle.ui.course.status.available": "Tillgänglig"
  ,"rlle.ui.course.status.in-progress": "Pågår"
  ,"rlle.ui.course.status.completed": "Slutförd"
  ,"rlle.ui.course.status.untracked": "Inte påbörjad"
  ,"rlle.ui.course.progress": "Uppmätta framsteg"
  ,"rlle.ui.course.progressUnits": "{done} av {total} enheter slutförda"
  ,"rlle.ui.course.progressUnknown": "Inga uppmätta kursframsteg ännu."
  ,"rlle.ui.course.lastActivity": "Senaste aktivitet: {date}"
  ,"rlle.ui.course.noActivity": "Ingen kursaktivitet ännu"
  ,"rlle.ui.course.levels": "CEFR-nivåer"
  ,"rlle.ui.course.level.declared": "Angiven"
  ,"rlle.ui.course.level.estimated": "Uppskattad"
  ,"rlle.ui.course.level.evaluated": "Utvärderad"
  ,"rlle.ui.course.level.target": "Mål"
  ,"rlle.ui.course.notEvaluated": "Inte utvärderad"
  ,"rlle.ui.course.dimensions": "Färdigheter uppmätta genom belägg"
  ,"rlle.ui.course.evidenceCount": "{count} belägg"
  ,"rlle.ui.course.review": "Repetera det här språket"
  ,"rlle.ui.course.brain": "Se språkkunskap i Min hjärna"
  ,"rlle.ui.course.professor": "Fråga professorn"
  ,"rlle.ui.course.offline": "Det senaste kurstillståndet kunde inte uppdateras."
  ,"rlle.ui.course.preferences.title": "Kursinställningar"
  ,"rlle.ui.course.preferences.detail": "Anpassa språkbad och rättelsernas intensitet utan att förlora dina framsteg."
  ,"rlle.ui.course.preferences.save": "Spara inställningar"
  ,"rlle.ui.course.preferences.saved": "Kursinställningarna har sparats."
  ,"rlle.ui.course.preferences.error": "Inställningarna kunde inte sparas."
  ,"rlle.ui.review.returnCourse": "Tillbaka till min kurs"
  ,"rlle.ui.brain.evidenceTitle": "Uppmätta språkförmågor"
  ,"rlle.ui.brain.evidenceDetail": "Här visas endast observerade belägg från den här språkkursen."
  ,"rlle.ui.brain.backCourse": "Öppna språkkursen"
  ,"rlle.ui.lesson.eyebrow": "STRUKTURERAD LEKTION"
  ,"rlle.ui.lesson.title": "Lektion"
  ,"rlle.ui.lesson.intro": "Kommunikativt mål"
  ,"rlle.ui.lesson.start": "Starta den här lektionen"
  ,"rlle.ui.lesson.resume": "Fortsätt den här lektionen"
  ,"rlle.ui.lesson.complete": "Avsluta lektionen"
  ,"rlle.ui.lesson.completeStage": "Slutför det här steget"
  ,"rlle.ui.lesson.completed": "Lektionen är slutförd. Funktionella förmågor kräver fortfarande verkliga belägg."
  ,"rlle.ui.lesson.openGenerated": "Öppna lektionsinnehållet"
  ,"rlle.ui.lesson.path": "Lektionsföljd"
  ,"rlle.ui.lesson.stageAction": "Öva det här steget"
  ,"rlle.ui.lesson.noActive": "Den här enheten har ännu ingen aktiv lektion."
  ,"rlle.ui.lesson.proofNote": "Att slutföra en lektion validerar aldrig på egen hand ett Kan-göra-mål."
  ,"rlle.ui.mission.eyebrow": "UPPDRAG I VÄRLDEN"
  ,"rlle.ui.mission.title": "Uppdrag i verkliga livet"
  ,"rlle.ui.mission.subtitle": "Utför en kommunikativ uppgift med professorn. Framgång kräver observerade belägg, inte ett quizresultat."
  ,"rlle.ui.mission.start": "Starta uppdrag"
  ,"rlle.ui.mission.resume": "Fortsätt uppdrag"
  ,"rlle.ui.mission.minimum": "Från {level}"
  ,"rlle.ui.mission.survival": "Överlevnadsfärdigheter i kommunikation"
  ,"rlle.ui.mission.notAvailable": "Uppdragsspårning är ännu inte tillgänglig från servern."
  ,"rlle.ui.mission.dynamic": "Professorn reagerar på dina verkliga svar och kontrollerar om uppgiften har utförts."
  ,"rlle.ui.mission.all": "Alla"
  ,"rlle.ui.cando.eyebrow": "KAN-GÖRA-KARTA"
  ,"rlle.ui.cando.title": "Det jag verkligen kan göra"
  ,"rlle.ui.cando.subtitle": "En förmåga valideras endast genom ett lyckat uppdrag, en bedömning eller en kontrollerad aktivitet."
  ,"rlle.ui.cando.open": "Öppna min Kan-göra-karta"
  ,"rlle.ui.cando.status.not-evaluated": "Inte utvärderad"
  ,"rlle.ui.cando.status.in-progress": "Belägg samlas in"
  ,"rlle.ui.cando.status.validated": "Visad"
  ,"rlle.ui.cando.evidence": "Belägg"
  ,"rlle.ui.cando.noEvidence": "Inga observerade belägg ännu."
  ,"rlle.ui.cando.source.mission": "Uppdrag i världen"
  ,"rlle.ui.cando.source.assessment": "Bedömning"
  ,"rlle.ui.cando.source.controlled-activity": "Kontrollerad aktivitet"
  ,"rlle.ui.recovery.title": "Riktad återhämtning"
  ,"rlle.ui.recovery.subtitle": "Endast svårigheter som faktiskt har observerats under aktiviteter visas här."
  ,"rlle.ui.recovery.empty": "Ingen bekräftad svårighet att åtgärda."
  ,"rlle.ui.recovery.gaps": "Funktionella luckor"
  ,"rlle.ui.recovery.mistakes": "Misstagsminne"
  ,"rlle.ui.recovery.repair": "Åtgärdsslinga"
  ,"rlle.ui.recovery.occurrences": "{count} observerade förekomster"
  ,"rlle.ui.recovery.next": "Aktuellt åtgärdssteg: {stage}"
  ,"rlle.ui.common.retry": "Försök igen"
  ,"rlle.ui.common.backCourse": "Tillbaka till kursen"
  ,"rlle.ui.common.error": "Kursen kunde inte läsas in."
  ,"rlle.ui.category.travel": "Resor"
  ,"rlle.ui.category.work": "Arbete"
  ,"rlle.ui.category.studies": "Studier"
  ,"rlle.ui.category.social": "Socialt liv"
  ,"rlle.ui.dimension.vocabulary": "Ordförråd"
  ,"rlle.ui.dimension.grammar": "Grammatik"
  ,"rlle.ui.dimension.conversation": "Samtal"
  ,"rlle.ui.dimension.listening": "Hörförståelse"
  ,"rlle.ui.dimension.reading": "Läsning"
  ,"rlle.ui.dimension.writing": "Skrivande"
  ,"rlle.ui.dimension.interaction": "Interaktion"
  ,"rlle.ui.dimension.pronunciation": "Uttal"
  ,"rlle.ui.dimension.mediation": "Mediering"
  ,"rlle.ui.dimension.status.not-evaluated": "Inte utvärderad"
  ,"rlle.ui.dimension.status.emerging": "På väg"
  ,"rlle.ui.dimension.status.demonstrated": "Visad"
  ,"rlle.ui.dimension.status.consistent": "Konsekvent"
  ,"rlle.ui.strand.vocabulary": "Ordförråd"
  ,"rlle.ui.strand.verbs": "Verb"
  ,"rlle.ui.strand.conjugation": "Böjning"
  ,"rlle.ui.strand.grammar": "Grammatik"
  ,"rlle.ui.strand.listening": "Hörförståelse"
  ,"rlle.ui.strand.reading": "Läsning"
  ,"rlle.ui.strand.conversation": "Samtal"
  ,"rlle.ui.strand.interaction": "Interaktion"
  ,"rlle.ui.strand.pronunciation": "Uttal"
  ,"rlle.ui.strand.writing": "Skrivande"
  ,"rlle.ui.strand.mediation": "Mediering"
  ,"rlle.ui.stage.communicative-objective": "Kommunikativt mål"
  ,"rlle.ui.stage.vocabulary": "Ordförråd i sitt sammanhang"
  ,"rlle.ui.stage.grammar-verbs": "Grammatik och verb"
  ,"rlle.ui.stage.example": "Modellexempel"
  ,"rlle.ui.stage.comprehension": "Förståelse"
  ,"rlle.ui.stage.practice": "Vägledd övning"
  ,"rlle.ui.stage.oral": "Tala först"
  ,"rlle.ui.stage.writing": "Skrivande"
  ,"rlle.ui.stage.verification": "Kontroll"
  ,"rlle.ui.stage.review": "Minnesrepetition"
  ,"rlle.ui.stage.status.pending": "Att göra"
  ,"rlle.ui.stage.status.active": "Nu"
  ,"rlle.ui.stage.status.completed": "Klart"
  ,"rlle.ui.stage.status.skipped": "Behövs inte"
  ,"rlle.ui.repair.explain": "Förklaring"
  ,"rlle.ui.repair.guided-practice": "Vägledd övning"
  ,"rlle.ui.repair.retry-now": "Försök igen nu"
  ,"rlle.ui.repair.reuse-later": "Återanvänd senare"
  ,"rlle.ui.repair.consolidate": "Befäst i Repetera"
  ,"rlle.ui.survival.ask-repeat": "Be någon upprepa"
  ,"rlle.ui.survival.ask-slow-down": "Be någon tala långsammare"
  ,"rlle.ui.survival.ask-definition": "Be om en definition"
  ,"rlle.ui.survival.rephrase": "Formulera om"
  ,"rlle.ui.survival.check-understanding": "Kontrollera förståelsen"
  ,"rlle.ui.survival.explain-unknown-word": "Förklara ett okänt ord"
  ,"rlle.ui.survival.buy-thinking-time": "Skaffa tid att tänka innan du svarar"
  ,"rlle.unit.a1FirstContact": "Första kontakten"
  ,"rlle.objective.a1FirstContact": "Presentera dig och utbyt grundläggande personuppgifter."
  ,"rlle.unit.a1DailyNeeds": "Vardagliga behov"
  ,"rlle.objective.a1DailyNeeds": "Hantera enkla vardagsbehov med användbara ord och grundläggande former."
  ,"rlle.unit.a1Survival": "Överlevnadspaket för kommunikation"
  ,"rlle.objective.a1Survival": "Håll igång ett utbyte även när du inte förstår allt."
  ,"rlle.unit.a2Routines": "Rutiner och planer"
  ,"rlle.objective.a2Routines": "Beskriv vanor, aktiviteter och enkla framtidsplaner."
  ,"rlle.unit.a2PastPlans": "Tidigare erfarenheter"
  ,"rlle.objective.a2PastPlans": "Berätta en enkel historia och koppla samman händelser i det förflutna."
  ,"rlle.unit.a2TravelStudy": "Grunder för resor och studier"
  ,"rlle.objective.a2TravelStudy": "Hitta information och utför vanliga uppgifter under resor eller studier."
  ,"rlle.unit.b1Experiences": "Berätta din historia"
  ,"rlle.objective.b1Experiences": "Beskriv erfarenheter med tydlig kronologi och relevanta detaljer."
  ,"rlle.unit.b1WorkTravel": "Agera självständigt"
  ,"rlle.objective.b1WorkTravel": "Hantera vanliga arbets- och resesituationer utan manus."
  ,"rlle.unit.b1Opinions": "Förklara en åsikt"
  ,"rlle.objective.b1Opinions": "Förstå en ståndpunkt och försvara din egen med argument."
  ,"rlle.unit.b2Collaboration": "Samarbeta obehindrat"
  ,"rlle.objective.b2Collaboration": "Delta aktivt i möten, diskussioner och presentationer."
  ,"rlle.unit.b2Argument": "Bygg ett argument"
  ,"rlle.objective.b2Argument": "Jämför ståndpunkter, nyansera påståenden och strukturera ett övertygande svar."
  ,"rlle.unit.b2Professional": "Professionell produktion"
  ,"rlle.objective.b2Professional": "Skriv och tala med det register som förväntas i professionella sammanhang."
  ,"rlle.unit.c1ComplexInput": "Förstå komplext material"
  ,"rlle.objective.c1ComplexInput": "Extrahera, koppla samman och omformulera idéer från krävande material."
  ,"rlle.unit.c1Influence": "Påverka och förhandla"
  ,"rlle.objective.c1Influence": "Anpassa språket exakt för att övertyga, samarbeta och lösa meningsskiljaktigheter."
  ,"rlle.unit.c1Production": "Producera med precision"
  ,"rlle.objective.c1Production": "Skapa tydliga, nyanserade arbeten för akademiska och professionella målgrupper."
  ,"rlle.unit.c2Nuance": "Nyanser och underförstådd betydelse"
  ,"rlle.objective.c2Nuance": "Förstå subtila skillnader, register och underförstådd betydelse."
  ,"rlle.unit.c2Adaptation": "Anpassa i realtid"
  ,"rlle.objective.c2Adaptation": "Mediera och omformulera naturligt för olika målgrupper och situationer."
  ,"rlle.unit.c2Mastery": "Integrerad behärskning"
  ,"rlle.objective.c2Mastery": "Kombinera alla färdigheter med precision, flexibilitet och kommunikativ kontroll."
  ,"rlle.mission.travelAirport": "Hitta rätt på flygplatsen"
  ,"rlle.missionObjective.travelAirport": "Förstå instruktioner och ta dig till rätt gate."
  ,"rlle.mission.travelHotel": "Lös ett problem på hotellet"
  ,"rlle.missionObjective.travelHotel": "Förklara ett problem och enas om en praktisk lösning."
  ,"rlle.mission.travelRestaurant": "Beställ på restaurang"
  ,"rlle.missionObjective.travelRestaurant": "Fråga om menyn och gör en lämplig beställning."
  ,"rlle.mission.travelTransport": "Använd lokaltrafik"
  ,"rlle.missionObjective.travelTransport": "Fråga efter en färdväg, förstå alternativen och bekräfta din destination."
  ,"rlle.mission.travelDirections": "Fråga efter vägen"
  ,"rlle.missionObjective.travelDirections": "Fråga vart du ska gå och kontrollera att du har förstått."
  ,"rlle.mission.travelEmergency": "Hantera en nödsituation"
  ,"rlle.missionObjective.travelEmergency": "Beskriv ett akut problem och förstå nästa instruktion."
  ,"rlle.mission.workInterview": "Genomför en anställningsintervju"
  ,"rlle.missionObjective.workInterview": "Presentera din erfarenhet och besvara följdfrågor naturligt."
  ,"rlle.mission.workMeeting": "Delta i ett möte"
  ,"rlle.missionObjective.workMeeting": "Följ diskussionen, bidra med en idé och förtydliga en åtgärd."
  ,"rlle.mission.workPresentation": "Presentera ett projekt"
  ,"rlle.missionObjective.workPresentation": "Förklara ett projekt tydligt och besvara frågor."
  ,"rlle.mission.workEmail": "Skriv ett professionellt mejl"
  ,"rlle.missionObjective.workEmail": "Skriv ett kortfattat meddelande med lämplig ton och begäran."
  ,"rlle.mission.workNegotiation": "Förhandla fram en överenskommelse"
  ,"rlle.missionObjective.workNegotiation": "Ange prioriteringar, bemöt invändningar och nå en kompromiss."
  ,"rlle.mission.studiesLecture": "Följ en föreläsning"
  ,"rlle.missionObjective.studiesLecture": "Identifiera huvudidéer och förklara dem enklare."
  ,"rlle.mission.studiesSynthesis": "Sammanställ komplexa källor"
  ,"rlle.missionObjective.studiesSynthesis": "Koppla samman krävande muntligt och skriftligt material och förmedla det sedan korrekt."
  ,"rlle.mission.studiesPresentation": "Håll en akademisk presentation"
  ,"rlle.missionObjective.studiesPresentation": "Strukturera en förklaring och besvara åhörarnas frågor."
  ,"rlle.mission.studiesDiscussion": "Delta i en klassdiskussion"
  ,"rlle.missionObjective.studiesDiscussion": "Bygg vidare på en annan idé och motivera ditt bidrag."
  ,"rlle.mission.studiesTeacher": "Prata med en lärare"
  ,"rlle.missionObjective.studiesTeacher": "Be om ett förtydligande och bekräfta vad som förväntas."
  ,"rlle.mission.studiesAdministration": "Hantera administration"
  ,"rlle.missionObjective.studiesAdministration": "Förstå en process och be om informationen du behöver."
  ,"rlle.mission.socialIntroduction": "Presentera dig"
  ,"rlle.missionObjective.socialIntroduction": "Inled ett vänligt utbyte och dela grundläggande information."
  ,"rlle.mission.socialChat": "Håll igång ett samtal"
  ,"rlle.missionObjective.socialChat": "Reagera, ställ en följdfråga och reda ut missförstånd."
  ,"rlle.mission.socialStory": "Berätta en historia"
  ,"rlle.missionObjective.socialStory": "Återge händelser i tydlig ordning och behåll lyssnarens intresse."
  ,"rlle.mission.socialInvitation": "Bjud in någon"
  ,"rlle.missionObjective.socialInvitation": "Föreslå en plan, diskutera detaljer och svara artigt."
  ,"rlle.mission.socialDebate": "Debattera en idé"
  ,"rlle.missionObjective.socialDebate": "Försvara en ståndpunkt samtidigt som du bemöter ett annat perspektiv."
  ,"rlle.canDo.travelOrder": "Beställa på restaurang"
  ,"rlle.canDo.travelDirections": "Fråga efter och förstå vägbeskrivningar"
  ,"rlle.canDo.travelHotelProblem": "Förklara ett problem på ett hotell"
  ,"rlle.canDo.travelTransport": "Planera en resa med lokaltrafik"
  ,"rlle.canDo.travelEmergency": "Förklara ett akut problem"
  ,"rlle.canDo.workInterview": "Presentera mig under en anställningsintervju"
  ,"rlle.canDo.workMeeting": "Delta i ett möte"
  ,"rlle.canDo.workPresent": "Presentera ett projekt"
  ,"rlle.canDo.workEmail": "Skriva ett professionellt mejl"
  ,"rlle.canDo.workNegotiate": "Förhandla fram en överenskommelse"
  ,"rlle.canDo.studiesRequest": "Be om akademisk eller administrativ hjälp"
  ,"rlle.canDo.studiesFollowLecture": "Följa en föreläsning och identifiera dess huvudidéer"
  ,"rlle.canDo.studiesDiscuss": "Delta i en klassdiskussion"
  ,"rlle.canDo.studiesPresent": "Hålla en akademisk presentation"
  ,"rlle.canDo.studiesSynthesise": "Sammanfatta och förklara komplex information"
  ,"rlle.canDo.socialIntroduce": "Presentera mig naturligt"
  ,"rlle.canDo.socialClarify": "Reda ut ett missförstånd"
  ,"rlle.canDo.socialInvite": "Bjuda in någon och planera något"
  ,"rlle.canDo.socialTellStory": "Berätta om en tidigare erfarenhet"
  ,"rlle.canDo.socialDefendOpinion": "Försvara en åsikt med argument"
  ,"rlle.demo.objectiveInternationalWork": "Arbeta internationellt"
  ,"rlle.ui.badge": "STRUKTURERAD KURS"
  ,"rlle.ui.cefr": "CEFR"
  ,"rlle.ui.nba.badge": "NÄSTA SPRÅKÅTGÄRD"
  ,"rlle.ui.nba.review": "Repetera {count} språkobjekt som förfaller"
  ,"rlle.ui.nba.reviewReason": "{count} verkliga FSRS-objekt förfaller nu."
  ,"rlle.ui.nba.reviewAction": "Repetera nu"
  ,"rlle.ui.nba.retryMission": "Försök med den verkliga uppgiften igen"
  ,"rlle.ui.nba.retryMissionReason": "En observerad svårighet har en mikrolektion och är redo för ett nytt försök."
  ,"rlle.ui.nba.resumeMission": "Fortsätt uppdraget i världen"
  ,"rlle.ui.nba.resumeMissionReason": "Det här uppdraget i verkliga livet är fortfarande aktivt."
  ,"rlle.ui.nba.resumeLesson": "Fortsätt språklektionen"
  ,"rlle.ui.nba.resumeLessonReason": "Ett steg i en strukturerad lektion är fortfarande aktivt."
  ,"rlle.ui.nba.nextLesson": "Fortsätt den strukturerade kursen"
  ,"rlle.ui.nba.nextLessonReason": "Detta är nästa ofullständiga enhet i CEFR-kursplanen."
  ,"rlle.ui.nba.nextLessonAction": "Starta nästa lektion"
  ,"rlle.ui.course.status.paused": "Pausad"
  ,"rlle.ui.course.status.not-started": "Inte påbörjad"
  ,"rlle.ui.mission.category": "Uppdragskategori"
  ,"rlle.ui.mission.modality": "Övningsläge"
  ,"rlle.ui.mission.current": "Uppdrag pågår"
  ,"rlle.ui.mission.starting": "Startar uppdraget…"
  ,"rlle.ui.mission.status.active": "Pågår"
  ,"rlle.ui.mission.status.paused": "Pausat"
  ,"rlle.ui.mission.status.succeeded": "Lyckades"
  ,"rlle.ui.mission.status.needs-retry": "Försök igen"
  ,"rlle.ui.mission.feedback.succeeded": "Uppdraget slutfördes med observerade belägg."
  ,"rlle.ui.mission.feedback.repair": "En specifik svårighet upptäcktes. Använd mikrolektionen och försök sedan igen."
  ,"rlle.ui.mission.feedback.proof": "KOMMUNIKATIVT BELÄGG"
  ,"rlle.ui.mission.feedback.microLesson": "MIKROLEKTION"
  ,"rlle.ui.mission.feedback.example": "Exempel"
  ,"rlle.ui.modality.text": "Skriv"
  ,"rlle.ui.modality.voice": "Tala"
  ,"rlle.ui.modality.mixed": "Skriv och tala"
  ,"rlle.ui.cando.notAvailable": "Kan-göra-kartan är ännu inte tillgänglig från servern."
  ,"rlle.ui.cando.all": "Alla förmågor"
  ,"rlle.ui.cando.summary": "Endast observerade belägg kan validera en förmåga."
  ,"rlle.ui.cando.validatedCount": "Visade: {count}"
  ,"rlle.ui.cando.measuredCount": "Bedömda: {count}"
  ,"rlle.ui.gap.status.observed": "Observerad en gång"
  ,"rlle.ui.gap.status.repeated": "Observerad igen"
  ,"rlle.ui.gap.status.confirmed": "Bekräftad"
  ,"rlle.ui.gap.status.repairing": "Åtgärdas"
  ,"rlle.ui.gap.status.consolidated": "Befäst"
  ,"rlle.ui.dimension.conjugation": "Böjning"
  ,"rlle.ui.dimension.fluency": "Flyt"
  ,"rlle.ui.dimension.formulation": "Formulering"
  ,"tutor6.state.paused": "Inspelningen är pausad"
  ,"scan.openDocument": "Öppna Dokumentintelligens"
  ,"scan.captured": "Sidorna har sparats säkert"
  ,"scan.capturedDetail": "Bilderna har bevarats. Textanalys blir tillgänglig när en godkänd leverantör för bildanalys är aktiv."
  ,"sub.usageAction": "Visa användning och kvoter"
  ,"sub.availablePlans": "Individuella abonnemang"
  ,"sub.availablePlansDetail": "Jämför de gränser som för närvarande är konfigurerade för varje tillgängligt erbjudande."
  ,"sub.notAvailable": "Inte tillgängligt just nu"
  ,"sub.periodEnd": "Nuvarande period slutar"
  ,"sub.trialEnds": "Provperioden slutar"
  ,"sub.openInvoice": "Öppna faktura"
  ,"sub.upgrade": "Uppgradera till"
  ,"sub.partial": "Vissa faktureringsuppgifter är tillfälligt otillgängliga. Inget befintligt abonnemang har ändrats."
  ,"usage.loading": "Läser in din användning…"
  ,"usage.remaining": "Återstår"
  ,"usage.reset": "Återställs"
  ,"usage.mb": "MB"
  ,"usage.kb": "KB"
  ,"usage.managePlan": "Hantera abonnemang"
  ,"usage.currentPlan": "Nuvarande abonnemang"
  ,"usage.planUnavailable": "Abonnemangsinformationen är tillfälligt otillgänglig."
  ,"usage.limitReached": "En abonnemangsgräns har nåtts"
  ,"usage.limitResetKnown": "Den här räknaren blir tillgänglig igen den {date}."
  ,"usage.limitNoReset": "Den här gränsen speglar aktuell användning. Frigör kapacitet eller byt abonnemang för att fortsätta med åtgärden."
  ,"usage.nonAiAvailable": "Resten av Second Brain är fortfarande tillgängligt, inklusive funktioner som inte förbrukar den här kvoten."
  ,"usage.partial": "Vissa uppgifter om abonnemang eller användning kunde inte uppdateras. Värdena som visas är de senast tillgängliga."
  ,"priv.controls": "Relaterade inställningar"
  ,"priv.memory": "AI-minne"
  ,"priv.memoryHelp": "Granska vad Second Brain minns och inställningarna som är kopplade till minnet."
  ,"priv.documents": "Dokument och källor"
  ,"priv.documentsHelp": "Granska källorna som du har importerat till ditt bibliotek."
  ,"landing.nav.menu": "Meny"
  ,"landing12.seo.title": "Second Brain – ditt personliga intelligenta inlärningssystem"
  ,"landing12.seo.description": "Lär dig, förstå, öva, minns och skapa med ett sammanhängande inlärningssystem: dina dokument, din AI-professor, din kognitiva tvilling, repetition, undersökning, språk och arbetsyta."
  ,"landing12.brand": "Second Brain"
  ,"landing12.signature": "En produkt. En upplevelse."
  ,"landing12.nav.product": "Produkt"
  ,"landing12.nav.how": "Så fungerar det"
  ,"landing12.nav.languages": "Språk"
  ,"landing12.nav.pricing": "Priser"
  ,"landing12.nav.download": "Ladda ned"
  ,"landing12.nav.faq": "FAQ"
  ,"landing12.nav.contact": "Kontakt"
  ,"landing12.nav.menu": "Öppna navigeringen"
  ,"landing12.nav.close": "Stäng navigeringen"
  ,"landing12.cta.signin": "Logga in"
  ,"landing12.cta.start": "Börja gratis"
  ,"landing12.cta.startShort": "Börja"
  ,"landing12.cta.how": "Se hur det fungerar"
  ,"landing12.cta.download": "Ladda ned Second Brain"
  ,"landing12.cta.language": "Lär dig ett språk"
  ,"landing12.cta.next": "Nästa steg"
  ,"landing12.cta.restart": "Spela upp resan igen"
  ,"landing12.demo.label": "Produktdemonstration"
  ,"landing12.demo.disclaimer": "Statiskt offentligt exempel. Inga verkliga användardata och ingen simulerad bearbetning."
  ,"landing12.hero.eyebrow": "Ett personligt intelligent inlärningssystem"
  ,"landing12.hero.title": "Lär dig. Förstå. Öva. Minns. Gör framsteg."
  ,"landing12.hero.subtitle": "Ge Second Brain en fråga, ett dokument eller ett mål. Systemet bygger sammanhanget, undervisar dig, hjälper dig öva, befäster det viktiga och föreslår vad du ska göra härnäst."
  ,"landing12.hero.availability": "Tillgängligt på webben · mobil- och datorappar förbereds"
  ,"landing12.hero.scene.product": "SECOND BRAIN · ETT SAMMANHANG"
  ,"landing12.hero.scene.tabsLabel": "Steg i produktdemonstrationen"
  ,"landing12.hero.scene.question.tab": "Avsikt"
  ,"landing12.hero.scene.context.tab": "Sammanhang"
  ,"landing12.hero.scene.teaching.tab": "Upplevelse"
  ,"landing12.hero.scene.next.tab": "Nästa åtgärd"
  ,"landing12.hero.scene.question.title": "Vad vill du förstå?"
  ,"landing12.hero.scene.question.message": "Hjälp mig förstå cellandningen inför min tenta."
  ,"landing12.hero.scene.question.intent": "Förstå"
  ,"landing12.hero.scene.question.source": "Biologikurs.pdf"
  ,"landing12.hero.scene.context.title": "Second Brain samlar det användbara sammanhanget"
  ,"landing12.hero.scene.context.brain": "Min hjärna"
  ,"landing12.hero.scene.context.document": "Biologikurs.pdf"
  ,"landing12.hero.scene.context.goal": "Tentamensmål"
  ,"landing12.hero.scene.context.concept": "Cellandning"
  ,"landing12.hero.scene.context.fragile": "Begrepp att befästa"
  ,"landing12.hero.scene.teaching.title": "AI-professor"
  ,"landing12.hero.scene.teaching.message": "Låt oss koppla samman glukos, syre och ATP och sedan kontrollera förståelsen med en fråga."
  ,"landing12.hero.scene.teaching.explain": "Förklaring"
  ,"landing12.hero.scene.teaching.practice": "Övning"
  ,"landing12.hero.scene.teaching.voice": "Röst"
  ,"landing12.hero.scene.next.title": "Bästa nästa åtgärd"
  ,"landing12.hero.scene.next.action": "Befäst cellandning"
  ,"landing12.hero.scene.next.reason": "Föreslås eftersom begreppet är kopplat till ditt tentamensmål och fortfarande behöver övas."
  ,"landing12.hero.scene.next.context": "Orsaken visas · destinationen bevaras"
  ,"landing12.story.kicker": "En produkt, en upplevelse"
  ,"landing12.story.title": "Se kunskap röra sig genom hela systemet"
  ,"landing12.story.lead": "En källa stannar inte vid lagring. Den här demonstrationen följer samma sammanhang från ett dokument till förståelse, övning, repetition och akademisk produktion."
  ,"landing12.story.documents.title": "Ett dokument blir användbar kunskap"
  ,"landing12.story.documents.short": "Dokument"
  ,"landing12.story.documents.desc": "Biblioteket tar emot källan. Dokumentintelligens läser den, extraherar begrepp och förbereder källgrundade frågor utan att hitta på framsteg."
  ,"landing12.story.brain.title": "Begrepp fogas in i en sammanhängande kognitiv karta"
  ,"landing12.story.brain.short": "Min hjärna"
  ,"landing12.story.brain.desc": "Den kognitiva tvillingen synliggör begrepp, relationer, styrkor och bräckligheter. Det här offentliga exemplet är illustrativt, inte en verklig elevs poäng."
  ,"landing12.story.professor.title": "Professorn undervisar utifrån samma sammanhang"
  ,"landing12.story.professor.short": "AI-professor"
  ,"landing12.story.professor.desc": "Dokumentet, målbegreppet och inlärningsmålet följer med sessionen. Upplevelsen kan bli en förklaring, lektion, fråga eller vägledd övning."
  ,"landing12.story.oral.title": "Förståelse blir muntlig övning"
  ,"landing12.story.oral.short": "Muntligt och röst"
  ,"landing12.story.oral.desc": "Lyssnande, transkribering och svar är tydliga, läsbara tillstånd. Transkriberingen förblir synlig. Ingen dekorativ vågform låtsas mäta tal."
  ,"landing12.story.review.title": "En bräcklig idé blir en repetition"
  ,"landing12.story.review.short": "Repetition"
  ,"landing12.story.review.desc": "Repetitionsmotorn befäster kunskap vid rätt tidpunkt. Datumet som visas här är uttryckligen en demonstration, inte ett verkligt schema."
  ,"landing12.story.workspace.title": "Kunskap blir en produktion"
  ,"landing12.story.workspace.short": "Arbetsyta"
  ,"landing12.story.workspace.desc": "Akademisk arbetsyta håller samman plan, text, källor och hänvisningar medan den kontextuella assistenten stödjer elevens eget arbete."
  ,"landing12.story.sharedContext": "Gemensamt sammanhang"
  ,"landing12.story.traceability": "Spårbara källor"
  ,"landing12.story.outcome": "Jag ger information → Second Brain förstår den → undervisar mig → hjälper mig öva → hjälper mig minnas → hjälper mig använda den."
  ,"landing12.story.nba": "Sedan föreslår systemet en tydlig, förklarbar nästa åtgärd i stället för att lämna mig i en instrumentpanel."
  ,"landing12.story.file": "Biologikurs.pdf"
  ,"landing12.story.fileType": "Demonstrationsdokument · PDF"
  ,"landing12.story.readyDemo": "Exemplet är klart"
  ,"landing12.story.pipeline.import": "Källan importerad"
  ,"landing12.story.pipeline.read": "Läsbart innehåll identifierat"
  ,"landing12.story.pipeline.concepts": "Begrepp extraherade"
  ,"landing12.story.pipeline.connect": "Kopplingar förberedda"
  ,"landing12.story.concept.respiration": "Cellandning"
  ,"landing12.story.concept.toConsolidate": "Att befästa"
  ,"landing12.story.concept.photosynthesis": "Fotosyntes"
  ,"landing12.story.concept.chlorophyll": "Klorofyll"
  ,"landing12.story.concept.atp": "ATP"
  ,"landing12.story.brain.note": "Kartan visar relationer och inlärningstillstånd endast när produkten har verkliga belägg."
  ,"landing12.story.context.brain": "Min hjärna"
  ,"landing12.story.context.document": "Biologikurs.pdf"
  ,"landing12.story.context.goal": "Tentamensmål"
  ,"landing12.story.professor.question": "Varför känns det här begreppet fortfarande svårt?"
  ,"landing12.story.professor.answer": "Låt oss bygga upp det igen från ATP: först syftet, sedan stegen och därefter en kort kontroll med dina egna ord."
  ,"landing12.story.professor.session": "Upplevelsesessionen håller ihop källan, avsikten, historiken och nästa åtgärd."
  ,"landing12.story.oral.listen": "Lyssnar"
  ,"landing12.story.oral.transcript": "Transkribering"
  ,"landing12.story.oral.answer": "Svar"
  ,"landing12.story.oral.visibleTranscript": "Synlig transkribering"
  ,"landing12.story.oral.transcriptText": "”Cellandningen omvandlar energin i glukos till ATP som cellen kan använda.”"
  ,"landing12.story.oral.note": "Röst kompletterar den skriftliga upplevelsen. En misslyckad ljudtjänst tar aldrig bort det läsbara innehållet."
  ,"landing12.story.review.cardLabel": "Begreppsrepetition"
  ,"landing12.story.review.question": "Förklara ATP:s roll utan att titta på källan."
  ,"landing12.story.review.tomorrow": "Exempel: repetera imorgon"
  ,"landing12.story.review.note": "Den riktiga appen schemalägger utifrån den verkliga repetitionshistoriken. Den här Landingssidan skapar inget schema."
  ,"landing12.story.review.fsrs": "Intervallrepetition"
  ,"landing12.story.workspace.plan": "Plan"
  ,"landing12.story.workspace.context": "Sammanhang"
  ,"landing12.story.workspace.analysis": "Analys"
  ,"landing12.story.workspace.conclusion": "Slutsats"
  ,"landing12.story.workspace.documentTitle": "Hur celler omvandlar energi"
  ,"landing12.story.workspace.copy": "Källan och begreppen förblir spårbara medan eleven strukturerar ett argument och skriver den slutliga texten."
  ,"landing12.story.workspace.source": "Biologikurs.pdf"
  ,"landing12.story.workspace.citation": "Källhänvisning"
  ,"landing12.features.kicker": "Sammankopplade funktioner"
  ,"landing12.features.title": "Inte en samling AI-verktyg"
  ,"landing12.features.lead": "Varje funktion har en tydlig roll, men de delar samma källor, sessioner och inlärningssammanhang."
  ,"landing12.features.group.personal": "Personlig intelligens"
  ,"landing12.features.group.personal.desc": "Känner eleven"
  ,"landing12.features.group.understand": "Förstå"
  ,"landing12.features.group.understand.desc": "Frågor och källor"
  ,"landing12.features.group.practice": "Öva och behåll"
  ,"landing12.features.group.practice.desc": "Aktivt lärande"
  ,"landing12.features.group.produce": "Använd och fortsätt"
  ,"landing12.features.group.produce.desc": "Arbete och nästa åtgärd"
  ,"landing12.feature.brain.title": "Min hjärna"
  ,"landing12.feature.brain.desc": "En synlig kognitiv tvilling för begrepp, relationer, behärskning, minne och inlärningshistorik."
  ,"landing12.feature.professor.title": "AI-professor"
  ,"landing12.feature.professor.desc": "En pedagogisk identitet som undervisar, förklarar, frågar, bedömer och anpassar sig till det aktiva sammanhanget."
  ,"landing12.feature.learn.title": "Lär dig"
  ,"landing12.feature.learn.desc": "Ett skrivfält för att förstå, lära, öva, undersöka eller skapa med text, röst och källor."
  ,"landing12.feature.documents.title": "Dokumentintelligens"
  ,"landing12.feature.documents.desc": "Importera, förstå, fråga och omvandla ett dokument eller en avgränsad dokumentgrupp med spårbara källor."
  ,"landing12.feature.review.title": "Repetera"
  ,"landing12.feature.review.desc": "Befäster det som riskerar att glömmas genom verklig repetitionshistorik och intervallrepetition."
  ,"landing12.feature.research.title": "Undersökning"
  ,"landing12.feature.research.desc": "Snabb, källbelagd eller djupgående undersökning i Min hjärna och Biblioteket. Hänvisningarna går att granska."
  ,"landing12.feature.workspace.title": "Akademisk arbetsyta"
  ,"landing12.feature.workspace.desc": "En beständig arbetsyta för planer, utkast, källor, hänvisningar och kontextuell hjälp."
  ,"landing12.feature.languages.title": "Språk och språkbad"
  ,"landing12.feature.languages.desc": "En strukturerad CEFR-kurs kopplad till uppdrag i verkliga livet, återkoppling, repetition och belägg för funktionell förmåga."
  ,"landing12.feature.voice.title": "Muntligt och röst"
  ,"landing12.feature.voice.desc": "Tala, granska transkriberingen och få ett skriftligt svar som förblir tillgängligt om ljudet misslyckas."
  ,"landing12.feature.next.title": "Bästa nästa åtgärd"
  ,"landing12.feature.next.desc": "En förklarbar rekommendation som kombinerar mål, sessioner, repetition och aktuellt sammanhang."
  ,"landing12.features.researchScope": "Undersökning i dina egna källor"
  ,"landing12.features.noWebClaim": "Extern webbleverantör är inte konfigurerad"
  ,"landing12.features.sameContext": "Ett gemensamt sammanhang"
  ,"landing12.brain.kicker": "Min hjärna"
  ,"landing12.brain.title": "Din synliga kognitiva tvilling"
  ,"landing12.brain.lead": "Den svarar på vad du kan, vad som är bräckligt, hur kunskap hänger samman och vad som förtjänar uppmärksamhet härnäst."
  ,"landing12.brain.center": "Ditt inlärningssammanhang"
  ,"landing12.brain.knowledge": "Kunskap"
  ,"landing12.brain.connections": "Kopplingar"
  ,"landing12.brain.strengths": "Styrkor"
  ,"landing12.brain.fragilities": "Bräckligheter"
  ,"landing12.brain.memory": "Minne"
  ,"landing12.brain.noScores": "Second Brain visar endast behärskning och påverkan när det finns belägg. Landingssidan hittar inte på några poäng."
  ,"landing12.professor.kicker": "AI-professor"
  ,"landing12.professor.title": "En lärare, inte ännu en allmän chattbot"
  ,"landing12.professor.lead": "Den kan ändra upplevelsens format samtidigt som elevens sammanhang och session bevaras."
  ,"landing12.professor.level": "Nivå"
  ,"landing12.professor.goals": "Mål"
  ,"landing12.professor.documents": "Dokument"
  ,"landing12.professor.progress": "Framsteg"
  ,"landing12.professor.identity": "Pedagogisk identitet"
  ,"landing12.professor.example": "”Jag kan förklara på ett annat sätt, ställa en fråga, gå över till muntlig övning eller göra svårigheten till en repetition.”"
  ,"landing12.professor.mode.explain": "Förklara"
  ,"landing12.professor.mode.teach": "Undervisa"
  ,"landing12.professor.mode.question": "Fråga"
  ,"landing12.professor.mode.assess": "Bedöma"
  ,"landing12.professor.mode.voice": "Röst"
  ,"landing12.personal.kicker": "Personlig intelligens"
  ,"landing12.personal.title": "Ett system som utvecklas med ditt lärande"
  ,"landing12.personal.lead": "Ju mer du lär dig, övar och repeterar, desto bättre kan Second Brain organisera ditt sammanhang och göra nästa åtgärd användbar."
  ,"landing12.personal.learn": "Det du lär dig"
  ,"landing12.personal.understand": "Det du förstår"
  ,"landing12.personal.forget": "Det som riskerar att glömmas"
  ,"landing12.personal.master": "Det du behärskar"
  ,"landing12.personal.goals": "Det du vill uppnå"
  ,"landing12.personal.twin": "En levande kognitiv karta"
  ,"landing12.personal.note": "Först en tidslinje när datamängden är liten, sedan en utforskande graf när underlaget har mognat."
  ,"landing12.personal.nbaLabel": "Exempel på en bästa nästa åtgärd"
  ,"landing12.personal.nbaAction": "Fortsätt ditt engelska mötesuppdrag"
  ,"landing12.personal.nbaReason": "Eftersom det är kopplat till ditt mål att arbeta internationellt och din senaste session är redo att fortsätta."
  ,"landing12.languages.kicker": "Språk och språkbad"
  ,"landing12.languages.title": "Lär dig ett språk med din AI-professor"
  ,"landing12.languages.lead": "Välj vad du vill kunna göra. Second Brain kombinerar en fullständig kurs, uppdrag i verkliga livet, muntlig övning, riktade åtgärder och repetition."
  ,"landing12.languages.demoDisclaimer": "Scenario från blueprinten för Lot 11 bis. Endast demonstration. Ingen certifiering eller elevpoäng utlovas."
  ,"landing12.languages.objective": "Mål"
  ,"landing12.languages.objectiveValue": "Jag vill arbeta internationellt"
  ,"landing12.languages.missionMeeting": "Delta i ett möte"
  ,"landing12.languages.rlle": "Språkmotor för verkliga livet"
  ,"landing12.languages.stage.goal": "Mål"
  ,"landing12.languages.stage.course": "Kurs"
  ,"landing12.languages.stage.mission": "Uppdrag"
  ,"landing12.languages.stage.conversation": "Utbyte med professorn"
  ,"landing12.languages.stage.gap": "Svårighet upptäckt"
  ,"landing12.languages.stage.micro-lesson": "Mikrolektion"
  ,"landing12.languages.stage.retry": "Nytt försök"
  ,"landing12.languages.stage.vocabulary": "Användbart språk"
  ,"landing12.languages.stage.review": "Repetition"
  ,"landing12.languages.stage.functional-progress": "Kan-göra-framsteg"
  ,"landing12.languages.stage.goal.note": "Elevens verkliga mål styr kursens prioriteringar."
  ,"landing12.languages.stage.course.note": "CEFR strukturerar vägen. Det presenteras inte som en extern certifiering."
  ,"landing12.languages.stage.mission.note": "Ett uppdrag i världen omvandlar kunskap till en konkret kommunikativ uppgift."
  ,"landing12.languages.stage.conversation.note": "Inlärningsspråket förblir skilt från gränssnittsspråket."
  ,"landing12.languages.stage.gap.note": "En lucka bygger på observerade belägg, inte på en dekorativ poäng."
  ,"landing12.languages.stage.micro-lesson.note": "Åtgärden fokuserar på det exakta hindret före nästa försök."
  ,"landing12.languages.stage.retry.note": "Ett nytt försök ger eleven möjlighet att tillämpa rättelsen direkt."
  ,"landing12.languages.stage.vocabulary.note": "Valt språk behåller spårbarheten till uppdraget och sessionen."
  ,"landing12.languages.stage.review.note": "Ordförråd kan gå in i det befintliga flödet för repetition och FSRS."
  ,"landing12.languages.stage.functional-progress.note": "Ett Kan-göra-mål valideras endast med godkända belägg i den verkliga produkten."
  ,"landing12.languages.path.goal": "Ett funktionellt mål, inte ett vagt ämne"
  ,"landing12.languages.path.goal.desc": "Kursen utgår från den situation som eleven vill kunna hantera i verkliga livet."
  ,"landing12.languages.path.course": "En strukturerad väg på B1-nivå"
  ,"landing12.languages.path.course.desc": "Kursplan, delområden och uppdrag förblir sammankopplade i stället för att bli separata miniappar."
  ,"landing12.languages.path.mission": "Ett möte som verklig uppgift"
  ,"landing12.languages.path.mission.desc": "Professorn skapar ett kontextuellt utbyte, observerar hinder och vägleder åtgärdsslingan."
  ,"landing12.languages.professorLabel": "AI-professor · engelska B1"
  ,"landing12.languages.transcriptVisible": "Röstläget och transkriberingen förblir tydliga och redigerbara i appen."
  ,"landing12.languages.gapDetected": "Observerad funktionell lucka"
  ,"landing12.languages.gapExplanation": "Den avsedda betydelsen är tydlig, men adverbformen hindrar en naturlig professionell mening. I den riktiga produkten kan den observerade svårigheten gå in i Misstagsminnet så att Åtgärdsslingan kan rikta in sig på den senare."
  ,"landing12.languages.gapGrammar": "Grammatik"
  ,"landing12.languages.gapFluency": "Flyt"
  ,"landing12.languages.microLesson": "Riktad åtgärd"
  ,"landing12.languages.microRule": "Använd ett adverb för att beskriva hur teamet arbetar."
  ,"landing12.languages.microHint": "Professorn kopplar regeln till meningen i stället för att öppna en orelaterad lektion."
  ,"landing12.languages.retryLabel": "Försök med samma uppgift igen"
  ,"landing12.languages.retryObserved": "Den rättade strukturen visas i det nya försöket"
  ,"landing12.languages.vocabularyTitle": "Språk valt från det här uppdraget"
  ,"landing12.languages.vocabularyTrace": "I produkten behåller varje sparat objekt sitt språk och sin spårbarhet till källa och session."
  ,"landing12.languages.reviewLabel": "Kopplat till Repetera"
  ,"landing12.languages.reviewAction": "Befäst den användbara strukturen vid rätt tidpunkt"
  ,"landing12.languages.reviewTrace": "Det verkliga schemat skapas utifrån verkliga repetitionsbelägg. Den här demonstrationen skapar inga."
  ,"landing12.languages.canDoTitle": "Det jag redan kan göra"
  ,"landing12.languages.canDo.introduce": "Presentera mig"
  ,"landing12.languages.canDo.restaurant": "Beställa på restaurang"
  ,"landing12.languages.canDo.meeting": "Delta i ett möte"
  ,"landing12.languages.canDo.opinion": "Försvara en åsikt"
  ,"landing12.languages.canDoDisclaimer": "Illustrativ lista. Endast belägg kan validera en förmåga i appen."
  ,"landing12.languages.courseTitle": "En fullständig språkkurs"
  ,"landing12.languages.courseLead": "Samtal är en del av kursen, tillsammans med uttryckligt språkarbete och förståelse."
  ,"landing12.languages.strand.vocabulary": "Ordförråd"
  ,"landing12.languages.strand.grammar": "Grammatik"
  ,"landing12.languages.strand.verbs": "Verb"
  ,"landing12.languages.strand.conjugation": "Böjning"
  ,"landing12.languages.strand.reading": "Läsning"
  ,"landing12.languages.strand.writing": "Skrivande"
  ,"landing12.languages.strand.listening": "Hörförståelse"
  ,"landing12.languages.strand.oral": "Muntligt"
  ,"landing12.languages.strand.pronunciation": "Uttal"
  ,"landing12.languages.strand.mediation": "Mediering"
  ,"landing12.languages.missionsTitle": "Uppdrag i världen"
  ,"landing12.languages.missionsLead": "En avgränsad katalog med situationer där språket används, med ett mål och en miniminivå."
  ,"landing12.languages.mission.travel": "Resor"
  ,"landing12.languages.mission.work": "Arbete"
  ,"landing12.languages.mission.studies": "Studier"
  ,"landing12.languages.mission.social": "Socialt liv"
  ,"landing12.languages.registryTitle": "34 inlärningsspråk stöds"
  ,"landing12.languages.registryLead": "Namn på modersmålet och gränssnittsspråket förmedlar betydelsen. En neutral symbol ersätter landsflaggan när ett land skulle vara tvetydigt."
  ,"landing12.how.kicker": "Så fungerar det"
  ,"landing12.how.title": "En enkel resa, även när intelligensen är djupgående"
  ,"landing12.how.lead": "Du bidrar med en avsikt. Second Brain håller den tekniska komplexiteten bakom en sammanhängande upplevelse."
  ,"landing12.how.goal.title": "Ange ditt mål"
  ,"landing12.how.goal.desc": "Berätta vad du vill förstå eller åstadkomma."
  ,"landing12.how.act.title": "Lär dig, importera eller fråga"
  ,"landing12.how.act.desc": "Använd text, röst, en skanning eller en fil."
  ,"landing12.how.context.title": "Bygg sammanhanget"
  ,"landing12.how.context.desc": "Samla relevanta sessioner, källor och mål."
  ,"landing12.how.practice.title": "Öva"
  ,"landing12.how.practice.desc": "Gå från en förklaring till en aktiv upplevelse."
  ,"landing12.how.consolidate.title": "Befäst"
  ,"landing12.how.consolidate.desc": "Repetera det som beläggen visar är bräckligt."
  ,"landing12.how.continue.title": "Fortsätt"
  ,"landing12.how.continue.desc": "Följ en enda förklarbar nästa åtgärd."
  ,"landing12.nba.kicker": "Bästa nästa åtgärd"
  ,"landing12.nba.title": "Se vad som förtjänar uppmärksamhet nu"
  ,"landing12.nba.lead": "Rekommendationerna kombinerar verkligt sammanhang och förklarar varför de är användbara. De är förslag, aldrig osynliga kommandon."
  ,"landing12.nba.english": "Fortsätt din engelskakurs"
  ,"landing12.nba.review": "Repetera 5 begrepp som förfaller"
  ,"landing12.nba.workspace": "Fortsätt med dispositionen till din avhandling"
  ,"landing12.nba.professor": "Fortsätt din session med professorn"
  ,"landing12.nba.why": "Varför den här rekommendationen? · Mål och återupptagbar session"
  ,"landing12.platform.web": "Webb"
  ,"landing12.platform.android": "Android"
  ,"landing12.platform.ios": "iOS"
  ,"landing12.platform.windows": "Windows"
  ,"landing12.platform.macos": "macOS"
  ,"landing12.platform.status.available": "Tillgänglig"
  ,"landing12.platform.status.prepared": "Appen är tekniskt förberedd. Det finns ännu ingen offentlig butikslänk"
  ,"landing12.platform.status.coming-soon": "Kommer snart. Det finns ännu ingen offentlig nedladdningslänk"
  ,"landing12.download.kicker": "Kontinuitet på flera plattformar"
  ,"landing12.download.title": "Second Brain, var du än lär dig"
  ,"landing12.download.lead": "Börja med webbupplevelsen idag. Distributionen för mobil och dator visas sanningsenligt i takt med att den blir tillgänglig."
  ,"landing12.download.continuity": "Sessionsmodellen är utformad för att låta dig börja på en enhet och fortsätta på en annan."
  ,"landing12.download.webAction": "Använd på webben"
  ,"landing12.download.sameSession": "Samma session"
  ,"landing12.download.synced": "Sammanhanget är redo att återupptas"
  ,"landing12.privacy.kicker": "Integritet och kontroll"
  ,"landing12.privacy.title": "Du behåller kontrollen över dina data"
  ,"landing12.privacy.lead": "Second Brain har kontoinställningar för minne, dokument, dataportabilitet och radering."
  ,"landing12.privacy.scope": "Detta är produktinställningar, inte ytterligare juridiska löften eller säkerhetslöften."
  ,"landing12.privacy.memory": "Hantera AI-minne"
  ,"landing12.privacy.export": "Exportera dina data"
  ,"landing12.privacy.documents": "Hantera dina dokument"
  ,"landing12.privacy.delete": "Begär radering av kontot med bekräftelse"
  ,"landing12.pricing.kicker": "Gratis · Pro · Max"
  ,"landing12.pricing.title": "Tre abonnemang för privatpersoner utan påhittade detaljer"
  ,"landing12.pricing.lead": "De slutliga priserna, kvoterna och förmånerna beslutas efter den offentliga betan. Landingssidan presenterar endast den verkliga katalogen idag."
  ,"landing12.pricing.free.name": "Gratis"
  ,"landing12.pricing.free.desc": "Standardabonnemanget för att prova Second Brain."
  ,"landing12.pricing.pro.name": "Pro"
  ,"landing12.pricing.pro.desc": "Ett avancerat individuellt erbjudande vars slutliga pris, kvoter och förmåner återstår att konfigurera."
  ,"landing12.pricing.max.name": "Max"
  ,"landing12.pricing.max.desc": "Det mest omfattande individuella erbjudandet. Dess slutliga kommersiella detaljer återstår att konfigurera."
  ,"landing12.pricing.freeStatus": "Gratiserbjudande tillgängligt"
  ,"landing12.pricing.pending": "Detaljer efter offentlig beta"
  ,"landing12.pricing.sourceNote": "Autentiserade abonnemangsskärmar förblir datadrivna från backend. Inget pris, ingen rabatt, kvot eller exklusiv förmån är hårdkodad här."
  ,"landing12.faq.kicker": "Användbara svar"
  ,"landing12.faq.title": "Frågor? Vi svarar."
  ,"landing12.faq.lead": "Korta svar om vad produkten faktiskt gör idag."
  ,"landing12.faq.q1": "Vad är Second Brain?"
  ,"landing12.faq.a1": "Ett personligt intelligent inlärningssystem som kopplar samman frågor, källor, undervisning, övning, minne och akademiskt arbete i ett sammanhang."
  ,"landing12.faq.q2": "Är det bara en chattbot?"
  ,"landing12.faq.a2": "Nej. Samtal är ett gränssnitt. Samma session kan bli en lektion, muntlig övning, källbelagd dokumentfråga, repetition eller åtgärd i Arbetsytan."
  ,"landing12.faq.q3": "Hur fungerar Min hjärna?"
  ,"landing12.faq.a3": "Den synliggör dina begrepp, relationer, belägg för behärskning, minne och inlärningshistorik. Vyn anpassas efter mognaden hos tillgängliga data."
  ,"landing12.faq.q4": "Kan jag använda mina egna dokument?"
  ,"landing12.faq.a4": "Ja. Biblioteket tar emot filformat och skanningar som stöds, visar verkliga bearbetningstillstånd, extraherar begrepp och stödjer källgrundade frågor och omvandlingar."
  ,"landing12.faq.q5": "Kan jag lära mig ett språk?"
  ,"landing12.faq.a5": "Ja. Språkmotorn för verkliga livet kombinerar en CEFR-kursplan, uttryckligt språkarbete, uppdrag i världen, muntlig övning, riktade åtgärder, repetition och Kan-göra-belägg."
  ,"landing12.faq.q6": "Hur fungerar AI-professorn?"
  ,"landing12.faq.a6": "Den använder elevens aktiva sammanhang och kan förklara, undervisa, fråga, bedöma eller öva samtidigt som upplevelsesessionen bevaras."
  ,"landing12.faq.q7": "Hur fungerar repetitionerna?"
  ,"landing12.faq.a7": "Repetera använder verklig historik och intervallrepetition för att prioritera kunskap som riskerar att glömmas. Repetition utan AI är fortfarande tillgänglig oberoende av AI-kvoter."
  ,"landing12.faq.q8": "Vilka språk är tillgängliga?"
  ,"landing12.faq.a8": "Det gemensamma registret innehåller för närvarande 34 inlärningsspråk. Gränssnittsspråk och inlärningsspråk väljs alltid separat."
  ,"landing12.faq.q9": "Söker Undersökning på webben?"
  ,"landing12.faq.a9": "Undersökning kan idag arbeta i Min hjärna och ditt Bibliotek. Den externa webbleverantören är inte konfigurerad i den aktuella distributionen, så Landingssidan påstår inte att den är det."
  ,"landing12.faq.q10": "Är mina data privata?"
  ,"landing12.faq.a10": "Autentiserade inställningar omfattar AI-minne, dokument, samtycken, export och kontoradering. Den här sidan lägger inte till juridiska löften eller infrastrukturlöften utöver dessa inställningar."
  ,"landing12.faq.q11": "Vad är skillnaden mellan Gratis, Pro och Max?"
  ,"landing12.faq.a11": "De är de tre individuella abonnemangsnivåerna i backend-katalogen. Slutliga priser, kvoter och abonnemangsförmåner konfigureras efter den offentliga betan."
  ,"landing12.faq.q12": "Var kan jag använda Second Brain?"
  ,"landing12.faq.a12": "Webbupplevelsen är tillgänglig i den här appen. Android och iOS är tekniskt förberedda utan offentliga butikslänkar. Distributionen för Windows och macOS är fortfarande kommande."
  ,"landing12.contact.kicker": "Kontakt och support"
  ,"landing12.contact.title": "Berätta vad du behöver"
  ,"landing12.contact.lead": "Den offentliga kontaktvägen är transparent: den öppnar endast en e-postkanal när en offentlig supportadress har konfigurerats."
  ,"landing12.contact.write": "Skriv till supporten"
  ,"landing12.contact.account": "Logga in på ditt konto"
  ,"landing12.contact.notConfigured": "Den offentliga supportadressen är inte konfigurerad ännu. Logga in för att komma åt konto- och datainställningar. Inget meddelande simuleras."
  ,"landing12.contact.subject": "Supportärende för Second Brain"
  ,"landing12.contact.general": "Allmän fråga"
  ,"landing12.contact.general.desc": "Förstå produkten eller dess tillgänglighet."
  ,"landing12.contact.technical": "Teknisk support"
  ,"landing12.contact.technical.desc": "Rapportera ett problem med att använda appen."
  ,"landing12.contact.billing": "Abonnemang och fakturering"
  ,"landing12.contact.billing.desc": "Frågor om ett erbjudande, en faktura eller betalning."
  ,"landing12.contact.privacy": "Integritet och data"
  ,"landing12.contact.privacy.desc": "Frågor om minne, export eller radering."
  ,"landing12.contact.problem": "Rapportera ett problem"
  ,"landing12.contact.problem.desc": "Beskriv ett reproducerbart produktproblem."
  ,"landing12.contact.feedback": "Förslag och återkoppling"
  ,"landing12.contact.feedback.desc": "Dela en idé för att förbättra upplevelsen."
  ,"report.title": "Rapportera ett problem"
  ,"report.intro": "Berätta vad som hände. Din rapport granskas av människor. Den är inte en instruktion till systemet och utlöser ingen automatisk åtgärd."
  ,"report.category": "Vad berörs?"
  ,"report.category.app_not_working": "Appen fungerar inte"
  ,"report.category.ai_teacher_problem": "AI-lärare"
  ,"report.category.document_pdf_problem": "Dokument eller PDF"
  ,"report.category.voice_problem": "Röst"
  ,"report.category.language_learning_problem": "Språkinlärning"
  ,"report.category.revision_problem": "Repetition"
  ,"report.category.brain_digital_twin_problem": "Min hjärna eller digital tvilling"
  ,"report.category.subscription_payment_problem": "Abonnemang eller betalning"
  ,"report.category.account_login_problem": "Konto eller inloggning"
  ,"report.category.other": "Annat"
  ,"report.description": "Beskriv problemet"
  ,"report.placeholder": "Vad försökte du göra och vad hände i stället?"
  ,"report.counter": "{count}/{max} tecken"
  ,"report.minimum": "Ange minst {min} tecken."
  ,"report.privacyTitle": "Håll rapporten säker"
  ,"report.privacyDetail": "Ta inte med lösenord, åtkomstkoder, betalningsuppgifter, privata dokument, samtalsinnehåll eller personuppgifter. Värden som ser känsliga ut maskeras före sändning."
  ,"report.consent": "Jag godkänner begränsad ytterligare diagnostik om det behövs. Detta är valfritt. Rapporten kan skickas utan det."
  ,"report.contextTitle": "Begränsat diagnostiskt sammanhang"
  ,"report.contextDetail": "Appen skickar endast rapportkategori, avgränsad beskrivning, ett säkert namn på sidan eller vyn, app-/byggversion, plattform och ett ogenomskinligt begärande-ID. Den skickar inte skärmbilder, dokument, samtal eller ljud."
  ,"report.attachments": "Bilagor"
  ,"report.attachmentsDetail": "NOT_INSTRUMENTED – bilagor är avsiktligt otillgängliga för problemrapporter."
  ,"report.submit": "Skicka rapport"
  ,"report.successTitle": "Rapporten har skickats"
  ,"report.successDetail": "Tack. En mänsklig granskning kan koppla den till säker telemetri. Den bekräftar ingen orsak och gör ingen automatisk ändring."
  ,"report.error": "Rapporten kunde inte skickas. Inget nytt försök gjordes automatiskt."
  ,"report.profileTitle": "Hjälp och problemrapporter"
  ,"report.profileDetail": "Rapportera ett produktproblem utan att bifoga privat inlärningsinnehåll."
  ,"report.open": "Rapportera ett problem"
  ,"landing12.final.kicker": "En produkt. En upplevelse."
  ,"landing12.final.title": "Bygg ett system som lär sig med dig"
  ,"landing12.final.lead": "Börja med en avsikt. Behåll sammanhanget. Fortsätt med rätt nästa åtgärd."
  ,"landing12.footer.tagline": "Ditt personliga intelligenta inlärningssystem: förstå, öva, minnas och skapa i ett sammanhängande sammanhang."
  ,"landing12.footer.beta": "Offentlig beta · funktioner och kommersiell konfiguration fortsätter att utvecklas."
  ,"landing12.footer.product": "Produkt"
  ,"landing12.footer.resources": "Resurser"
  ,"landing12.footer.features": "Funktioner"
  ,"landing12.footer.brain": "Min hjärna"
  ,"landing12.footer.languages": "Språk"
  ,"landing12.footer.pricing": "Priser"
  ,"landing12.footer.download": "Ladda ned"
  ,"landing12.footer.how": "Så fungerar det"
  ,"landing12.footer.faq": "FAQ"
  ,"landing12.footer.contact": "Kontakt"
  ,"landing12.footer.account": "Konto"
  ,"landing12.footer.privacy": "Inställningar för integritet och data"
  ,"landing12.footer.copy": "© 2026 Second Brain. Alla produktdemonstrationer är offentliga exempel."
  ,"landing12.footer.noTracking": "Ingen påhittad partner, rekommendation eller mätpunkt."
  ,"capture.permission.pending": "Förbereder kameran…"
  ,"capture.permission.title": "Kamerabehörighet krävs"
  ,"capture.permission.detail": "Second Brain öppnar kameran först efter din åtgärd. Du kan fortfarande importera en befintlig bild."
  ,"capture.permission.allow": "Tillåt kamera"
  ,"capture.importFallback": "Importera en bild"
  ,"capture.error.capture": "Fotot kunde inte tas."
  ,"capture.error.fallback": "Stäng en annan app som använder kameran, kontrollera behörigheten eller importera en bild."
  ,"capture.error.unavailable": "Ingen tillgänglig kamera hittades."
  ,"capture.error.paused": "Kameran är pausad."
  ,"capture.error.denied": "Kamerabehörighet nekades."
  ,"capture.error.secureContext": "Kameran kräver en säker HTTPS-anslutning."
  ,"capture.error.busy": "Kameran är inte tillgänglig eller används redan."
  ,"capture.retake": "Ta om"
  ,"capture.confirm": "Använd det här fotot"
  ,"capture.take": "Ta foto"
  ,"capture.switch": "Byt kamera"
  ,"capture.preview": "Liveförhandsvisning från kameran"
  ,"capture.cameraChoice": "Välj en kamera"
  ,"capture.camera": "Kamera"
  ,"qr.title": "Läs en QR-kod"
  ,"qr.detail": "Rikta kameran mot en QR-kod. Innehållet förblir inaktivt tills du har granskat det."
  ,"qr.aim": "Håll QR-koden inom ramen."
  ,"qr.unsupported": "QR-avläsning är inte tillgänglig i den här webbläsaren"
  ,"qr.unsupportedDetail": "Använd en kompatibel HTTPS-webbläsare eller en annan enhet. Inget innehåll har öppnats."
  ,"qr.detected": "QR-destination upptäckt"
  ,"qr.confirmDetail": "Kontrollera hela destinationen innan du öppnar den."
  ,"qr.open": "Öppna den här destinationen"
  ,"qr.openError": "Den här destinationen kunde inte öppnas. Den har inte körts eller importerats."
  ,"qr.noneFound": "Ingen QR-kod hittades. Placera den på nytt i ramen och försök igen."
  ,"qr.scanAgain": "Skanna en annan QR-kod"
  ,"qr.textDetected": "QR-text upptäckt"
  ,"qr.textInert": "Den här texten visas bara. Den körs inte och skickas inte till AI-läraren."
  ,"qr.done": "Klart"
  ,"qr.blocked": "Osäker QR-destination blockerad"
  ,"qr.blockedDetail": "Endast uttryckliga HTTP- och HTTPS-länkar kan öppnas. Anpassade scheman samt fil-, data- och skriptscheman nekas."
  ,"scan.importError": "De valda bilderna kunde inte importeras."
  ,"scan.editError": "Den här sidan kunde inte redigeras. De andra sidorna har bevarats."
  ,"scan.uploadError": "Skanningen kunde inte sparas."
  ,"scan.inProgress": "Den här skanningen bearbetas fortfarande. Försök igen om en stund."
  ,"scan.retryNewAttempt": "Det föregående försöket avslutades säkert. Tryck på spara igen för att starta ett nytt skanningsförsök."
  ,"scan.returnToLearn": "Återvänd till Lär dig med det här dokumentet"
  ,"scan.captureFirst": "Granska innan du sparar"
  ,"scan.captureFirstDetail": "Fotografera, skanna eller importera sidor, justera ordning, beskärning och rotation och bekräfta sedan. Inget laddas upp före den slutliga åtgärden."
  ,"scan.retryPreserved": "Dina sidor finns kvar här så att du kan försöka igen utan att fotografera eller skanna dem igen."
  ,"scan.pagePosition": "Sida {current} av {total}"
  ,"scan.moveBefore": "Flytta åt vänster"
  ,"scan.moveAfter": "Flytta åt höger"
  ,"scan.rotate": "Rotera"
  ,"scan.crop": "Justera beskärning"
  ,"scan.perspectiveLimit": "Förinställda centrerade beskärningar är tillgängliga. Justerbara sidkanter och perspektivkorrigering är ännu inte tillgängliga."
  ,"learn5.capture.photo": "Foto"
  ,"learn5.capture.document": "Skanna ett dokument"
  ,"learn5.capture.qr": "Läs en QR-kod"
  ,"profile.card.webcam": "Använd webbkamera"
  ,"profile.card.importImage": "Importera en bild"
  ,"profile.email.verified": "E-postadress verifierad"
  ,"profile.email.unverified": "E-postadress inte verifierad"
  ,"profile.edit": "Redigera min profil"
  ,"profile.avatar.loadError": "Den sparade profilbilden kunde inte läsas in."
  ,"profile.avatar.saveError": "Den nya profilbilden kunde inte sparas."
  ,"profile.avatar.removeError": "Profilbilden kunde inte tas bort."
  ,"profile.avatar.denied": "Åtkomst till foton nekades."
  ,"profile.avatar.error": "Bildväljaren kunde inte öppnas."
  ,"profile.avatar.preserved": "Den tidigare sparade bilden har bevarats. Du kan försöka igen på ett säkert sätt."
  ,"profile.avatar.editorTitle": "Justera profilbilden"
  ,"profile.avatar.editorDetail": "Förhandsgranska den runda beskärningen. Rotation och zoomning tillämpas först efter bekräftelse."
  ,"profile.avatar.rotate": "Rotera"
  ,"profile.avatar.zoomOut": "Zooma ut"
  ,"profile.avatar.zoomIn": "Zooma in"
  ,"profile.avatar.confirm": "Spara det här fotot"
};

registerLocale('sv', "Svenska", sv);
