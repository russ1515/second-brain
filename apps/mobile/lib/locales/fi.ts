import { registerLocale } from '../i18n';

/** Finnish UI locale — machine-generated (Step 2), review recommended.
 *  Regenerate/extend with: node scripts/translate-locale.mjs fi */
const fi: Record<string, string> = {
  "app.today": "Tänään",
  "app.signOut": "Kirjaudu ulos",
  "app.back": "Takaisin tähän päivään",
  "app.tryAgain": "Yritä uudelleen",
  "app.language": "Sovelluksen kieli",
  "auth.title": "Luokkahuoneesi",
  "auth.subtitle": "Yksityinen opettaja, joka muistaa jokaisen oppitunnin, virheen ja onnistumisen.",
  "auth.name": "Nimi (valinnainen)",
  "auth.email": "Sähköposti",
  "auth.password": "Salasana",
  "auth.start": "Aloita oppiminen",
  "auth.signIn": "Kirjaudu sisään",
  "auth.haveAccount": "Minulla on jo tili",
  "auth.createAccount": "Luo tili",
  "auth.headline": "Aktivoi digitaalinen kaksoisesi",
  "auth.emailPh": "sinä@esimerkki.fi",
  "auth.namePh": "Nimesi",
  "auth.createBtn": "Luo tilini",
  "auth.forgot": "Unohditko salasanasi?",
  "auth.noAccount": "Eikö sinulla vielä ole tiliä?",
  "auth.otpTitle": "Vahvista sähköpostiosoitteesi",
  "auth.otpSubtitle": "Kirjoita osoitteeseen {email} lähetetty 6-numeroinen koodi.",
  "auth.verify": "Vahvista",
  "auth.notReceived": "Etkö saanut sitä?",
  "auth.resend": "Lähetä koodi uudelleen",
  "auth.resendIn": "Lähetä uudelleen {n} s kuluttua",
  "auth.skip": "Ohita tämä vaihe",
  "auth.expired": "Koodi on vanhentunut – pyydä uusi.",
  "auth.otpError": "Virheellinen koodi. Yritä uudelleen.",
  "auth.forgotTitle": "Unohdettu salasana",
  "auth.forgotSubtitle": "Kirjoita sähköpostiosoitteesi, niin lähetämme palautuskoodin.",
  "auth.sendCode": "Lähetä koodi",
  "auth.back": "Takaisin",
  "auth.resetTitle": "Nollaa salasana",
  "auth.resetSubtitle": "Kirjoita koodi ja uusi salasana.",
  "auth.newPassword": "Uusi salasana",
  "auth.reset": "Nollaa",
  "auth.resetSent": "Jos osoitteelle {email} on tili, palautuskoodi on lähetetty.",
  "auth.resetOk": "Salasana nollattu – kirjaudu sisään.",
  "auth.codeSent": "Koodi lähetetty osoitteeseen {email}.",
  "auth.newCodeSent": "Uusi koodi lähetetty.",
  "auth.2faTitle": "Kaksivaiheinen tunnistus",
  "auth.2faSubtitle": "Kirjoita tunnistussovelluksesi koodi.",
  "auth.useRecovery": "Käytä palautuskoodia",
  "auth.recoveryPh": "Palautuskoodi",
  "classroom.opening": "Avataan luokkahuonetta…",
  "classroom.streak": "päivän putki",
  "classroom.milestone": "Uusi virstanpylväs",
  "classroom.emptyTitle": "Ei vielä mitään aikataulutettua",
  "classroom.emptyDetail": "Päiväsi rakentuu todellisen työn pohjalta. Skannaa kurssisi sivu tai aloita keskustelu, niin luokkahuone suunnittelee kaiken sen ympärille.",
  "classroom.replan": "Suunnittele tämä päivä uudelleen",
  "classroom.offlineTitle": "Luokkahuoneeseesi ei saada yhteyttä",
  "classroom.offlineDetail": "Olet yhä kirjautuneena sisään – palvelin ei vain vastaa. Tarkista, että rajapinta on käynnissä, ja yritä uudelleen.",
  "classroom.start": "Aloita",
  "classroom.done": "Valmis",
  "classroom.skip": "Ohita",
  "classroom.isDone": "✓ Valmis",
  "classroom.isSkipped": "Ohitettu",
  "slot.morning": "Aamu · kerratkaa eilistä",
  "slot.afternoon": "Iltapäivä · tämän päivän oppitunti",
  "slot.evening": "Ilta · harjoitus",
  "slot.night": "Ennen unta · pikakertaus",
  "nav.teacher": "Kysy opettajaltasi",
  "nav.scan": "📷 Skannaa kurssi",
  "nav.languages": "Kielet",
  "nav.revision": "Kertausjono",
  "nav.progress": "Edistyminen",
  "tab.home": "Etusivu",
  "tab.learn": "Opi",
  "tab.brain": "Oma aivoni",
  "tab.study": "Opiskele",
  "tab.profile": "Profiili",
  "learn.title": "Opi",
  "learn.intro": "Paikka, jonne omaksut uutta tietoa.",
  "learn.teacher.title": "Kysy opettajaltasi",
  "learn.teacher.detail": "Keskustele mistä tahansa — vastaukset omista muistiinpanoistasi puheena tai tekstinä.",
  "learn.languages.title": "Kielet",
  "learn.languages.detail": "Sanastoa, keskustelua ja ääntämistä opiskelemallasi kielellä.",
  "learn.scan.title": "Skannaa kurssi",
  "learn.scan.detail": "Valokuvaa sivu tai muistiinpanosi ja tallenna ne muistiisi.",
  "brain.title": "Oma aivoni",
  "brain.intro": "Kaikki oppimasi ja se, kuinka hyvin hallitset sen.",
  "brain.progress.title": "Edistyminen ja hallinta",
  "brain.progress.detail": "Putkesi, muistijälkesi, omaksutut käsitteet ja virstanpylväät.",
  "study.title": "Opiskele",
  "study.intro": "Harjoittele oikealla hetkellä, välitetyn kertauksen ajoittamana.",
  "study.revision.title": "Kertausjono",
  "study.revision.detail": "Kertaa juuri nyt erääntyvät kortit.",
  "profile.title": "Profiili",
  "profile.account": "Tili",
  "profile.health.title": "Järjestelmän tila",
  "profile.health.detail": "Tarkista, että luokkahuoneesi taustapalvelut toimivat.",
  "home.greeting": "Hei",
  "home.objective": "Päivän tavoite",
  "home.objectiveNone": "Ei vielä mitään suunnitteilla — skannaa kurssi tai aloita keskustelu.",
  "home.teacher": "AI-opettajasi",
  "home.continue": "Jatka viimeisintä oppituntiasi",
  "home.continueNone": "Ei vielä oppituntia — ensimmäinen näkyy täällä.",
  "home.priority": "Tärkeä kertaus",
  "home.cardsDue": "korttia erääntyy",
  "home.reviewNow": "Kertaa nyt",
  "home.nothingDue": "Ei erääntyviä kortteja — olet ajan tasalla.",
  "home.plan": "Päivän suunnitelma",
  "home.progress": "Edistyminen",
  "home.retention": "muistijälki",
  "home.mastered": "omaksuttu",
  "home.recommendations": "Tehokehotukset",
  "home.recommendWork": "Työstä",
  "home.recommendNone": "Lisää käsitteitä tai asiakirjoja, niin suosituksia ilmestyy tänne.",
  "home.open": "Avaa",
  "teacher.streak": "Hienoa johdonmukaisuutta — pidä putki yllä!",
  "teacher.due": "Sinulla on odottavia kertauksia. Aloita niistä.",
  "teacher.first": "Oletko valmis ensimmäiseen oppituntiisi? Skannaa kurssi tai kysy minulta mitä tahansa.",
  "teacher.default": "Oletko valmis oppimaan jotain uutta tänään?",
  "soon.badge": "Tulossa pian",
  "soon.detail": "Tietoja ilmestyy riittävien oppimistuokioiden jälkeen.",
  "learn.library": "Kirjasto",
  "learn.ocr": "OCR-skanneri",
  "learn.documents": "Asiakirjat",
  "learn.exercises": "Harjoitukset",
  "learn.assessments": "Arvioinnit",
  "learn.assessments.detail": "Opettaja kuulustelijana: monivalintoja, esseitä, tapaustutkimuksia, harjoituskokeita — arvosteltuna selityksillä ja neuvoilla varustettuna.",
  "learn.writing.title": "Kirjoitusvalmentaja",
  "learn.writing.detail": "Lähetä essee, raportti tai opinnäytetyö — tarkastettuna rakenteen, logiikan, selkeyden, kieliopin ja argumentaation osalta.",
  "learn.reading.title": "Lukuvalmentaja",
  "learn.reading.detail": "Tasoon mukautettuja tekstejä ja ymmärtamistehtäviä — vaikeusaste säätyy kehityksesi mukaan.",
  "study.planning": "Suunnittelu",
  "study.fsrs": "FSRS",
  "study.fsrs.detail": "Kertaa mitä tahansa FSRS:n avulla",
  "study.goals": "Tavoitteet",
  "study.exams": "Kokeet",
  "study.notifications": "Ilmoitukset",
  "brain.twin": "Digitaalinen kaksonen",
  "brain.twin.detail": "Oppimisprofiilisi",
  "brain.memory": "Oppimismuisti",
  "brain.memory.detail": "Kaikki, mitä tekoäly muistaa",
  "brain.mastery": "Käsitehallinta",
  "brain.mastery.detail": "Pisteet jokaiselle käsitteelle",
  "brain.graph": "Tietoverkko",
  "brain.graph.detail": "Miten käsitteesi liittyvät toisiinsa",
  "brain.dna": "Oppimis-DNA",
  "brain.score": "Oppimispisteet",
  "brain.strengths": "Vahvuudet",
  "brain.strengths.detail": "Missä olet vahvoilla",
  "brain.weaknesses": "Heikkoudet",
  "brain.weaknesses.detail": "Mikä on lipsumassa",
  "brain.insights": "Tekoälyn oivallukset",
  "brain.insights.detail": "Miksi tekoäly ehdottaa tätä",
  "brain.recommend": "Suositukset",
  "brain.recommend.detail": "Mitä tehdä seuraavaksi",
  "brain.dash.tagline": "Mieli, joka oppii — kaikki, mitä Second Brain tietää sinusta, reaaliajassa.",
  "brain.dash.memories": "muistot",
  "brain.dash.concepts": "käsitteet",
  "brain.dash.links": "linkit",
  "brain.dash.none": "Ei vielä mitään",
  "revEng.title": "Kertausmoottori",
  "revEng.intro": "Yksi FSRS-jono kaikelle — oppitunneille, harjoituksille, visailuille, läksyille, kielille.",
  "revEng.loading": "Rakennetaan kertausjonoasi…",
  "revEng.empty": "Ei vielä mitään kerrattavaa — opiskele jotain, niin se ajastetaan tänne.",
  "revEng.next": "seuraava",
  "revEng.now": "nyt",
  "revEng.tomorrow": "huomenna",
  "revEng.days": "päivää",
  "revEng.again": "Uudelleen",
  "revEng.hard": "Vaikea",
  "revEng.good": "Hyvä",
  "revEng.easy": "Helppo",
  "plan.title": "Opiskelusuunnittelija",
  "plan.tileDetail": "Päiväsi, tekoälyn koostamana",
  "plan.intro": "Kapellimestari. Se ei rakenna mitään itse — se kokoaa päiväsi muista moottoreista.",
  "plan.loading": "Kootaan päivääsi…",
  "plan.assembled": "Koottu lähteestä",
  "plan.live": "Reaaliaikainen suunnitelma — se muuttuu päivän mittaan.",
  "plan.replan": "🔄 Suunnittele uudelleen tästä hetkestä",
  "plan.items": "kohteita",
  "plan.k.revision": "Kertaus",
  "plan.k.lesson": "Oppitunti",
  "plan.k.discussion": "Keskustelu",
  "plan.k.practical": "Käytännön harjoitus",
  "plan.k.quiz": "Visailu",
  "plan.k.summary": "Yhteenveto",
  "plan.k.break": "Tauko",
  "plan.k.end": "Loppu",
  "daily.title": "Päivän sessio",
  "daily.start": "🎓 Aloita tämän päivän sessio",
  "daily.loading": "Valmistellaan luokkahuonetta…",
  "daily.noRevision": "Ei kerrattavaa juuri nyt — suoraan päivän opiskeluun.",
  "daily.revisionIntro": "Kerrataan ensin erääntyvät:",
  "daily.discussionIntro": "Kysy opettajalta mitä tahansa tästä aiheesta — suoraan tässä.",
  "daily.ask": "💬 Kysy opettajalta",
  "daily.askMore": "💬 Kysy uudelleen",
  "daily.askPrompt": "Voitko selittää tämän aiheen pääidean yksinkertaisesti?",
  "daily.askError": "Opettaja ei ole tällä hetkellä tavoitettavissa — yritä hetken kuluttua uudelleen.",
  "daily.checkIntro": "Vastaa omin sanoin — tarkistan ymmärryksesi ja autan tarvittaessa.",
  "daily.check.placeholder": "Vastauksesi…",
  "daily.check.btn": "Tarkista ymmärrykseni",
  "daily.check.again": "Tarkista uudelleen",
  "daily.check.understood": "Selvä!",
  "daily.check.partial": "Melkein — hiotaan hieman",
  "daily.check.confused": "Käydään tämä läpi uudelleen",
  "daily.check.reexplain": "Tässä on toinen tapa hahmottaa asia",
  "daily.planningIntro": "Tässä on seuraava suunnitelmani sinulle:",
  "daily.p.welcome": "Tervetuloa",
  "daily.p.objectives": "Tavoitteet",
  "daily.p.revision": "Kertaus",
  "daily.p.lesson": "Oppitunti",
  "daily.p.questions": "Kysymykset",
  "daily.p.discussion": "Keskustelu",
  "daily.p.exercises": "Tehtävät",
  "daily.p.homework": "Käytännön harjoitus / Kotitehtävä",
  "daily.p.correction": "Korjaus",
  "daily.p.quiz": "Visailu",
  "daily.p.summary": "Yhteenveto",
  "daily.p.flashcards": "Muistikortit",
  "daily.p.brain": "Aivopäivitys",
  "daily.p.planning": "Automaattinen suunnittelu",
  "cal.title": "Älykäs kalenteri",
  "cal.tileDetail": "Kokeet, kertaukset ja paljon muuta — automaattisesti luotuna",
  "cal.intro": "Luotu automaattisesti kaikesta, mitä tekoäly on ajoittanut. Lisää omat kokeet ja tavoitteet; tekoäly pitää yllä tärkeysjärjestystä.",
  "cal.loading": "Luodaan kalenteriasi…",
  "cal.add": "Lisää oma",
  "cal.titlePlaceholder": "esim. Matematiikan koe",
  "cal.addBtn": "➕ Lisää kalenteriin",
  "cal.todayTag": "Tänään",
  "cal.nothing": "Ei suunniteltua ohjelmaa",
  "cal.today": "Tänään",
  "cal.tomorrow": "Huomenna",
  "cal.in3": "3 päivän päästä",
  "cal.in7": "Viikon päästä",
  "cal.k.exam": "Koe",
  "cal.k.homework": "Kotitehtävä",
  "cal.k.practical": "Käytännön harjoitus",
  "cal.k.language": "Kieli",
  "cal.k.aiSession": "Tekoälysessio",
  "cal.k.revision": "Kertaus",
  "cal.k.quiz": "Visailu",
  "cal.k.objective": "Tavoite",
  "cal.k.deadline": "Määräaika",
  "pred.title": "Ennakoiva kertaus",
  "pred.tileDetail": "Ennakoi unohtaminen ennen kuin se tapahtuu",
  "pred.intro": "Kerros FSRS:n päällä. FSRS kertoo, mikä on erääntynyt; tämä ennakoi, mitä unohdat — joten tekoäly toimii ennen sitä.",
  "pred.loading": "Ennustetaan unohtamiskäyriäsi...",
  "pred.fsrs": "FSRS: ”Sinun täytyy kerrata tänään.”",
  "pred.predictive": "Ennakoiva: ”Muutamassa päivässä unohtamisesi ylittää kynnyksen.”",
  "pred.empty": "Kaikki vakaata — mikään ei ole vaarassa unohtua pian.",
  "pred.in": "Sisällä",
  "pred.forgettingPass": "unohtamisesi ylittää",
  "pred.now": "nyt",
  "pred.today": "tänään",
  "pred.oneDay": "1 päivä",
  "pred.days": "päivää",
  "pred.reviewAhead": "🔁 Kertaa nyt pysyäksesi askeleen edellä",
  "notif.title": "Älykkäät ilmoitukset",
  "notif.tileDetail": "Pedagoginen, aina perusteltu",
  "notif.loading": "Valmistellaan ilmoituksiasi...",
  "notif.hello": "Hei",
  "notif.helloNoName": "Hei.",
  "notif.empty": "Ei huomautettavaa juuri nyt — olet aikataulussa.",
  "notif.review": "Lyhyt {m} minuutin kertaus aiheesta {s} tänään nostaisi osaamistasi {p} %.",
  "notif.exam": "Kokeesi ”{s}” on {d} päivän päästä. Järjestin suunnitelmasi uudelleen automaattisesti.",
  "notif.unlock": "Hienoa työtä. Voimme nyt aloittaa osion {next}.",
  "notif.forecast": "{d} päivän päästä palauttamiskykysi aiheesta {s} laskee ja unohtaminen ylittää {p} %. Nopea kertaus nyt estää sen.",
  "notif.src.mastery": "Nykyisen osaamisesi perusteella",
  "notif.src.calendar": "Kalenteristasi",
  "notif.src.path": "Oppimispolultasi",
  "notif.src.forecast": "Ennakoivasta kertaamisesta",
  "notif.cta.review": "🔁 Aloita kertaaminen",
  "notif.cta.exam": "📅 Näytä suunnitelmani",
  "notif.cta.unlock": "🎓 Aloita nyt",
  "notif.cta.forecast": "🔮 Kertaa ennakkoon",
  "apath.title": "Mukautuva polku",
  "apath.tileDetail": "Tekoäly päättää oppimisjärjestyksesi",
  "apath.intro": "Kerro, mitä haluat oppia. Tarkistan tietoverkon ja osaamisesi ja päätän sitten oikean järjestyksen.",
  "apath.loading": "Ladataan käsitteitäsi...",
  "apath.thinking": "Lasketaan parasta järjestystä...",
  "apath.pickGoal": "Haluan oppia...",
  "apath.noConcepts": "Ei vielä käsitteitä — opiskele ensin jotain, aseta sitten tavoite.",
  "apath.verdictConsolidate": "Ennen kuin aloitat kohteen {target}, vahvistetaan kohdetta {list}. Ymmärrät sitä seuraavia asioita paljon paremmin.",
  "apath.verdictReady": "Kaikki on valmiina — voit aloittaa kohteen {target} heti!",
  "apath.and": "ja",
  "apath.a.ready": "Hallittu",
  "apath.a.consolidate": "Vahvistettava",
  "apath.a.target": "Tavoite",
  "profile.preferences": "Asetukset",
  "profile.languages": "Kielet",
  "profile.subscription": "Tilaus",
  "profile.aiSettings": "Tekoälyasetukset",
  "profile.notifications": "Ilmoitukset",
  "aiteacher.continue": "Tänään jatkamme",
  "aiteacher.work": "Tänään työstämme",
  "aiteacher.reviewFirst": "Mutta ensin kerrataan nopeasti",
  "aiteacher.startLesson": "Aloita oppitunti",
  "aiteacher.empty": "Olen opettajasi. Kerro, mitä haluat oppia, tai skannaa kurssi aloittaaksesi.",
  "aiteacher.ready": "Aina kun olet valmis.",
  "aiteacher.talkTitle": "Keskustele opettajasi kanssa",
  "aiteacher.topicPlaceholder": "Mistä haluat keskustella?",
  "aiteacher.talk": "Aloita keskustelu",
  "aiteacher.resume": "💬 Jatka keskustelua",
  "aiteacher.twinPick": "Anna opettajasi valita heikko kohtasi",
  "aiteacher.recent": "Viimeaikaiset keskustelut",
  "aiteacher.messages": "viestit",
  "aiteacher.focusedOn": "keskittyen aiheeseen",
  "aiteacher.untitled": "Nimetön keskustelu",
  "aiteacher.open": "Avaa",
  "aiteacher.finishedLesson": "Eilen saimme päätökseen oppitunnin aiheesta",
  "aiteacher.todayReview": "Tänään ehdotan kertaamista",
  "aiteacher.difficulties": "koska huomasin joitakin vaikeuksia.",
  "aiteacher.todayDiscover": "Tänään aloitamme aiheen",
  "aiteacher.thenNext": "Sitten siirrymme aiheeseen",
  "aiteacher.sessionCard": "Tämänkertainen sessio",
  "aiteacher.objective": "Tavoite",
  "aiteacher.duration": "Arvioitu kesto",
  "aiteacher.levelLabel": "Taso",
  "aiteacher.minutes": "min",
  "aiteacher.objReview": "Kertaa ja vakiinnuta",
  "aiteacher.objDiscover": "Ymmärrä",
  "aiteacher.readyQ": "Valmis?",
  "aiteacher.start": "▶  Aloita",
  "level.beginner": "Aloittelija",
  "level.intermediate": "Keskitaso",
  "level.advanced": "Edistynyt",
  "lesson.opening": "Avataan oppituntiasi…",
  "lesson.pitchedAt": "taso, räätälöity sinulle",
  "lesson.objectives": "Tavoitteet",
  "lesson.introduction": "Johdanto",
  "lesson.concept": "Käsite",
  "lesson.explanation": "Selitys",
  "lesson.objectiveLabel": "Tavoite",
  "lesson.example": "Esimerkki",
  "lesson.keyPoints": "Keskeiset oivallukset",
  "lesson.examples": "Esimerkit",
  "lesson.questions": "Kysymykset",
  "lesson.exercises": "Harjoitukset",
  "lesson.correction": "Korjaus",
  "lesson.summary": "Yhteenveto",
  "lesson.flashcards": "Muistikortit",
  "lesson.revision": "Kertaus",
  "lesson.homework": "Kotitehtävä",
  "lesson.reflect": "Pohdi näitä ennen kuin jatkat.",
  "lesson.readAloud": "Lue tämä minulle",
  "lesson.yourAnswer": "Vastauksesi",
  "lesson.submit": "Lähetä vastaus",
  "lesson.answerAgain": "Vastaa uudelleen",
  "lesson.correct": "✓ Oikein",
  "lesson.notQuite": "✗ Ei ihan",
  "lesson.feedback": "Palaute",
  "lesson.rootCause": "Perussyy",
  "lesson.showCorrections": "Näytä mallivastaukset",
  "lesson.hideCorrections": "Piilota mallivastaukset",
  "lesson.reveal": "Napauta paljastaaksesi",
  "lesson.noFlashcards": "Ei muistikortteja tälle oppitunnille.",
  "lesson.cardsScheduled": "muistikorttia on ajoitettu kertausjonoosi.",
  "lesson.reviewNow": "Kertaa nyt",
  "lesson.savePdf": "📄 Tallenna PDF:nä",
  "lesson.doHomework": "📝 Tee kotitehtäväni",
  "lesson.step": "Vaihe",
  "lesson.of": "/",
  "lesson.continue": "Jatka",
  "lesson.previous": "Takaisin",
  "lesson.finish": "Päätä oppitunti",
  "lesson.finishSession": "Lopeta istunto",
  "lesson.why": "Miksi?",
  "lesson.how": "Miten?",
  "lesson.errorMade": "Mikä virhe?",
  "lesson.howToAvoid": "Miten välttää se?",
  "exercise.qcm": "Monivalinta",
  "exercise.open": "Avoin kysymys",
  "exercise.exercise": "Harjoitus",
  "exercise.case": "Käytännön tapaus",
  "lesson.scheduleIn": "Ajastan tämän kertauksen",
  "lesson.days": "päivän päähän",
  "lesson.day": "päivä",
  "lesson.scheduleWhy": "Miksi? Koska hajautettu kertaus ennustaa, milloin unohdat — ja kertaa kanssasi juuri ennen sitä.",
  "lesson.scheduleNow": "Nämä kortit ovat valmiina. Kertaa ne, niin ajastan seuraavan juuri sillä hetkellä, kun olet unohtamaisillasi.",
  "aiteacher.yesterday": "Eilen käsiteltiin",
  "aiteacher.beforeContinuing": "Ennen kuin jatkamme, kerrataan keskeiset ideat.",
  "lang.dialogue": "Vuoropuhelu",
  "lang.dialogueHelp": "Lyhyt käsikirjoitettu keskustelu opiskeltavaksi.",
  "lang.scenarioPlaceholder": "Tilanne (valinnainen) – esim. torilla",
  "lang.generateDialogue": "Luo vuoropuhelu",
  "lang.essay": "Korjaa kirjoitukseni",
  "lang.essayHelp": "Kirjoita muutama lause, niin korjaan ne kuin opettaja.",
  "lang.essayPlaceholder": "Kirjoita tekstisi tähän…",
  "lang.correctEssay": "Korjaa se",
  "lang.assessment": "Arviointi",
  "lang.correctedVersion": "Korjattu versio",
  "lang.noMistakes": "Ei virheitä — hienoa työtä!",
  "coach.title": "Valmentajasi",
  "coach.suggestToday": "Tänään ehdotan:",
  "coach.min": "min",
  "coach.why": "Miksi?",
  "mentor.why": "Miksi ehdotan tätä",
  "mentor.act": "Tehdään se",
  "mentor.dismiss": "Ei nyt",
  "coachp.title": "Akateeminen valmentajani",
  "coachp.tileDetail": "Tahti, vaikeusaste ja menetelmä – mukautettu sinulle",
  "coachp.loading": "Luetaan oppimistottumuksiasi…",
  "coachp.state": "Tilanteesi",
  "coachp.streak": "Putki",
  "coachp.discipline": "Kurinalaisuus",
  "coachp.week": "Tämä viikko",
  "coachp.mastery": "Hallinta",
  "coachp.goals": "Tavoitteet",
  "coachp.pace": "Tahti",
  "coachp.difficulty": "Vaikeusaste",
  "coachp.method": "Menetelmä",
  "coachp.session": "Istunnon kesto",
  "coachp.byCoach": "Valmentaja",
  "coachp.byYou": "Valintasi",
  "coachp.reset": "Anna takaisin valmentajalle",
  "coachp.pace.gentle": "Lempeä",
  "coachp.pace.steady": "Tasainen",
  "coachp.pace.intensive": "Intensiivinen",
  "coachp.diff.beginner": "Aloittelija",
  "coachp.diff.intermediate": "Keskitaso",
  "coachp.diff.advanced": "Edistynyt",
  "coachp.method.practice": "Harjoitus",
  "coachp.method.reading": "Lukeminen",
  "coachp.method.socratic": "Sokraattinen",
  "coachp.method.mixed": "Sekalainen",
  "coachp.disc.strong": "Vahva",
  "coachp.disc.building": "Muodostumassa",
  "coachp.disc.irregular": "Epäsäännöllinen",
  "coach.forgetting": "Unohdat vähitellen",
  "risk.title": "Ennakointi",
  "risk.tileDetail": "Tulevat riskit – ennen kuin ne toteutuvat",
  "risk.loading": "Luetaan tilannetta…",
  "risk.intro": "Katson eteenpäin ja merkitsen polullasi olevat riskit, jotta voimme toimia ennen kuin niistä tulee ongelmia.",
  "risk.calm": "Ei akuutteja riskejä tällä hetkellä – olet hyvällä tielöä.",
  "risk.cause": "Todennäköinen syy",
  "risk.action": "Suositeltu toiminta",
  "risk.why": "Tämän taustalla olevat merkit",
  "risk.kind.dropout": "Keskeyttämisriski",
  "risk.kind.difficulty": "Tulevia vaikeuksia",
  "risk.kind.overload": "Ylikuormitus",
  "risk.kind.motivation": "Motivaation lasku",
  "risk.kind.forgetting": "Todennäköinen unohtaminen",
  "risk.level.low": "Matala",
  "risk.level.moderate": "Kohtalainen",
  "risk.level.high": "Korkea",
  "reco.title": "Sinulle",
  "reco.tileDetail": "Oppitunteja, harjoituksia, luettavaa – valittu sinulle",
  "reco.loading": "Valitaan sinulle sopivaa…",
  "reco.intro": "Henkilökohtaisia ehdotuksia kaikesta, mitä voit tehdä seuraavaksi – jokaisella on perustelu.",
  "reco.empty": "Ei ehdotuksia tällä hetkellä – palaa asiaan opiskeltuasi hieman enemmän.",
  "reco.accept": "Tehdään se",
  "reco.dismiss": "Ei nyt",
  "reco.kind.lesson": "Uusi oppitunti",
  "reco.kind.exercise": "Harjoitukset",
  "reco.kind.reading": "Lukeminen",
  "reco.kind.review": "Kertaus",
  "reco.kind.practical": "Käytännön",
  "reco.kind.document": "Dokumentti",
  "ment.title": "Tekoälymentori",
  "ment.tileDetail": "Rehellistä ohjausta siitä, miten sinulla todellisuudessa menee",
  "ment.loading": "Otetaan askel taaksepäin ja tarkastellaan kokonaiskuvaa…",
  "ment.intro": "Pitemmälle kuin tämän päivän oppitunti – rehellinen arvio menestyksestäsi, tenttivalmisteluistasi, organisoinnistasi, menetelmästäsi ja luottamuksestasi.",
  "ment.focus": "Keskittyminen",
  "ment.why": "Mihin perustan tämän",
  "ment.dim.success": "Akateeminen menestys",
  "ment.dim.exams": "Tenttivalmistelut",
  "ment.dim.organization": "Organisointi",
  "ment.dim.method": "Työskentelytapa",
  "ment.dim.confidence": "Luottamus",
  "ment.rating.good": "Hyvällä mallilla",
  "ment.rating.building": "Muodostumassa",
  "ment.rating.concern": "Vaatii työtä",
  "succ.title": "Menestysennuste",
  "succ.tileDetail": "Mahdollisuutesi per tentti – ja miten parantaa niitä",
  "succ.loading": "Arvioidaan tenttivalmiuttasi…",
  "succ.intro": "Jokaiselle tentille: kuinka hyvin olet valmistautunut, arvioidut mahdollisuutesi ja luottamukseni taso.",
  "succ.note": "Tavoite ei ole ennustaa tulevaisuutta – vaan auttaa sinua valmistautumaan paremmin.",
  "succ.empty": "Ei tulevia tenttejä – lisää tentti nähdäksesi valmiutesi.",
  "succ.preparation": "Valmistautuminen",
  "succ.probability": "Menestymismahdollisuudet",
  "succ.confidence": "Mallin luottamus",
  "succ.advice": "Miten valmistautua",
  "succ.why": "Tekijät",
  "succ.in": "päässä",
  "succ.days": "päivää",
  "succ.today": "tänään",
  "succ.band.low": "matala",
  "succ.band.medium": "keskitaso",
  "succ.band.high": "korkea",
  "ic.title": "Älykkyyskeskus",
  "ic.metricValue": "Vahvuudet, edistyminen, seuraavat askeleet",
  "ic.loading": "Kootaan älykkyyttäsi yhteen…",
  "ic.intro": "Kaikki, mitä tekoäly on oppinut sinusta – vahvuudet, heikkoudet, edistyminen, tavat, suoriutuminen ja kehityskohteet. Aina perustelujen kera.",
  "ic.cat.strengths": "Vahvuudet",
  "ic.cat.weaknesses": "Heikkoudet",
  "ic.cat.progress": "Edistyminen",
  "ic.cat.habits": "Tavat",
  "ic.cat.performance": "Suoriutuminen",
  "ic.cat.improvement": "Kehityskohteet",
  "dna.title": "Oppimis-DNA",
  "dna.metricValue": "Miten opit parhaiten",
  "dna.loading": "Jäsennetään oppimis-DNA:ta…",
  "dna.intro": "Syvä ja vakaa oppimisprofiilisi – miten muistat, milloin olet parhaimmillasi, sekä sinulle sopivat muodot ja menetelmät. Se tarkentuu opiskellessasi.",
  "dna.maturity": "DNA kartoitettu",
  "dna.interactions": "vuorovaikutusta opittu",
  "dna.trait.memory": "Miten muistat",
  "dna.trait.peakTime": "Huippuaika",
  "dna.trait.modality": "Oppimismenetelmä",
  "dna.trait.explanation": "Selityksen syvyys",
  "dna.trait.retentionFormat": "Parhaiten säilyvä muoto",
  "dna.band.emerging": "orastava",
  "dna.band.forming": "muotoutuva",
  "dna.band.established": "vakiintunut",
  "sync.title": "Synkronointikeskus",
  "sync.tileDetail": "Työskentele ilman verkkoyhteyttä – muutokset synkronoidaan, kun palaat verkkoon",
  "sync.intro": "Jatka työskentelyä ilman yhteyttä. Muutoksesi tallennetaan ja synkronoidaan automaattisesti, kun palaat verkkoon.",
  "sync.online": "Verkossa",
  "sync.online.detail": "Yhdistetty – muutokset synkronoidaan välittömästi.",
  "sync.offline": "Offline",
  "sync.offline.detail": "Ei yhteyttä – muutokset tallennetaan ja synkronoidaan automaattisesti.",
  "sync.pending": "Odottavat muutokset",
  "sync.last": "Viimeisin synkronointi",
  "sync.never": "Ei koskaan",
  "sync.now": "Synkronoi nyt",
  "sync.note": "Luvut tallennetaan välimuistiin, jotta tietosi näkyvät offline-tilassa; kirjoitukset asetetaan jonoon ja suoritetaan järjestyksessä, kun yhteys palautuu.",
  "mon.title": "Valvonta",
  "mon.tileDetail": "Järjestelmän tila – liikenne, viive, tekoäly, välimuisti",
  "mon.loading": "Luetaan järjestelmän tilaa…",
  "mon.intro": "Alustan reaaliaikainen tila prosessinsisäisistä mittareista (viedään myös Prometheukseen).",
  "mon.http": "HTTP-liikenne",
  "mon.requests": "pyyntöä",
  "mon.errorRate": "virhetaso",
  "mon.ai": "tekoälykutsut",
  "mon.aiCalls": "kutsua",
  "mon.errors": "virhettä",
  "mon.avgLatency": "keskimääräinen viive",
  "mon.byModel": "Mallin mukaan",
  "mon.cache": "Välimuisti",
  "mon.hitRate": "osumaosuus",
  "mon.hits": "osumia",
  "mon.misses": "huteja",
  "mon.process": "Prosessori",
  "mon.memory": "muisti",
  "mon.heap": "kekoa",
  "mon.uptime": "käytettävyysaika",
  "mon.note": "Virheet siirtyvät myös Sentry/OpenTelemetry-saumaan (käytössä, kun DSN on määritetty). Prometheus kerää GET /metrics.",
  "lm.title": "Kielet",
  "lm.manage": "Hallitse kieliä",
  "lm.intro": "Kaikki käyttöliittymän kielet ja niiden käännösten valmiusaste. Kielen vaihtaminen vaihtaa myös tekoälyopettajan kielen.",
  "lm.active": "Aktiivinen",
  "lm.translated": "käännetty",
  "lm.fallback": "loput palaavat oletuksena englanniksi",
  "lm.note": "Uusia kieliä lisätään pudottamalla resurssitiedosto mukaan – sovelluksen koodia ei tarvitse muuttaa. Kääntämättömät avaimet palautuvat automaattisesti englanniksi.",
  "aim.title": "Tekoälyntarjoajat",
  "aim.tileDetail": "Usean mallin operaattori – valitse paras / halvin / nopein",
  "aim.loading": "Luetaan tekoälyinfrastruktuuria…",
  "aim.intro": "Käytettävissä olevat tekoälytaustajärjestelmät ja strategia, joka valitsee niiden väliltä. Vaihtaminen ohjaa jokaisen tekoälykutsun uudelleen.",
  "aim.strategy": "Strategia",
  "aim.active": "Aktiivinen tarjoaja",
  "aim.catalog": "Tarjoajat",
  "aim.ready": "Valmis",
  "aim.off": "Pois päältä",
  "aim.cost": "hinta",
  "aim.speed": "nopeus",
  "aim.quality": "laatu",
  "aim.vision": "näkökyky",
  "aim.strat.quality": "Paras",
  "aim.strat.cost": "Halvin",
  "aim.strat.speed": "Nopein",
  "aim.strat.balanced": "Tasapainoinen",
  "plg.title": "Laajennukset",
  "plg.tileDetail": "Tilat, liittimet ja tekoälymoottorit – tiekartta",
  "plg.loading": "Ladataan laajennuksia…",
  "plg.intro": "Kaikki se, miksi Second Brain voi kasvaa – jokainen on liitännäinen, joka rekisteröityy koskematta ytimeen.",
  "plg.active": "Aktiivinen",
  "plg.available": "Saatavilla",
  "plg.planned": "Suunnitteilla",
  "plg.requires": "Vaatii",
  "plg.note": "Liitännäismoottorin ansiosta uusia Brain-ominaisuuksia, liittimiä ja tekoälymoottoreita voidaan lisätä ilman suurta uudelleenkirjoitusta – sovellus voi kehittyä vuosia.",
  "coach.upToDate": "Olet ajan tasalla – mikään ei unohdu juuri nyt.",
  "coach.score": "Oppimispisteet",
  "coach.wouldRaise": "Tämä kertaus nostaisi oppimispisteitäsi",
  "coach.points": "pistettä",
  "coach.newScore": "Ei vielä tarpeeksi dataa – aloita oppitunti kasvattaaksesi pisteitäsi.",
  "briefing.hello": "Hei",
  "briefing.analyzed": "Olen analysoinut edistymisesi.",
  "briefing.recommend": "Suosittelen tänne:",
  "briefing.achievable": "Voit saavuttaa tavoitteesi {n} minuutissa.",
  "briefing.start": "Aloita istunto",
  "briefing.min": "min",
  "briefing.k.review": "Kertaus",
  "briefing.k.lesson": "Uusi oppitunti",
  "briefing.k.vocabulary": "Sanasto",
  "briefing.upToDate": "Olet ajan tasalla – ei mitään kiireellistä tänään. Lyhyt kertaus auttaa silti.",
  "homework.title": "Kotitehtävä",
  "homework.preparing": "Valmistellaan yksilöllistä kotitehtävääsi…",
  "homework.focusLabel": "Miksi tämä kotitehtävä",
  "homework.masteryAt": "Mukautettu nykyiselle tasollesi:",
  "homework.exercises": "Harjoitukset",
  "homework.questions": "Kysymykset",
  "homework.correction": "Korjaus",
  "homework.reflect": "Pohdi näitä – ei arvosanaa, pelkkää pohdintaa.",
  "homework.showAnswers": "Näytä mallivastaukset",
  "homework.hideAnswers": "Piilota mallivastaukset",
  "homework.regenerate": "↻ Uusi kotitehtävä",
  "homework.regenHint": "Generoi uudelleen edistymisesi mukaan mukautettuna.",
  "homework.back": "Takaisin",
  "session.startGuided": "▶ Aloita ohjattu istuntoni",
  "session.welcome": "Istuntosi",
  "session.yourSession": "Päivän istunto",
  "session.defaultPlan": "Ohjaan sinut koko istunnon läpi vaihe vaiheelta ja päivitän digitaalisen kaksoisesi lopussa.",
  "session.thePlan": "Suunnitelma",
  "session.start": "▶ Aloita oppitunti",
  "session.noLesson": "Tällä istunnolla ei ole vielä oppituntia.",
  "session.home": "Takaisin etusivulle",
  "session.closing": "Suljetaan istuntoa ja päivitetään digitaalista kaksoistasi…",
  "session.done": "Istunto valmis",
  "session.whatWeDid": "Mitä teimme",
  "session.twinUpdate": "Digitaalisen kaksosen päivitys",
  "session.before": "Ennen",
  "session.after": "Jälkeen",
  "session.points": "pistettä",
  "session.conceptMastery": "Tämän käsitteen hallinta:",
  "session.nowTracked": "Digitaalinen kaksoisesi seuraa nyt tätä käsitettä.",
  "session.results": "Tulokset",
  "session.exercisesRight": "harjoitusta oikein",
  "session.cardsScheduled": "muistikorttia ajastettu (FSRS)",
  "session.nextReview": "Seuraava kertaus:",
  "session.reviewNow": "🔁 Kertaa nyt",
  "session.today": "tänään",
  "session.tomorrow": "huomenna",
  "session.inDays": "päivää",
  "session.stageLesson": "Oppitunti",
  "session.stageQuestions": "Kysymykset",
  "session.stageExercises": "Harjoitukset",
  "session.stageCorrection": "Korjaus",
  "session.stageSummary": "Yhteenveto",
  "session.stageFlashcards": "Muistikortit",
  "session.stageFsrs": "FSRS-aikataulutus",
  "session.stageTwin": "Digitaalisen kaksosen päivitys",
  "twin.title": "Digitaalinen kaksois",
  "twin.intro": "Oppimisprofiilisi – se kehittyy jokaisen vuorovaikutuksen jälkeen.",
  "twin.loading": "Luetaan digitaalista kaksostasi…",
  "twin.notEnough": "Ei vielä tarpeeksi tietoa",
  "twin.progress": "Kokonaisedistyminen",
  "twin.conceptsTracked": "käsitettä seurannassa",
  "twin.lessons": "oppituntia",
  "twin.evolves": "Oppii jatkuvasti",
  "twin.interactions": "vuorovaikutusta tähän mennessä",
  "twin.level": "Todellinen taso",
  "twin.speed": "Oppimisnopeus",
  "twin.subjects": "Suosikkiaiheet",
  "twin.style": "Oppimistyyli",
  "twin.depth": "Selityksen syvyys",
  "twin.language": "Ensisijainen kieli",
  "twin.rhythm": "Työrytmi",
  "twin.focus": "Keskittymistunnit",
  "twin.band.new": "Juuri aloittamassa",
  "twin.band.weak": "Hauras",
  "twin.band.building": "Rakentuva",
  "twin.band.strong": "Vahva",
  "twin.speed.building": "Rakentuu",
  "twin.speed.steady": "Vakaa",
  "twin.speed.fast": "Nopea",
  "twin.style.voice": "Puhuttu",
  "twin.style.handsOn": "Käytännönläheinen",
  "twin.style.reading": "Lukeminen",
  "twin.depth.simple": "Yksinkertainen, vaihe vaiheelta",
  "twin.depth.balanced": "Tasapainoinen",
  "twin.depth.deep": "Syvällinen",
  "twin.rhythm.occasional": "Satunnainen",
  "twin.rhythm.regular": "Säännöllinen",
  "twin.rhythm.intensive": "Intensiivinen",
  "twin.focus.morning": "Aamu",
  "twin.focus.afternoon": "Iltapäivä",
  "twin.focus.evening": "Ilta",
  "twin.focus.night": "Yö",
  "memory.title": "Oppimismuisti",
  "memory.intro": "Kaikki tekemäsi – jotta tekoäly ei aloita nollasta.",
  "memory.loading": "Avataan oppimismuistia…",
  "memory.remembered": "muistettua asiaa",
  "memory.timeline": "Aikajana",
  "memory.empty": "Ei vielä muistoja – aloita oppitunti, niin se näkyy täällä.",
  "memory.exercises": "Tehtävät",
  "memory.successes": "Onnistumiset",
  "memory.errors": "Virheet",
  "memory.revisions": "Kertaukset",
  "memory.conversations": "Keskustelut",
  "memory.homework": "Kotitehtävä",
  "memory.reports": "Raportit",
  "memory.documents": "Asiakirjat",
  "memory.k.lesson": "Oppitunti",
  "memory.k.success": "Onnistuminen",
  "memory.k.error": "Virhe",
  "memory.k.revision": "Kertaus",
  "memory.k.conversation": "Keskustelu",
  "memory.k.homework": "Kotitehtävä",
  "memory.k.report": "Istuntoraportti",
  "memory.k.document": "Asiakirja",
  "mastery.title": "Käsitteiden hallinta",
  "mastery.intro": "Jokainen käsite saa pisteytyksen – kiireellisimmät kerrattava ensin.",
  "mastery.loading": "Pisteytetään käsitteitäsi…",
  "mastery.empty": "Ei vielä käsitteitä – opiskele käsitteeseen liittyvä oppitunti nähdäksesi sen pisteytyksen.",
  "mastery.mastery": "Hallinta",
  "mastery.confidence": "Itsevarmuus",
  "mastery.errors": "Virheet",
  "mastery.forgetting": "Unohtaminen",
  "mastery.priority": "Kertausprioriteetti",
  "mastery.conf.low": "Matala",
  "mastery.conf.medium": "Keskitaso",
  "mastery.conf.high": "Korkea",
  "mastery.err.none": "Ei mitään",
  "mastery.err.low": "Harvinainen",
  "mastery.err.high": "Usein",
  "mastery.prio.low": "Matala",
  "mastery.prio.medium": "Keskitaso",
  "mastery.prio.high": "Korkea",
  "mastery.prio.urgent": "Kiireellinen",
  "graph.title": "Tietoverkko",
  "graph.intro": "Miten käsitteesi riippuvat toisistaan – perusteet ensin.",
  "graph.loading": "Kartoitetaan käsitteitäsi…",
  "graph.empty": "Ei vielä käsitteitä – opiskele joitakin ja linkitä ne nähdäksesi kaavion.",
  "graph.s.mastered": "Hallittu",
  "graph.s.in_progress": "Kesken",
  "graph.s.ready": "Valmis",
  "graph.s.at_risk": "Vaarassa",
  "graph.s.blocked": "Estetty",
  "sw.title": "Vahvuudet ja heikkoudet",
  "sw.intro": "Missä olet vahva ja mikä lipsuu alta — tekoäly suunnittelee seuraavat sessiosi tämän pohjalta.",
  "sw.loading": "Arvioidaan käsitteitäsi…",
  "sw.strengths": "Vahvuudet",
  "sw.weaknesses": "Heikkoudet",
  "sw.noStrengths": "Ei vielä vahvoja käsitteitä — jatka samaan malliin!",
  "sw.noWeaknesses": "Mikään ei lipsu tällä hetkellä. Hienoa työtä!",
  "sw.aiNote": "Tekoäly keskittää seuraavat sessiosi ensin näihin heikkoihin kohtiin.",
  "sw.startWeakest": "▶ Työstä heikkoja kohtia",
  "rec.title": "Suositukset",
  "rec.intro": "Mentorisi seuraavat askeleet – ei vain analyysiä, vaan ohjeita siitä, mitä tehdä nyt.",
  "rec.loading": "Mietitään seuraavaa askelettasi…",
  "rec.empty": "Ei vielä mitään suositeltavaa — opiskele hieman, niin opastan sinua.",
  "rec.review": "Suosittelen {m} minuutin kertausta aiheesta {s}.",
  "rec.consolidate": "Vahvista aihetta {s}, ennen kuin otat vastaan mitään uutta.",
  "rec.levelUp": "Olet hallinnut aiheen {s} — valmiina seuraavalle tasolle.",
  "rec.advance": "Kaikki on kunnossa – olet valmis oppimaan jotain uutta.",
  "rec.cta.review": "🔁 Kertaa nyt",
  "rec.cta.consolidate": "🧱 Vahvista",
  "rec.cta.levelUp": "🎓 Nouse tasoa",
  "rec.cta.advance": "🚀 Opi jotain uutta",
  "insight.title": "Tekoälyn oivallukset",
  "insight.intro": "Miksi tekoäly ehdottaa sitä, mitä ehdottaa – perustuu todelliseen aktiivisuuteesi.",
  "insight.loading": "Luetaan signaaleja…",
  "insight.empty": "Ei vielä tarpeeksi aktiivisuutta — opiskele hieman, niin oivalluksia ilmestyy.",
  "insight.days": "päivää",
  "insight.interactions": "vuorovaikutusta",
  "insight.strengthA": "Edistyt hyvin aiheessa",
  "insight.forgetA": "Taipumuksesi on unohtaa",
  "insight.forgetB": "noin",
  "insight.atRiskA": "Unohdat",
  "insight.atRiskB": "— kertaa se ensin.",
  "insight.focusA": "Opit parhaiten välillä",
  "insight.focusB": "ja",
  "insight.accA": "Vastaat",
  "insight.accB": "harjoituksistasi oikein.",
  "insight.rhythmA": "Olet työskennellyt",
  "insight.styleA": "Opit parhaiten",
  "insight.rhythm.occasional": "satunnaisesti",
  "insight.rhythm.regular": "säännöllisesti",
  "insight.rhythm.intensive": "intensiivisesti",
  "insight.style.voice": "kuuntelemalla",
  "insight.style.handsOn": "harjoittelemalla",
  "insight.style.reading": "lukemalla",
  "tutor.discussion": "Keskustelu",
  "tutor.opening": "Avataan keskustelua…",
  "tutor.focusedOn": "Keskittynyt aiheeseen",
  "tutor.placeholder": "Kysy opettajaltasi…",
  "tutor.send": "Lähetä",
  "tutor.slower": "🐢 Hitaammin",
  "tutor.faster": "🐇 Nopeammin",
  "tutor.slowerMsg": "Voitko hidastaa ja selittää sen yksinkertaisemmin?",
  "tutor.stopSend": "Pysäytä ja lähetä",
  "tutor.cancel": "Peruuta",
  "tutor.speak": "🎤 Puhu sen sijaan",
  "tutor.voiceUnsupported": "Ääni vaatii mikrofonin – ei saatavilla tällä alustaversiolla vielä.",
  "tutor.recording": "Tallennetaan… puhu ja pysäytä sitten.",
  "tutor.you": "Sinä",
  "tutor.teacher": "Opettaja",
  "tutor.spoken": "🎤 puhuttu",
  "tutor.transcribing": "Tämän vuoron oppitunnin litterointi, vastaaminen ja kirjoittaminen jää taakse…",
  "tutor.teacherSpeaking": "🔊 Opettaja vastaa ääneen…",
  "tutor.heard": "Kuultu:",
  "tutor.filedA": "— kirjallinen oppitunti",
  "tutor.filedInto": "tallennettiin muistiisi käyttäen",
  "tutor.flashcards": "muistikortteja",
  "tutor.groundedPre": "Perustuu",
  "tutor.groundedPassage": "katkelma",
  "tutor.groundedPassages": "katkelmaa",
  "tutor.groundedPost": "muistiinpanoistasi:",
  "header.lesson": "Oppitunti",
  "header.newLesson": "Uusi oppitunti",
  "header.aiTeacher": "Tekoälyopettaja",
  "header.teacher": "Opettaja",
  "header.homework": "Kotitehtävä",
  "header.session": "Opiskelusessio",
  "header.twin": "Digitaalinen kaksonen",
  "header.memory": "Oppimismuisti",
  "header.mastery": "Käsitteiden hallinta",
  "header.graph": "Tietoverkko",
  "header.strengths": "Vahvuudet ja heikkoudet",
  "header.insights": "Tekoälyn oivallukset",
  "header.recommend": "Suositukset",
  "header.revEngine": "Kertausmoottori",
  "header.planner": "Opiskelusuunnittelija",
  "header.daily": "Päivittäinen sessio",
  "header.calendar": "Älykäs kalenteri",
  "header.predictions": "Ennakoiva kertaus",
  "header.notifications": "Älykkäät ilmoitukset",
  "header.adaptivePath": "Mukautuva polku",
  "header.goals": "Tavoitteet",
  "header.exams": "Tulevat kokeet",
  "header.library": "Kirjasto",
  "header.document": "Dokumentti",
  "header.ask": "Kysy kirjastoltani",
  "header.resource": "Opiskeluaineisto",
  "header.workspace": "Akateeminen työtila",
  "lib.title": "Kirjasto",
  "lib.tileDetail": "Elävä, tekoälyn järjestämä kirjastosi",
  "lib.intro": "Tekoäly ymmärtää jokaisen lisäämäsi dokumentin: tiivistelmä, aihe, kieli, käsitteet ja vaikeusaste — kaikki automaattisesti.",
  "lib.loading": "Avataan kirjastoasi…",
  "lib.all": "Kaikki",
  "lib.favorites": "Suosikit",
  "lib.recent": "Viimeisimmät",
  "lib.shared": "Jaetut",
  "lib.trash": "Roskakori",
  "lib.subjects": "Aiheet",
  "lib.languages": "Kielet",
  "lib.collections": "Kokoelmat",
  "lib.empty": "Ei vielä dokumentteja täällä.",
  "lib.sharedSoon": "Jakaminen tulee myöhemmässä vaiheessa — mitään ei ole vielä jaettu.",
  "lib.analysing": "Tekoäly analysoi tätä dokumenttia edelleen…",
  "lib.pipelineRunning": "Automaattinen käsittely…",
  "lib.stage.cleaning": "Puhdistetaan",
  "lib.stage.segmenting": "Lohkotaan",
  "lib.stage.embedding": "Upotukset",
  "lib.stage.indexing": "Indeksoidaan",
  "lib.stage.graphing": "Tietoverkko",
  "lib.add": "＋ Lisää",
  "lib.scan": "Skannaa",
  "lib.addText": "📝 Teksti",
  "lib.addUrl": "🔗 URL-osoite",
  "lib.addTitle": "Otsote",
  "lib.addBody": "Liitä muistiinpanosi / tekstisi tähän…",
  "lib.addBtn": "Lisää kirjastoon",
  "lib.addFile": "📄 Tuo tiedosto (PDF, txt, md)",
  "lib.addTextRequired": "Otsikko ja teksti vaaditaan.",
  "lib.addUrlRequired": "URL-osoite vaaditaan.",
  "lib.diff.beginner": "Aloittelija",
  "lib.diff.intermediate": "Keskitaso",
  "lib.diff.advanced": "Edistynyt",
  "lib.status.pending": "Jonossa",
  "lib.status.processing": "Analysoidaan",
  "lib.status.ready": "Valmis",
  "lib.status.failed": "Epäonnistui",
  "lib.summary": "AI-tiivistelmä",
  "lib.concepts": "Tunnistetut käsitteet",
  "lib.noConcepts": "Ei vielä tunnistettuja käsitteitä – napauta \"Tunnista käsitteet\".",
  "lib.content": "Sisältö",
  "lib.unknown": "Ei havaittu",
  "lib.chars": "merkiä",
  "lib.m.subject": "Aihe",
  "lib.m.language": "Kieli",
  "lib.m.difficulty": "Vaikeusaste",
  "lib.m.author": "Tekijä",
  "lib.m.collection": "Kokoelma",
  "lib.m.added": "Lisätty",
  "lib.m.size": "Koko",
  "lib.reanalyse": "🤖 Analysoi uudelleen",
  "lib.detectConcepts": "🧩 Tunnista käsitteet",
  "lib.restore": "♻️ Palauta",
  "lib.moveToTrash": "🗑️ Siirrä roskakoriin",
  "lib.deleteForever": "Poista pysyvästi",
  "lib.askLibrary": "Kysy",
  "lib.askThisDoc": "❓ Kysy tästä asiakirjasta",
  "lib.ask.title": "Kysy kirjastoltani",
  "lib.ask.intro": "Esitä kysymys – vastataan vain omista asiakirjoistasi, viitaten lähdeosiin. Ei mitään keksittyä.",
  "lib.ask.scope": "Hae kohteesta",
  "lib.ask.all": "Koko kirjasto",
  "lib.ask.thisDoc": "Tämä asiakirja",
  "lib.ask.placeholder": "esim. Mitkä ovat fotosynteesin vaiheet?",
  "lib.ask.btn": "Kysy",
  "lib.ask.answer": "Vastaus",
  "lib.ask.noContext": "Tältä alueelta ei löytynyt mitään olennaista – kokeile toista kysymystä tai laajenna aluetta.",
  "lib.ask.sources": "Lähteet",
  "lib.u.title": "Tekoälyn ymmärrys",
  "lib.u.summarize": "Tiivistä",
  "lib.u.rephrase": "Muotoile uudelleen",
  "lib.u.simplify": "Yksinkertaista",
  "lib.u.explain": "Selitä",
  "lib.u.adapted": "Mukautettu tasollesi:",
  "lib.u.compareTitle": "Vertaile",
  "lib.u.compare": "Vertaile toisen asiakirjan kanssa",
  "lib.u.noOther": "Ei vielä muuta asiakirjaa vertailtavaksi.",
  "lib.u.prereqTitle": "Esitiedot",
  "lib.u.reviewFirst": "Kertaa nämä ennen tämän asiakirjan opiskelua:",
  "lib.u.untracked": "ei seurattu",
  "lib.level.new": "uusi",
  "lib.level.beginner": "aloittelija",
  "lib.level.intermediate": "keskitaso",
  "lib.level.advanced": "edistynyt",
  "lib.r.title": "Opiskelumateriaalit",
  "lib.r.saved": "Tallennetut materiaalit",
  "lib.r.summary": "Yhteenveto",
  "lib.r.revisionSheet": "Kertausmoniste",
  "lib.r.flashcards": "Muistikortit",
  "lib.r.quiz": "Visailu",
  "lib.r.exercises": "Harjoitukset",
  "lib.r.openQuestions": "Avoimet kysymykset",
  "lib.r.coursePlan": "Kurssisuunnitelma",
  "lib.r.mindmap": "Miellekartta (tulossa pian)",
  "lib.r.review": "🎴 Kertaa nyt",
  "lib.workspace": "🎓 Akateeminen työtila",
  "ws.title": "Akateeminen työtila",
  "ws.analysing": "Opettaja analysoi tätä työtä…",
  "ws.analysisTitle": "Analyysi",
  "ws.levelAdapted": "mukautettu kohteeseen:",
  "ws.objectives": "Tavoitteet",
  "ws.skills": "Arvioitavat taidot",
  "ws.prerequisites": "Esitiedot",
  "ws.successCriteria": "Onnistumiskriteerit",
  "ws.keyNotions": "Keskeiset käsitteet",
  "ws.likelyHard": "Todennäköisesti vaikea sinulle",
  "ws.chooseMode": "Valitse ohjaustapa",
  "ws.mode.guide": "Ohjaus",
  "ws.mode.accompany": "Ratkaise yhdessä",
  "ws.mode.solve": "Koko ratkaisu",
  "ws.thinking": "Opettaja miettii…",
  "ws.placeholder": "Kysy, vastaa tai Jaa yrityksesi…",
  "ws.send": "Lähetä",
  "ws.finishTitle": "Muuta tämä työ oppimiseksi",
  "ws.finishHint": "Luo yhteenveto, muistikortit ja visailu tästä työstä – tallennettu kirjastoosi ja lisätty kertaukseesi.",
  "ws.generate": "Luo opiskelumateriaaleja",
  "ws.generated": "✅ Materiaalit luotu ja tallennettu – tarkista asiakirjan materiaalit.",
  "lib.integ.title": "Aivointegraatio",
  "lib.integ.summary": "Tämä asiakirja lisäsi {c} käsitettä, {ch} muistikatkelmaa ja {e} graafilinkkiä aivoihisi.",
  "lib.integ.new": "Uudet käsitteet",
  "lib.integ.known": "Jo tiedossa (muista asiakirjoista)",
  "lib.integ.mastered": "Jo hallinnassa",
  "lib.integ.fragile": "Vielä heikko",
  "lib.integ.prereq": "Esitiedot",
  "lib.integ.dependents": "Rakentaa kohti",
  "lib.integ.links": "Linkit olemassa olevaan tietoon",
  "goals.tileDetail": "Päivittäiset, viikoittaiset ja kuukausittaiset tavoitteet",
  "goals.title": "Tavoitteet",
  "goals.intro": "Mitä haluat saavuttaa? Aseta tavoitteet tälle päivälle, viikolle ja kuukaudelle.",
  "goals.placeholder": "esim. Viimeistele genetiikan luku",
  "goals.addBtn": "Lisää tavoite",
  "goals.daily": "Päivittäin",
  "goals.weekly": "Viikoittain",
  "goals.monthly": "Kuukausittain",
  "goals.none": "Ei vielä tavoitteita.",
  "goals.loading": "Ladataan tavoitteitasi…",
  "exams.tileDetail": "Aiheet, päivämäärät ja valmius",
  "exams.title": "Tulevat kokeet",
  "exams.intro": "Kokeesi järjestettynä päivämäärän mukaan. Valmius arvioidaan käsitetehallintasi perusteella.",
  "exams.placeholder": "Aihe (esim. Genetiikka)",
  "exams.addBtn": "Lisää koe",
  "exams.none": "Ei tulevia kokeita.",
  "exams.loading": "Ladataan kokeita...",
  "exams.prep": "Valmius",
  "exams.prepUnknown": "Ei vielä tarpeeksi dataa",
  "exams.p.high": "Korkea",
  "exams.p.medium": "Keskitaso",
  "exams.p.low": "Matala",
  "exams.in3": "3 päivän päästä",
  "exams.in7": "1 viikon päästä",
  "exams.in14": "2 viikon päästä",
  "exams.in30": "1 kuukauden päästä",
  "exams.past": "Menneet",
  "exams.today": "Tänään",
  "exams.tomorrow": "Huomenna",
  "exams.in": "päästä",
  "exams.days": "päivää",
  "header.languages": "Kielet",
  "header.language": "Kieli",
  "header.scan": "Skannaa kurssi",
  "header.revision": "Kertaus",
  "header.progress": "Edistyminen",
  "header.health": "Järjestelmän tila",
  "verdict.correct": "oikein",
  "verdict.partial": "osittain",
  "verdict.incorrect": "väärin",
  "rating.good": "hyvä",
  "rating.fair": "tyydyttävä",
  "rating.needs_work": "vaatii työtä",
  "examiner.title": "📝 AI Examiner",
  "examiner.intro": "Opettajasta tulee kuulustelijasi — se luo arvioinnin ja arvostelee sen selitysten ja neuvojen kera. Arvosana ei ole koskaan yksin.",
  "examiner.create": "Luo arviointi",
  "examiner.topicPlaceholder": "Aihe — esim. Ranskan vallankumous",
  "examiner.difficulty": "Vaikeusaste",
  "examiner.createTake": "Luo ja suorita",
  "examiner.emptyTitle": "Ei vielä arviointeja",
  "examiner.emptyDetail": "Valitse tyyppi ja aihe yltä — monivalintoja, avoimia kysymyksiä, esseitä, tehtäviä, tapaustutkimuksia, harjoituskokeita tai suullinen arviointi.",
  "examiner.questionsCount": "{n} kysymys(tä)",
  "examiner.scored": "pisteet {n}/100",
  "examiner.notTaken": "suorittamatta",
  "examiner.review": "Kertaa",
  "examiner.take": "Suorita",
  "examiner.levelWord": "taso",
  "examiner.question": "Kysymys",
  "examiner.points": "{n} piste(ttä)",
  "examiner.yourAnswer": "Vastauksesi...",
  "examiner.why": "Miksi: ",
  "examiner.how": "Miten: ",
  "examiner.mistake": "Virhe: ",
  "examiner.avoid": "Vältä tätä: ",
  "examiner.submit": "Lähetettävä arvioitavaksi",
  "examiner.next": "Mitä tehdä seuraavaksi",
  "examiner.back": "Takaisin arviointeihin",
  "examiner.t.mcq": "Monivalinta",
  "examiner.t.open": "Avoimet kysymykset",
  "examiner.t.dissertation": "Essee",
  "examiner.t.exercise": "Tehtävät",
  "examiner.t.case_study": "Tapaustutkimus",
  "examiner.t.mock_exam": "Harjoituskoe",
  "examiner.t.oral": "Suullinen arviointi",
  "writing.title": "✍️ Writing coach",
  "writing.intro": "Lähetä teksti — opettaja analysoi rakenteen, logiikan, selkeyden, oikeinkirjoituksen, kieliopin, argumentaation ja akateemisen laadun sekä selittää tarkasti, miten sitä voi parantaa.",
  "writing.new": "Uusi lähetys",
  "writing.titlePlaceholder": "Otsikko (valinnainen)",
  "writing.briefPlaceholder": "Tehtävänanto / ohje, johon vastataan (valinnainen)",
  "writing.textPlaceholder": "Liitä tekstisi tähän…",
  "writing.review": "Arvostele tekstini",
  "writing.emptyTitle": "Ei vielä lähetyksiä",
  "writing.emptyDetail": "Liitä esseesi, raporttisi, opinnäytetyösi tai muu kirjoituksesi yllä olevaan kenttään saadaksesi kattavan ja jäsennellyn arvion.",
  "writing.scored": "pisteet {n}/100",
  "writing.open": "Avaa arvio",
  "writing.reviewTitle": "Tekstin arviointi",
  "writing.works": "Mikä toimii",
  "writing.improve": "Parannusehdotukset: ",
  "writing.first": "Aloita näistä",
  "writing.back": "Takaisin kirjoittamiseen",
  "writing.t.redaction": "Essee",
  "writing.t.dissertation": "Pro gradu",
  "writing.t.memoire": "Opinnäytetyö",
  "writing.t.rapport": "Raportti",
  "writing.t.compte_rendu": "Tiivistelmä",
  "writing.t.devoir": "Kotitehtävä",
  "writing.d.structure": "Rakenne",
  "writing.d.logic": "Logiikka",
  "writing.d.clarity": "Selkeys",
  "writing.d.spelling": "Oikeinkirjoitus",
  "writing.d.grammar": "Kielioppi",
  "writing.d.argumentation": "Argumentaatio",
  "writing.d.academic_quality": "Akateeminen laatu",
  "reading.title": "📖 Lukuvalmentaja",
  "reading.intro": "Hanki tasollesi sopiva teksti ja ymmärtamistehtäviä. Valmentaja tarkistaa vastauksesi ja mukauttaa vaikeusastetta automaattisesti.",
  "reading.yourLevel": "Lukutasosi",
  "reading.topicPlaceholder": "Aihe (valinnainen) – esim. tulivuoret, talous…",
  "reading.generate": "Luo teksti",
  "reading.emptyTitle": "Ei vielä tekstejä",
  "reading.emptyDetail": "Luo ensimmäinen tekstisi yllä – taso mukautuu edistymisesi mukaan.",
  "reading.scored": "pisteet {n}/100",
  "reading.notTaken": "ei tehty",
  "reading.review": "Arvio",
  "reading.read": "Lue se",
  "reading.levelWord": "taso",
  "reading.question": "Kysymys",
  "reading.yourAnswer": "Vastauksesi…",
  "reading.mistake": "Virhe: ",
  "reading.avoid": "Vältä tätä: ",
  "reading.submit": "Lähetä vastaukset",
  "reading.back": "Takaisin lukemiseen",
  "reading.levelUp": "⬆ Taso nousi: {from} → {to}",
  "reading.levelDown": "⬇ Helpompi ensi kerralla: {from} → {to}",
  "reading.levelHeld": "Taso pysyi samana: {to}",
  "reading.lvl.beginner": "aloittelija",
  "reading.lvl.intermediate": "keskitaso",
  "reading.lvl.advanced": "edistynyt",
  "reading.lvl.expert": "asiantuntija",
  "lang.learnTitle": "Opi kieli",
  "lang.langPlaceholder": "Kieli (esim. espanja)",
  "lang.nativePlaceholder": "Äidinkielesi (käännöksiä varten)",
  "lang.teachingMode": "Opetustila",
  "lang.start": "Aloita",
  "lang.noLangsTitle": "Ei vielä kieliä",
  "lang.noLangsDetail": "Opettajasi lisää sanastoa tavalliseen kertausjonoosi, käy mukaansatempaavia keskusteluja ja arvioi, kuinka hyvin sinut ymmärretään lukiessasi ääneen.",
  "lang.fromNative": "kieleltä {native}",
  "lang.open": "Avaa",
  "lang.metaWords": "sanaa",
  "lang.metaDue": "erääntyy",
  "lang.metaLessons": "oppituntia",
  "lang.immersionBadge": "🌊 Upotus · ~{pct}% {lang}",
  "lang.immersionHelp": "Opettajasi pysyy kielessä {lang}, muotoilee uudelleen ja selittää lyhyesti, jos eksyt, ja palaa sitten kieleen {lang} — ja puhuu enemmän kieltä {lang} CEFR-tasosi noustessa.",
  "lang.skills": "Kielioppi, taivutus ja ymmärtäminen",
  "lang.skillsHelp": "Mukautettu CEFR-tasollesi ({level}). Jätä kenttä tyhjäksi, jotta opettaja voi valita, tai nimeä aihe tai verbi.",
  "lang.skillPlaceholder": "Aihe tai verbi (valinnainen) — esim. mennyt aika, être",
  "lang.grammar": "📖 Kielioppi",
  "lang.conjugation": "🔤 Taivutus",
  "lang.comprehension": "📝 Ymmärtäminen",
  "lang.listen": "🔊 Kuuntele (suullinen ymmärtäminen)",
  "lang.conversation": "Keskustelu",
  "lang.conversationHelp": "Harjoitukset toimivat tavallisella keskustelunäytölläsi — opettaja pysyy roolissaan eikä upotustilassa koskaan poistu kohdekielestä.",
  "lang.scenarioConvo": "Tilanne (valinnainen) — esim. apteekissa",
  "lang.startTalking": "Aloita puhuminen",
  "lang.vocabulary": "Sanasto",
  "lang.vocabularyHelp": "Liitä tähän mitä tahansa lukemaasi tekstiä. Sanoista tulee tavallisia FSRS-kortteja, joten ne näkyvät kerronajonossasi kaiken muun kanssa.",
  "lang.vocabPlaceholder": "Liitä tekstiä kohdekielelläsi…",
  "lang.mineVocab": "Kerää sanastoa",
  "lang.vocabResult": "Lisätty {n} uusi sana kerronajonoosi{had}.",
  "lang.vocabHad": " ({n} sinulla oli jo)",
  "lang.lesson": "Oppitunti",
  "lang.lessonPlaceholder": "Mitä käsitellään? esim. ruoan tilaaminen",
  "lang.writeLesson": "Luo minulle oppitunti",
  "lang.sayOutLoud": "Sano se ääneen",
  "lang.sayHelp": "Tämä mittaa, TUNNISTettiinko puheesi kyseiseksi ilmaisuksi — todellinen testi ymmärretyksi tulemisesta, ei aksenttipisteet.",
  "lang.phrasePlaceholder": "Ääneen luettava lause",
  "lang.needsMic": "Vaatii mikfronin — toistaiseksi vain verkkoselaimessa.",
  "lang.stopScore": "Lopeta ja arvioi",
  "lang.record": "🎤 Nauhoita",
  "lang.understoodPct": "{pct}% sanoista ymmärrettiin",
  "lang.heard": "Kuultiin: “{text}”",
  "lang.pronCoach": "Ääntämisvalmentaja",
  "lang.pronCoachHelp": "Puhu vapaasti — opettaja kuuntelee ja valmentaa sinua ääntämisessä, aksentissa, rytmissä, sujuvuudessa ja intonatiossa. Tavoitteena on tulla ymmärretyksi, ei täydellisyys.",
  "lang.coachContextPlaceholder": "Mistä puhutte? (valinnainen) — esim. esittele itsesi",
  "lang.stopCoaching": "⏹ Lopeta ja saa valmennusta",
  "lang.speakFreely": "🎙️ Puhu vapaasti",
  "lang.whyMatters": "Miksi sillä on väliä",
  "lang.howImprove": "Miten parantaa",
  "lang.coachExercises": "Harjoitukset",
  "lang.d.pronunciation": "ääntäminen",
  "lang.d.accent": "aksentti",
  "lang.d.rhythm": "rytmi",
  "lang.d.fluency": "sujuvuus",
  "lang.d.intonation": "intonatio",
  "langmode.beginner": "aloittelija",
  "langmode.intermediate": "keskitaso",
  "langmode.advanced": "edistynyt",
  "langmode.academic": "akateeminen",
  "langmode.professional": "ammatillinen",
  "langmode.exam_prep": "kokeeseen valmistautuminen",
  "langmode.immersion": "upotus",
  "strategy.socratic": "Sokraattinen menetelmä",
  "strategy.project_based": "Projektipohjainen",
  "strategy.problem_solving": "Ongelmanratkaisu",
  "strategy.case_study": "Tapaustutkimus",
  "strategy.task_based": "Tehtäväpohjainen",
  "strategy.guided_demonstration": "Ohjattu esittely",
  "strategy.active_learning": "Aktiivinen oppiminen",
  "strategy.experiential": "Kokemuksellinen",
  "common.backToday": "Takaisin tähän päivään",
  "health.title": "Järjestelmän tila",
  "health.unreachable": "Ei tavoitettavissa",
  "health.allOk": "Kaikki järjestelmät toimivat",
  "health.degraded": "Heikentynyt",
  "health.up": "ylös",
  "health.down": "alas",
  "health.refresh": "Päivitä",
  "revision.loading": "Ladataan jonoa…",
  "revision.queueCleared": "Jono tyhnetty",
  "revision.nothingDue": "Ei erääntyviä kohteita",
  "revision.clearedDetail": "Kertasit {n} kortti(a). Seuraava kertaus on jo ajoitettu hetkeen, jona todennäköisimmin unohdat asian.",
  "revision.nothingDetail": "FSRS ajoittaa jokaisen kortin juuri ennen kuin ehtisit unohtaa sen. Palaa asiaan, kun jotain on erääntynyt.",
  "revision.counter": "{i} / {total} · {done} valmiina",
  "revision.tapReveal": "Napauta paljastaaksesi",
  "revision.reveal": "Näytä vastaus",
  "revision.again": "Uudestaan",
  "revision.hard": "Vaikea",
  "revision.good": "Hyvä",
  "revision.easy": "Helppo",
  "lessonNew.writing": "Kirjoitetaan oppituntia",
  "lessonNew.detail": "Opettajasi kirjoittaa koko oppitunnin, luo harjoituksia ja muistikortteja sekä tallentaa sen pitkäkestoiseen muistiisi. Tämä kestää hetken.",
  "scan.title": "Skannaa kurssisi",
  "scan.help": "Ota kuva sivusta, tussitaulusta tai käsinkirjoitetuista muistiinpanoistasi. Opettajasi lukee sen, säilyttää alkuperäisen kielen ja tallentaa sen pitkäkestoiseen muistiisi – enintään {max} sivua kerrallaan.",
  "scan.takePhoto": "📷 Ota kuva",
  "scan.chooseImages": "Valitse kuvat",
  "scan.pagesReady": "{n} sivu(a) valmiina",
  "scan.remove": "Poista",
  "scan.titlePlaceholder": "Otsikko (valinnainen – haetaan muuten sivulta)",
  "scan.readPages": "Lue nämä sivut",
  "scan.reading": "Luetaan sivujasi… tämä kestää hetken.",
  "scan.scanAnother": "Skannaa toinen",
  "scan.filed": "Tallennettu muistiisi",
  "scan.filedDetail": "{n} merkkiä luettu. Sitä indeksoidaan parhaillaan – kun se on valmis, se on haettavissa, ja opettajasi voi rakentaa sille oppitunteja.",
  "scan.cameraRefused": "Kameran käyttö estettiin. Salli kameran käyttö ja yritä uudestaan.",
  "progress.currentStreak": "Nykyinen putki",
  "progress.longest": "Pisin",
  "progress.activeDays": "Aktiiviset päivät",
  "progress.days": "päivää",
  "progress.yourNumbers": "Tilastosi",
  "progress.cardsReviewed": "Kerratut kortit",
  "progress.retention": "Pitoaste",
  "progress.noReviews": "ei kertaustakaan vielä",
  "progress.dueNow": "Erääntyy nyt",
  "progress.conceptsMastered": "Omaksutut käsitteet",
  "progress.atRisk": "Uhkailun alla olevat käsitteet",
  "progress.lessonsCompleted": "Suoritetut oppitunnit",
  "progress.exercisesCorrect": "Oikeat harjoitukset",
  "progress.milestones": "Virstanpylväät",
  "progress.askMentor": "Kysy mentoriltasi",
  "sub.tileDetail": "Suunnitelmasi ja saatavilla olevat suunnitelmat.",
  "sub.title": "Tilaus",
  "sub.intro": "Nykyinen suunnitelmasi ja kaikki tarjolla olevat. Suunnitelmakohtaisia rajoja ja etuja määritellään – hinnoittelu ja kassatoiminto saapuvat pian.",
  "sub.current": "Nykyinen suunnitelma",
  "sub.currentPlan": "Nykyinen suunnitelma",
  "sub.choose": "Valitse",
  "sub.pricingSoon": "Hinnoittelu tulossa pian",
  "sub.note": "Tilauksia voi toistaiseksi vaihtaa vapaasti – maksullisuus ja tilauskohtaiset rajat saapuvat myöhemmässä päivityksessä.",
  "sub.status.active": "Aktiivinen",
  "sub.status.trialing": "Kokeilu",
  "sub.status.past_due": "Erääntynyt",
  "sub.status.canceled": "Peruutettu",
  "sub.status.incomplete": "Keskeneräinen",
  "sub.audience.individual": "Yksityinen",
  "sub.audience.organization": "Organisaatio",
  "sub.cancel": "Peruuta tilaus",
  "sub.willCancel": "peruutetaan kauden lopussa",
  "sub.invoices": "Laskut",
  "sub.noInvoices": "Ei laskuja vielä.",
  "profile.usage": "Käyttö ja kiintiöt",
  "usage.tileDetail": "Kuinka paljon tilausrajoistasi olet käyttänyt.",
  "usage.title": "Käyttö ja kiintiöt",
  "usage.intro": "Mitä olet käyttänyt tällä kaudella suhteessa tilausrajoihisi.",
  "usage.note": "Rajat riippuvat tilauksestasi ja nollautuvat joka kausi.",
  "usage.unlimited": "Rajoittamaton",
  "usage.gb": "GB",
  "usage.min": "min",
  "usage.metric.documents": "Asiakirjat",
  "usage.metric.storage": "Tallennustila",
  "usage.metric.ai_questions": "AI-kysymykset",
  "usage.metric.voice_minutes": "Puheminuutit",
  "profile.orgs": "Organisaatiot",
  "org.tileDetail": "Koulut, yliopistot ja tiimit, joihin kuulut.",
  "org.title": "Organisaatiot",
  "org.intro": "Koulut, yliopistot, koulutuskeskukset ja yritykset, joihin kuulut.",
  "org.create": "Luo organisaatio",
  "org.createBtn": "Luo",
  "org.namePlaceholder": "Nimi – esim. Lincoln High School",
  "org.type.school": "Koulu",
  "org.type.university": "Yliopisto",
  "org.type.training_center": "Koulutuskeskus",
  "org.type.enterprise": "Yritys",
  "org.role.admin": "Ylläpitäjä",
  "org.role.teacher": "Opettaja",
  "org.role.student": "Opiskelija",
  "org.memberCount": "{n} jäsentä",
  "org.open": "Avaa",
  "org.emptyTitle": "Ei organisaatioita vielä",
  "org.emptyDetail": "Luo sellainen yllä tai pyydä ylläpitäjää lisäämään sinut omaansa.",
  "org.members": "Jäsenet",
  "org.addMember": "Lisää jäsen",
  "org.addMemberBtn": "Lisää jäsen",
  "org.emailPlaceholder": "Jäsenen sähköposti",
  "org.groups": "Luokat ja ryhmät",
  "org.noGroups": "Ei luokkia tai ryhmiä vielä.",
  "org.createGroup": "Luo luokka",
  "org.createGroupBtn": "Luo luokka",
  "org.groupNamePlaceholder": "Luokan nimi – esim. 12. luokka – Luonnontieteet",
  "org.kind.class": "Luokka",
  "org.kind.group": "Ryhmä",
  "org.back": "Takaisin organisaatioihin",
  "org.insights": "🌐 Vuokralaisen tiedot",
  "org.insightsMembers": "{s} opiskelijaa · {t} opettajaa",
  "org.insightsActive": "{n} aktiivista tällä viikolla",
  "org.difficultSubjects": "Vaikeimmat aineet",
  "org.recommendations": "Suositukset",
  "profile.admin": "Ylläpitäjän hallintapaneeli",
  "admin.tileDetail": "Alustan taustajärjestelmä (vain ylläpitäjät).",
  "admin.title": "Ylläpitäjän hallintapaneeli",
  "admin.intro": "Alustan yleiskatsaus kaikille käyttäjille ja organisaatioille.",
  "admin.stat.users": "Käyttäjät",
  "admin.stat.orgs": "Organisaatiot",
  "admin.stat.docs": "Dokumentit",
  "admin.stat.revenue": "Tulot",
  "admin.stat.incidents": "Avoimet häiriöt",
  "admin.stat.reports": "Avoimet raportit",
  "admin.aiUsage": "AI-käyttö",
  "admin.aiQuestions": "AI-kysymykset",
  "admin.voiceMinutes": "Ääniminuutit",
  "admin.users": "Käyttäjät",
  "admin.suspend": "Keskeytä",
  "admin.reactivate": "Aktivoi uudelleen",
  "admin.suspended": "keskeytetty",
  "admin.incidents": "Häiriöt",
  "admin.incidentPlaceholder": "Häiriön otsikko",
  "admin.createIncident": "Luo häiriö",
  "admin.resolve": "Ratkaise",
  "admin.sev.low": "Matala",
  "admin.sev.medium": "Keskitaso",
  "admin.sev.high": "Korkea",
  "admin.sev.critical": "Kriittinen",
  "admin.istatus.open": "Avoin",
  "admin.istatus.investigating": "Tutkitaan",
  "admin.istatus.resolved": "Ratkaistu",
  "admin.reports": "Raportit",
  "admin.noReports": "Ei raportteja.",
  "admin.review": "Merkitse tarkastetuksi",
  "admin.rstatus.open": "Avoin",
  "admin.rstatus.reviewed": "Tarkastettu",
  "admin.rstatus.dismissed": "Hylätty",
  "admin.logs": "Lokitiedot",
  "profile.analytics": "Analytiikka",
  "an.tileDetail": "Alustan liiketoimintatiedot (vain ylläpitäjät).",
  "an.title": "Analytiikka",
  "an.intro": "Alustan mittarit jatkuvan parantamisen ohjaamiseen.",
  "an.active": "Aktiiviset käyttäjät",
  "an.stickiness": "Sitoutuneisuus",
  "an.retention": "7 päivän pysyvyys",
  "an.newUsers": "Uudet (7pv)",
  "an.business": "Liiketoiminta",
  "an.revenue": "Tulot",
  "an.conversion": "Konversio",
  "an.paid": "Maksavat käyttäjät",
  "an.learning": "Oppiminen ja tekoäly",
  "an.studyTime": "Opiskeluaika",
  "an.mastery": "Keskim. hallinta",
  "an.lessons": "Oppitunnit",
  "an.aiQuestions": "AI-kysymykset",
  "an.voiceMinutes": "Ääniminuutit",
  "an.topFeatures": "Käytetyimmät ominaisuudet",
  "an.feature.tutor": "AI-opettaja",
  "an.feature.lessons": "Oppitunnit",
  "an.feature.assessments": "Arvioinnit",
  "an.feature.writing": "Kirjoittaminen",
  "an.feature.reading": "Lukeminen",
  "an.feature.documents": "Dokumentit",
  "an.feature.languages": "Kielet",
  "profile.privacy": "Tietosuoja ja tiedot",
  "priv.tileDetail": "Suostumukset, tietojen vienti ja tilin poistaminen.",
  "priv.title": "Tietosuoja ja tiedot",
  "priv.intro": "Hallitse suostumuksiasi, vie tietosi tai poista tilisi.",
  "priv.consents": "Suostumukset",
  "priv.consent.analytics": "Tuoteanalytiikka",
  "priv.consent.marketing": "Markkinointiviestit",
  "priv.consent.product_emails": "Tuotepäivityssähköpostit",
  "priv.granted": "Annettu",
  "priv.notGranted": "Ei annettu",
  "priv.grant": "Anna",
  "priv.withdraw": "Peruuta suostumus",
  "priv.export": "Vie tietosi",
  "priv.exportHelp": "Lataa kaikki sinusta tallentamamme tiedot JSON-tiedostona.",
  "priv.exportBtn": "Vie tietoni",
  "priv.exportDone": "Tietovientisi ladattiin.",
  "priv.exportReady": "Tietovientisi on valmis.",
  "priv.danger": "Vaaravyöhyke",
  "priv.deleteHelp": "Poista tilisi ja kaikki tietosi pysyvästi. Tätä ei voi kumota.",
  "priv.deleteBtn": "Poista tilini",
  "priv.passwordPlaceholder": "Vahvista salasanallasi",
  "priv.cancel": "Peruuta",
  "priv.confirmDelete": "Poista ikuisesti",
  "h.hero.analyzed": "Olen analysoinut edistymisesi ja valmistellut päiväsi.",
  "h.ctx.new": "Tervetuloa. Rakennetaan ensimmäinen oppimispolkusi.",
  "h.ctx.active": "Olen valmistellut tämän päivän session.",
  "h.ctx.exam": "Kokeesi lähestyy — olen mukauttanut ohjelmaasi.",
  "h.ctx.revision": "Muutama käsite on vaarassa unohtua tänään.",
  "h.ctx.success": "Vahvistit juuri tärkeän käsitteen.",
  "h.ctx.inactive": "Edellisestä kerrasta on muutama päivä — otetaan taas kevyesti.",
  "h.hero.start": "Aloita sessio",
  "h.hero.detail": "Näytä tiedot",
  "h.hero.activities": "toimintaa",
  "h.hero.min": "min",
  "h.hero.priorityHigh": "korkea prioriteetti",
  "h.nba.title": "Seuraava toimintosi",
  "h.nba.priority": "PRIORITEETTI",
  "h.nba.why": "Miksi?",
  "h.nba.start": "Aloita",
  "h.nba.review": "Kertaa",
  "h.nba.learn": "Opi",
  "h.nba.r.at_risk": "Osaamisesi heikkenee — lyhyt kertaus tänään auttaa paljon.",
  "h.nba.r.ready": "Esitiedot on hallittu — tämä on ihanteellinen seuraava askel.",
  "h.nba.r.in_progress": "Opit tätä jo — pidetään vauhti yllä.",
  "h.nba.r.review": "Kortit odottavat kertausvuoroaan tänään.",
  "h.nba.none": "Ei mitään kiireellistä — olet ajan tasalla. Lyhyt kertaus auttaa silti.",
  "h.capture.title": "Mitä haluat oppia?",
  "h.capture.placeholder": "Selitä derivaatat… / esitä kysymys",
  "h.capture.write": "Kirjoita",
  "h.capture.speak": "Puhu",
  "h.capture.drop": "Pudota",
  "h.capture.scan": "Skannaa",
  "h.capture.import": "Tuo",
  "h.proactive.badge": "MUKAUTETTU SUUNNITELMA",
  "h.today.title": "Tänään",
  "h.today.none": "Ei suunnitelmia tälle päivälle.",
  "h.today.summary": "{min} min · {n} toimintaa",
  "h.st.done": "tehty",
  "h.st.in_progress": "kesken",
  "h.st.pending": "tehtävä",
  "h.st.skipped": "lykätty",
  "h.continue.title": "Jatka",
  "h.continue.reached": "Saavutit:",
  "h.continue.btn": "Jatka",
  "h.progress.week": "Tämä viikko",
  "h.progress.reviews": "Kertaukset",
  "h.progress.streak": "päivän putki",
  "h.mastery.title": "Hallinta",
  "h.mastery.none": "Ei vielä seurattavia käsitteitä.",
  "h.exams.title": "Tulevat kokeet",
  "h.exams.prep": "Valmistautuminen",
  "h.exams.none": "Ei tulevia kokeita.",
  "h.exams.hint": "Voit lisätä kokeen milloin tahansa tarvittaessa.",
  "h.exams.plan": "Näytä lukujärjestys",
  "h.exams.inDays": "{n} päivän päästä",
  "h.exams.today": "tänään",
  "h.exams.tomorrow": "huomenna",
  "h.recs.title": "Neuvo opettajaltasi",
  "h.recs.none": "Ei neuvoja tällä hetkellä.",
  "h.recs.act": "Aloita",
  "h.capacity.title": "Päivän kapasiteetti",
  "h.capacity.recommended": "Suositus {n} minuuttia",
  "h.streak.title": "Säännöllisyys",
  "h.streak.days": "päivää",
  "h.block.error": "Tämän lohkon lataaminen epäonnistui.",
  "h.block.retry": "Yritä uudelleen",
  "h.open": "Avaa",
  "error.title": "Jotain meni vikaan",
  "error.detail": "Tällä näytöllä tapahtui virhe. Voit yrittää uudelleen.",
  "learn.section.modes": "Miten haluat opiskella?",
  "study.section.cards": "Älykkäät kortit",
  "onboarding.preparing": "Valmistellaan tilaasi…",
  "onboarding.gen.title": "Luodaan digitaalista aivorunkoa…",
  "onboarding.gen.analyzing": "Analysoidaan profiiliasi…",
  "onboarding.gen.graph": "Rakennetaan tietokarttaasi…",
  "onboarding.gen.teacher": "Personoidaan tekoälyprofessoria…",
  "onboarding.gen.forming": "Digitaalinen aivorunkosi hahmottuu…",
  "profile.manageSubscription": "Hallinnoi tilaustani",
  "onb.progress": "Työtilasi hahmottuu…",
  "onb.why": "Miksi kysyn tätä?",
  "onb.continue": "Jatka",
  "onb.back": "Takaisin",
  "onb.skip": "Ohita",
  "onb.cat.kindergarten": "Päiväkoti",
  "onb.cat.primary": "Alakoulu",
  "onb.cat.secondary": "Yläkoulu",
  "onb.cat.highschool": "Lukio",
  "onb.cat.university": "Yliopisto",
  "onb.cat.research": "Tutkimus / Väitöskirja",
  "onb.cat.professional": "Ammatillinen koulutus",
  "onb.cat.language": "Kielen opiskelu",
  "onb.cat.personal": "Henkilökohtainen oppiminen",
  "onb.age.under12": "Alle 12",
  "onb.age.12to15": "12–15",
  "onb.age.16to18": "16–18",
  "onb.age.18to25": "18–25",
  "onb.age.25to40": "25–40",
  "onb.age.over40": "Yli 40",
  "onb.goal.understand": "Ymmärtää kurssini",
  "onb.goal.exams": "Läpäistä kokeeni",
  "onb.goal.grades": "Parantaa arvosanojani",
  "onb.goal.language": "Oppia kieli",
  "onb.goal.contest": "Valmistautua pääsykokeeseen",
  "onb.goal.homework": "Tehdä läksyni",
  "onb.goal.labs": "Tehdä laboratorio-opetukseni",
  "onb.goal.reports": "Kirjoittaa raporttini",
  "onb.goal.projects": "Työstää projektejani",
  "onb.goal.research": "Tehdä tutkimusta",
  "onb.goal.skills": "Kehittää taitojani",
  "onb.goal.curiosity": "Oppia uteliaisuudesta",
  "onb.subj.math": "Matematiikka",
  "onb.subj.physics": "Fysiikka",
  "onb.subj.chemistry": "Kemia",
  "onb.subj.biology": "Biologia",
  "onb.subj.cs": "Tietojenkäsittelytiede",
  "onb.subj.law": "Oikeustiede",
  "onb.subj.economics": "Taloustiede",
  "onb.subj.history": "Historia",
  "onb.subj.geography": "Maantiede",
  "onb.subj.languages": "Kielet",
  "onb.subj.medicine": "Lääketiede",
  "onb.subj.philosophy": "Filosofia",
  "onb.pref.visual": "Visuaaliset selitykset",
  "onb.pref.examples": "Esimerkit",
  "onb.pref.practice": "Harjoittelu",
  "onb.pref.exercises": "Tehtävät",
  "onb.pref.conversation": "Keskustelu",
  "onb.pref.reading": "Lukeminen",
  "onb.pref.listening": "Kuuntelu",
  "onb.pref.repetition": "Toisto",
  "onb.pref.problems": "Ongelmanratkaisu",
  "onb.tone.supportive": "Kannustava",
  "onb.tone.balanced": "Tasapainoinen",
  "onb.tone.demanding": "Vaativa",
  "onb.expl.short": "Lyhyt",
  "onb.expl.balanced": "Tasapainoinen",
  "onb.expl.detailed": "Yksityiskohtainen",
  "onb.interv.let_me_think": "Anna minun ajatella",
  "onb.interv.guide_me": "Ohjaa minua vaihe vaiheelta",
  "onb.interv.interactive": "Ole erittäin vuorovaikutteinen",
  "onb.corr.immediate": "Korjaa heti",
  "onb.corr.let_me_finish": "Anna minun lopettaa",
  "onb.corr.adaptive": "Sopeudu tilanteeseen",
  "onb.sup.guide": "Ohjaa minua",
  "onb.sup.understand": "Auta minua ymmärtämään",
  "onb.sup.step_by_step": "Käy kanssani läpi vaihe vaiheelta",
  "onb.sup.verify": "Tarkista päättelyni",
  "onb.sup.solution": "Näytä selitetty ratkaisu",
  "onb.skill.comprehension": "Ymmärtäminen",
  "onb.skill.speaking": "Puhuminen",
  "onb.skill.pronunciation": "Ääntäminen",
  "onb.skill.writing": "Kirjoittaminen",
  "onb.skill.grammar": "Kielioppi",
  "onb.skill.vocabulary": "Sanasto",
  "onb.rate.high": "Hoidan tämän",
  "onb.rate.medium": "Keskitaso",
  "onb.rate.low": "Kaipaa työtä",
  "onb.welcome.title": "Tervetuloa Second Brain -sovellukseen.",
  "onb.welcome.start": "Aloita",
  "onb.welcome.body": "Rakennetaan oppimisympäristösi oppimistyylisi mukaan.",
  "onb.welcome.teacher": "Tutustun sinuun, jotta voin säätää tekoälyprofessorini tasollesi, tavoitteisiisi ja oppimistapaasi sopivaksi.",
  "onb.identity.teacher": "Tutustutaan – vain olennaiset asiat, ei enempää.",
  "onb.identity.title": "Kuka olet?",
  "onb.identity.firstName": "Etunimi",
  "onb.identity.firstNamePh": "Etunimesi",
  "onb.identity.lastName": "Sukunimi (valinnainen)",
  "onb.identity.lastNamePh": "Sukunimesi",
  "onb.identity.avatar": "Profiilikuva (valinnainen)",
  "onb.identity.age": "Ikäryhmä",
  "onb.identity.ageWhy": "Ikäryhmää käytetään vain sävyn ja esitystavan mukauttamiseen. Syntymäaikaa ei kysytä, ja nuorempien oppijoiden kokemus pidetään turvallisena.",
  "onb.identity.country": "Maa / alue (valinnainen)",
  "onb.identity.countryPh": "esim. Ranska",
  "onb.category.teacher": "Tämä auttaa minua ymmärtämään, missä vaiheessa matkaasi olet.",
  "onb.category.title": "Missä tilanteessa olet?",
  "onb.category.subtitle": "Valitse itsellesi parhaiten sopiva.",
  "onb.academic.teacher": "Kuvaile opintojasi – valitse, etsi tai kirjoita vapaasti.",
  "onb.academic.title": "Opinnot",
  "onb.academic.subtitle": "Mikään ei ole pakollista: täytä se, mikä koskee sinua.",
  "onb.academic.level": "Taso",
  "onb.academic.levelPh": "esim. Yliopisto",
  "onb.academic.system": "Maa / koulutusjärjestelmä",
  "onb.academic.systemPh": "esim. Ranska",
  "onb.academic.field": "Ala",
  "onb.academic.fieldPh": "esim. Tietojenkäsittelytiede",
  "onb.academic.domain": "Pääaine / osa-alue",
  "onb.academic.domainPh": "esim. Ohjelmistotuotanto",
  "onb.academic.specialty": "Erityisala (valinnainen)",
  "onb.academic.specialtyPh": "esim. Hajautetut järjestelmät",
  "onb.academic.year": "Vuosi / taso",
  "onb.academic.yearPh": "esim. 3. vuosikurssi",
  "onb.goals.teacher": "Kerro, miksi olet täällä – voit valita useita.",
  "onb.goals.title": "Miksi käytät Second Brain -sovellusta?",
  "onb.subjects.teacher": "Nämä aiheet ravitsevat muistiasi, tietoverkkoasi ja aikatauluasi.",
  "onb.subjects.title": "Aiheet",
  "onb.subjects.add": "Lisää aihe",
  "onb.subjects.addPh": "esim. Astrofysiikka",
  "onb.subjects.addBtn": "Lisää",
  "onb.languages.teacher": "Kieli muovaa selitykseni ja tuen, jota voin antaa sinulle.",
  "onb.languages.title": "Kielet",
  "onb.languages.native": "Äidinkieli",
  "onb.languages.interface": "Käyttöliittymän kieli",
  "onb.languages.interfaceWhy": "Käyttöliittymän kieli vaihtaa näkymää ja kieltä, jolla tekoälyprofessori opettaa sinua.",
  "onb.languages.study": "Opiskelukieli (valinnainen)",
  "onb.languages.studyWhy": "Jos opiskelet muulla kuin äidinkielelläsi, otan käyttöön kaksikielisen tuen ja akateemisen sanaston.",
  "onb.mobility.title": "Kansainvälinen liikkuvuus",
  "onb.mobility.subtitle": "Opiskeletko tällä hetkellä jollain muulla kuin äidinkielelläsi?",
  "onb.mobility.yes": "Kyllä",
  "onb.mobility.no": "Ei",
  "onb.mobility.alertTitle": "Kielituki käytössä",
  "onb.mobility.alertDetail": "Kontekstuaalinen käännös, akateeminen sanasto, kaksikielinen selitys ja asteittainen uppoutuminen.",
  "onb.ll.teacher": "Rakennetaan kielimatkasi, joka on räätälöity sinulle.",
  "onb.ll.title": "Opi kieli",
  "onb.ll.target": "Haluan oppia",
  "onb.ll.currentLevel": "Nykyinen taso",
  "onb.ll.goalLevel": "Tavoite",
  "onb.ll.mainGoal": "Päätavoite",
  "onb.ll.mainGoalPh": "esim. Keskustelu",
  "onb.ll.skills": "Mitä haluat työstää",
  "onb.prefs.teacher": "Nämä ovat mieltymyksiä, eivät diagnoosi. Voit muuttaa niitä milloin tahansa.",
  "onb.prefs.title": "Miten haluat oppia?",
  "onb.teacher.teacher": "Määritä asetukset. Mukautan toimintaani tulistesi perusteella.",
  "onb.teacher.title": "Tekoälyprofessori",
  "onb.teacher.tone": "Sävy",
  "onb.teacher.explanations": "Selitykset",
  "onb.teacher.intervention": "Puuttuminen",
  "onb.teacher.correction": "Korjaus",
  "onb.support.teacher": "Laboratoriotyöt, kotitehtävät, raportit, projektit, opinnäytetyöt – miten haluat minun auttavan?",
  "onb.support.title": "Akateeminen tuki",
  "onb.assess.teacher": "Katsotaan nopeasti, mitä tiedät jo – muutama kysymys, ei koe.",
  "onb.assess.title": "Pika-tarkistus",
  "onb.assess.save": "Tallenna",
  "onb.assess.noSubjectTitle": "Ei aihetta valittuna",
  "onb.assess.noSubjectDetail": "Lisää aihe edellisessä vaiheessa tehdäksesi tarkistuksen tai ohita tämä vaihe.",
  "onb.assess.whichSubject": "Mistä aiheesta?",
  "onb.assess.preparing": "Valmistellaan…",
  "onb.assess.run": "Aloita tarkistus",
  "onb.assess.unavailableTitle": "Tarkistus ei saatavilla",
  "onb.assess.unavailableDetail": "Voit arvioida tasosi itse alla.",
  "onb.assess.selfRate": "Arvioi tasosi aiheessa",
  "onb.assess.answerPh": "Vastauksesi (valinnainen)",
  "onb.twin.title": "Tässä on se, mitä ymmärsin sinusta",
  "onb.twin.subtitle": "Voit heti korjata sen, mitä Second Brain ymmärsi.",
  "onb.twin.confirm": "Pitää paikkansa",
  "onb.twin.profile": "Profiili",
  "onb.twin.langs": "Kielet",
  "onb.twin.goals": "Tavoitteet",
  "onb.twin.subjects": "Aiheet",
  "onb.twin.prof": "Professori",
  "onb.twin.target": "Tavoite",
  "onb.twin.native": "äidinkieli",
  "onb.twin.study": "opiskella",
  "onb.twin.hi": "Hei",
  "onb.twin.almost": "olemme melkein valmiina.",
  "onb.twin.toAdapt": "Mukautuakseen",
  "onb.adapt.title": "Näin tekoälyprofessori toimii",
  "onb.adapt.enter": "Siirry Second Brain -sovellukseen",
  "onb.adapt.preparing": "Valmistellaan…",
  "onb.adapt.willBody": "Minä:",
  "onb.adapt.p1": "mukautan selitykseni tasollesi",
  "onb.adapt.p2": "tunnistan vaikeutesi",
  "onb.adapt.p3": "ohjaan sinut harjoittelemaan",
  "onb.adapt.p4": "suunnittelen kertauksesi",
  "onb.adapt.p5": "käytän asiakirjojasi",
  "onb.adapt.p6": "autan sinua tehtävissäsi",
  "onb.edit": "Muokkaa",
  "error.serverBusy": "Palvelu on juuri nyt var kiireinen. Yritä hetken kuluttua uudelleen.",
  "error.network": "Yhteysongelma. Tarkista verkkoyhteytesi ja yritä uudelleen.",
  "onb.cfg.title": "Asetukset otettu käyttöön",
  "onb.cfg.profileUpdated": "Profiili päivitetty",
  "onb.cfg.langCreated": "Kieliprofiili luotu",
  "onb.cfg.concepts": "alkuperäiset käsitteet",
  "auth.brandTitle": "Tehostettu tekoälyaivosi",
  "auth.brandSubtitle": "Opi. Ymmärrä. Muista. Tekoälyprofessorisi kasvaa kanssasi.",
  "auth.badgeLangs": "34 kieltä",
  "auth.badgeModels": "Monimallitekoäly",
  "auth.badgeGraph": "Tietoverkko",
  "auth.sceneQuestion": "Selitä tämä käsite minulle yksinkertaisesti.",
  "auth.sceneAnswer": "Totta kai — tässä se on, vaihe vaiheelta, tasollesi sopivasti.",
  "auth.sceneConcept": "Käsite",
  "auth.sceneRelation": "Yhteys",
  "auth.sceneMastery": "Hallinta",
  "auth.welcomeBack": "Tervetuloa takaisin",
  "auth.signUpSubtitle": "Muutama sekunti oppimisympäristösi luomiseen.",
  "auth.signInSubtitle": "Jatka siitä, mihin jäit.",
  "auth.showPassword": "Näytä salasana",
  "auth.hidePassword": "Piilota salasana",
  "auth.themeToggle": "Vaihda teemaa",
  "auth.strengthLabel": "Salasanan vahvuus",
  "auth.strengthWeak": "Heikko",
  "auth.strengthMedium": "Keskitaso",
  "auth.strengthStrong": "Vahva",
  "auth.emailFieldHint": "esim. sinä@example.com",
  "auth.retry": "Yritä uudelleen",
  "nav.expand": "Laajenna valikko",
  "nav.collapse": "Tiivistä valikko",
  "profile.kyc.title": "Oma profiili",
  "profile.kyc.complete": "Valmis",
  "profile.kyc.incomplete": "Suoritettava",
  "profile.kyc.detail": "Tiedot, jotka mukauttavat tekoälyprofessorisi ja digitaalisen kaksoisesi.",
  "profile.kyc.verify": "Tarkista profiilini",
  "profile.kyc.name": "Nimi",
  "profile.kyc.path": "Polku",
  "profile.kyc.languagesRow": "Kielet",
  "profile.kyc.goalsRow": "Tavoitteet",
  "profile.kyc.goalsN": "tavoite/tavoitetta",
  "profile.footer": "Muutoksesi päivittävät heti tekoälyprofessorisi ja digitaalisen kaksoisesi kaikkialla sovelluksessa.",
  "lib.learnWithTeacher": "Opi opettajan kanssa",
  "sub.popular": "Suosittu",
  "sub.perMonth": "/kk",
  "sub.free": "Ilmainen",
  "landing.brand": "Second Brain",
  "landing.signature": "Aktivoi digitaalinen kaksoisesi",
  "landing.nav.features": "Ominaisuudet",
  "landing.nav.how": "Miten se toimii",
  "landing.nav.professor": "Tekoälyprofessori",
  "landing.nav.academic": "Akateeminen työtila",
  "landing.nav.languages": "Kielet",
  "landing.nav.faq": "Usein kysytyt kysymykset",
  "landing.cta.signin": "Kirjaudu sisään",
  "landing.cta.start": "Aloita ilmaiseksi",
  "landing.cta.startShort": "Aloita",
  "landing.cta.discover": "Katso miten se toimii",
  "landing.hero.title": "Digitaalinen oppimiskaksoisesi",
  "landing.hero.subtitle": "Tekoälyprofessori, joka ymmärtää matkaasi, muistaa oppimasi ja opettaa sinua – räätälöidysti.",
  "landing.hero.promise1": "Opi",
  "landing.hero.promise2": "Ymmärrä",
  "landing.hero.promise3": "Ota muistiin",
  "landing.hero.promise4": "Edistyminen",
  "landing.hero.reassure1": "Mukautuva tekoälyprofessori",
  "landing.hero.reassure2": "Pysyvä muisti",
  "landing.hero.reassure3": "34 kieltä",
  "landing.hero.reassure4": "Älykkäät dokumentit",
  "landing.mock.os": "SECOND BRAIN OS",
  "landing.mock.brain": "Aivoni",
  "landing.mock.professor": "Tekoälyprofessori",
  "landing.mock.msg": "”Selitä tämä käsite minulle…”",
  "landing.mock.memory": "Muisti",
  "landing.mock.progress": "Edistyminen",
  "landing.mock.mastery": "Hallinta",
  "landing.signals.multipdf": "Usean PDF:n tuki",
  "landing.signals.fsrs": "FSRS",
  "landing.flow.documents": "Dokumentit",
  "landing.flow.intelligence": "Älykkyys",
  "landing.flow.graph": "Tietoverkko",
  "landing.flow.professor": "Tekoälyprofessori",
  "landing.flow.twin": "Digitaalinen kaksonen",
  "landing.flow.revision": "Kertaus ja edistyminen",
  "landing.compare.title": "Mikä muuttuu",
  "landing.compare.message": "Second Brain ei vain säilytä tietojasi. Se oppii, miten sinä opit.",
  "landing.compare.classicTitle": "Perinteinen sovellus",
  "landing.compare.sbTitle": "Second Brain OS",
  "landing.compare.classic1": "Erilliset dokumentit",
  "landing.compare.classic2": "Staattiset muistiinpanot",
  "landing.compare.classic3": "Perushaku",
  "landing.compare.classic4": "Yhteenvedot",
  "landing.compare.classic5": "Hajallaan oleva historia",
  "landing.compare.sb1": "Henkilökohtainen muisti",
  "landing.compare.sb2": "Tekoälyprofessori",
  "landing.compare.sb3": "Tietoverkko",
  "landing.compare.sb4": "Mukautuva oppiminen",
  "landing.compare.sb5": "Älykäs kertaus",
  "landing.compare.sb6": "Jatkuva edistyminen",
  "landing.compare.classicFlow": "Tallenna → Hae → Lue",
  "landing.compare.sbFlow": "Tallenna → Ymmärrä → Opeta → Paina mieleen → Edisty",
  "landing.how.title": "Miten se toimii",
  "landing.how.s1.title": "Tallenna",
  "landing.how.s1.desc": "PDF-tiedostot, valokuvat, skannaukset, muistiinpanot ja kaikki oppisisältö.",
  "landing.how.s2.title": "Ymmärrä",
  "landing.how.s2.desc": "Järjestelmä jäsennöi tiedon ja tunnistaa keskeiset käsitteet.",
  "landing.how.s3.title": "Opeta",
  "landing.how.s3.desc": "Tekoälyprofessori muuttaa tiedon opettamiskokemukseksi.",
  "landing.how.s4.title": "Paina mieleen",
  "landing.how.s4.desc": "Digitaalinen kaksoisesi ja kertausjärjestelmä seuraavat oppimistasi.",
  "landing.how.s5.title": "Edisty",
  "landing.how.s5.desc": "FSRS, arvioinnit ja suositukset vahvistavat tietojasi.",
  "landing.exp.title": "Yksi sisältö → oppimiskokemus",
  "landing.exp.lead": "Mitään ei vain tuoda ja unohdeta. Jokaisesta dokumentista tulee jotain, jota voit oppia, harjoitella ja muistaa.",
  "landing.exp.s1": "PDF",
  "landing.exp.s2": "Analysoi",
  "landing.exp.s3": "Ymmärrä",
  "landing.exp.s4": "Opi professorin kanssa",
  "landing.exp.s5": "Kysymykset",
  "landing.exp.s6": "Harjoitukset",
  "landing.exp.s7": "Kertaa",
  "landing.exp.s8": "Muisti",
  "landing.exp.actionLearn": "Opi professorin kanssa",
  "landing.exp.actionSolve": "Ratkaise se kanssani",
  "landing.showcase.title": "Yksi tuote, yksi kokemus",
  "landing.showcase.brain.tab": "🧠 Oma aivoni",
  "landing.showcase.brain.title": "Oma aivoni",
  "landing.showcase.brain.desc": "Visuaalinen digitaalinen kaksoisesi: tietoverkko, oppimis-DNA sekä vahvuudet ja heikkoudet yhdellä elävällä kartalla.",
  "landing.showcase.professor.tab": "👨‍🏫 AI-professori",
  "landing.showcase.professor.title": "AI-professori",
  "landing.showcase.professor.desc": "Kirjallinen keskustelu, opetus ja pedagogiikka, jotka mukautuvat täsmälleen tasosi ja tavoitteidesi mukaan.",
  "landing.showcase.search.tab": "🔎 Ilmainen haku",
  "landing.showcase.search.title": "Ilmainen AI-haku",
  "landing.showcase.search.desc": "Kysy mitä tahansa – spontaani, tekninen, akateeminen tai yleistietoa koskeva kysymys – oppimiskokemuksen sisällä.",
  "landing.showcase.documents.tab": "📚 Laajat dokumentit",
  "landing.showcase.documents.title": "Laajat dokumentit",
  "landing.showcase.documents.desc": "PDF-tiedostot, valokuvat, skannaukset ja kokonaiset aiheet ryhmiteltynä yhteen – työskentele koko kurssin, älä vain yksittäisen tiedoston kanssa.",
  "landing.showcase.voice.tab": "🎙️ Ääni ja puhe",
  "landing.showcase.voice.title": "Ääni ja puhe",
  "landing.showcase.voice.desc": "Puhuttu keskustelu, suulliset harjoitukset ja suulliset tentit ääneen harjoitteluun.",
  "landing.showcase.academic.tab": "🎓 Akateeminen työtila",
  "landing.showcase.academic.title": "Akateeminen työtila",
  "landing.showcase.academic.desc": "Laboratoriotyöt, kotitehtävät, raportit, projektit, opinnäytetyöt, esseet ja tenttiaiheet – ohjatusti, vaihe vaiheelta.",
  "landing.showcase.revise.tab": "📅 Kertaaminen",
  "landing.showcase.revise.title": "Kertaaminen",
  "landing.showcase.revise.desc": "FSRS, muistikortit, tietvisat ja edistyminen, jotka lukitsevat oppimasi pysyvästi.",
  "landing.professor.title": "Professori, joka oppii tuntemaan sinut",
  "landing.professor.lead": "Ei mikään perinteinen chattibotti – opettaja, joka mukautuu tasosi, tavoitteidesi ja oppimistyylisi mukaan.",
  "landing.professor.a1": "Taso",
  "landing.professor.a2": "Tavoitteet",
  "landing.professor.a3": "Vaikeudet",
  "landing.professor.a4": "Oppimishistoria",
  "landing.professor.a5": "Kieli",
  "landing.professor.a6": "Opetussuunnitelma",
  "landing.professor.a7": "Tahti",
  "landing.professor.a8": "Edistyminen",
  "landing.professor.modesTitle": "Opetustilat",
  "landing.professor.m1": "Opeta",
  "landing.professor.m2": "Selitä",
  "landing.professor.m3": "Keskustele",
  "landing.professor.m4": "Ohjattu istunto",
  "landing.professor.m5": "Suullinen harjoitus",
  "landing.professor.m6": "Suullinen tentti",
  "landing.professor.flow": "Ymmärrä → harjoittele → arvioidaan → korjaa → omaksu muistiin",
  "landing.academic.title": "Akateeminen työtila",
  "landing.academic.badge": "Learn-tilan ominaisuus",
  "landing.academic.lead": "Tavoitteena ei ole vain antaa vastausta valmiina – vaan opettaa sinulle menetelmä.",
  "landing.academic.w1": "Laboratoriotyö",
  "landing.academic.w2": "Kotitehtävä",
  "landing.academic.w3": "Raportti",
  "landing.academic.w4": "Projekti",
  "landing.academic.w5": "Opinnäytetyö",
  "landing.academic.w6": "Essee",
  "landing.academic.w7": "Tapaustutkimus",
  "landing.academic.w8": "Harjoitus",
  "landing.academic.w9": "Tenttiaihe",
  "landing.academic.mode1.title": "Pedagoginen ohjaus",
  "landing.academic.mode1.desc": "Tekoäly ohjaa sinua vaihe vaiheelta.",
  "landing.academic.mode2.title": "Avustettu ratkaisu",
  "landing.academic.mode2.desc": "Työskentelet asian parissa yhdessä tekoälyn kanssa.",
  "landing.academic.mode3.title": "Täysin selitetty ratkaisu",
  "landing.academic.mode3.desc": "Ratkaisu selitetään pedagogisesti, sitä ei pelkästään anneta valmiina.",
  "landing.languages.title": "Kielet ja immersio",
  "landing.languages.lead": "Opi kieli ja ymmärrä oman opetussuunnitelmasi kieltä.",
  "landing.languages.l1": "Immersio",
  "landing.languages.l2": "Keskustelu",
  "landing.languages.l3": "Suullinen",
  "landing.languages.l4": "Varjostus (Shadowing)",
  "landing.languages.l5": "Edistyminen",
  "landing.languages.l6": "Sanasto",
  "landing.languages.l7": "Kielioppi",
  "landing.languages.mobilityTitle": "Akateeminen liikkuvuus",
  "landing.languages.mob1": "Ranskankielinen opiskelija",
  "landing.languages.mob2": "Englanninkielinen yliopisto",
  "landing.languages.mob3": "Kontekstuaalinen käännös",
  "landing.languages.mob4": "Akateeminen sanasto",
  "landing.languages.mob5": "Progressiivinen immersio",
  "landing.kyc.title": "Järjestelmä mukautuu oppijaan",
  "landing.kyc.lead": "Ei mikään hallinnollinen lomake – vaan mukautusmoottori. Se säätää tasoa, sanastoa, sävyä, pedagogiikkaa ja vaikeusastetta sinulle sopivaksi.",
  "landing.kyc.p1.title": "Perusaste",
  "landing.kyc.p1.desc": "Visuaalinen ja ikätasolle sopiva opetusmenetelmä.",
  "landing.kyc.p2.title": "Lukio / Yliopisto",
  "landing.kyc.p2.desc": "Jäsennetty menetelmä, kokeet ja vahvistaminen.",
  "landing.kyc.p3.title": "Erityisala",
  "landing.kyc.p3.desc": "Lääketiede, oikeustiede, tietojenkäsittelytiede, insinööritieteet, arkkitehtuuri...",
  "landing.kyc.p4.title": "Tutkija",
  "landing.kyc.p4.desc": "Tieteellinen tarkkuus ja syvempi perehtyminen.",
  "landing.kyc.p5.title": "Kielen oppija",
  "landing.kyc.p5.desc": "Immersio ja kielellinen edistyminen.",
  "landing.twin.title": "Oppimisestasi tulee elävä muisti",
  "landing.twin.lead": "Mitä enemmän opit Second Brain -sovelluksella, sitä henkilökohtaisemmaksi järjestelmäsi muuttuu.",
  "landing.twin.i1": "Mitä opit",
  "landing.twin.i2": "Mitä ymmärrät",
  "landing.twin.i3": "Mitä unohdat",
  "landing.twin.i4": "Mitä hallitset",
  "landing.twin.i5": "Tavoitteesi",
  "landing.twin.result": "Digitaalinen kaksonen",
  "landing.graph.title": "Tietoverkko",
  "landing.graph.lead": "Elävä kartta kaiken oppimasi välisistä suhteista.",
  "landing.revision.title": "Älykäs kertaus",
  "landing.revision.message": "Älä kertaa enemmän. Kertaa oikealla hetkellä.",
  "landing.revision.lead": "FSRS on koko järjestelmäsi muistikerros – ei vain kasa muistikortteja.",
  "landing.revision.c1": "FSRS",
  "landing.revision.c2": "Väliaikakertaus",
  "landing.revision.c3": "Muistikortit",
  "landing.revision.c4": "Visat",
  "landing.revision.c5": "Arvioinnit",
  "landing.revision.c6": "Edistyminen",
  "landing.one.title": "Yksi yhtenäinen kokemus",
  "landing.one.s1": "Tallenna",
  "landing.one.s2": "Ymmärrä",
  "landing.one.s3": "Opeta",
  "landing.one.s4": "Harjoittele",
  "landing.one.s5": "Paina mieleen",
  "landing.one.s6": "Kertaa",
  "landing.one.s7": "Edisty",
  "landing.faq.title": "Usein kysytyt kysymykset",
  "landing.faq.q1": "Onko Second Brain pelkkä chatbot?",
  "landing.faq.a1": "Ei. Se on henkilökohtainen oppimisympäristö: se ymmärtää sisältösi, opettaa sitä ja muistaa edistymisesi ajan myötä.",
  "landing.faq.q2": "Voinko työskennellä useiden PDF-tiedostojen ja asiakirjojen kanssa?",
  "landing.faq.a2": "Kyllä. Voit ryhmitellä PDF-tiedostoja, valokuvia, skannauksia ja muistiinpanoja yhdeksi kokonaisuudeksi ja oppia koko aineistosta, et vain yhdestä tiedostosta.",
  "landing.faq.q3": "Mitä voin tehdä tekoälyprofessorin kanssa?",
  "landing.faq.a3": "Ota vastaan opetusta, pyydä selityksiä, keskustele, tee ohjattuja sessioita ja harjoittele tehtävien avulla – tasollesi mukautettuna.",
  "landing.faq.q4": "Voinko puhua tekoälyprofessorille ääneen?",
  "landing.faq.a4": "Kyllä. Puhekeskustelut, suulliset harjoitukset ja suulliset kokeet mahdollistavat ääneen harjoittelun.",
  "landing.faq.q5": "Mikä on Digitaalinen kaksonen?",
  "landing.faq.a5": "Henkilökohtainen muisti oppimisestasi – siitä, mitä ymmärrät, hallitset, unohdat ja tavoittelet.",
  "landing.faq.q6": "Miten muisti ja kertaus toimivat?",
  "landing.faq.a6": "Välitetyn kertauksen moottori (FSRS) ajoittaa kertaukset oikeaan hetkeen, jotta opit enemmän vähemmällä vaivalla.",
  "landing.faq.q7": "Voinko käyttää Second Brain -järjestelmää akateemisissa opinnoissani?",
  "landing.faq.a7": "Kyllä. Akateeminen työtila ohjaa laboratorioita, kotitehtäviä, raportteja ja muuta – opettaen menetelmän, ei pelkkää vastausta.",
  "landing.faq.q8": "Miten kielten oppiminen toimii?",
  "landing.faq.a8": "Upotusta, keskustelua, suullista harjoittelua ja varjostusta – sekä apua oman opinto-ohjelmasi kielen ymmärtämiseen.",
  "landing.faq.q9": "Miten tietojani suojataan?",
  "landing.faq.a9": "Oppimistietosi tehostavat kokemustasi. Hallitset tiliäsi ja voit hallinnoida tietojasi profiilistasi.",
  "landing.pricing.title": "Valitse oppimisesi taso",
  "landing.pricing.subtitle": "Tutki → Opi tosissasi → Lähde täysillä mukaan",
  "landing.pricing.billing.monthly": "Kuukausittain",
  "landing.pricing.billing.annual": "Vuosittain",
  "landing.pricing.billing.saving": "Säästä",
  "landing.pricing.free.name": "Ilmainen",
  "landing.pricing.free.description": "Second Brain -ekosysteemin tutkimiseen.",
  "landing.pricing.free.cta": "Aloita ilmaiseksi",
  "landing.pricing.pro.name": "Pro",
  "landing.pricing.pro.description": "Vakavaan, jokapäiväiseen oppimiseen.",
  "landing.pricing.pro.badge": "Suositeltu",
  "landing.pricing.pro.cta": "Hanki Pro",
  "landing.pricing.max.name": "Max",
  "landing.pricing.max.description": "Tutkijoille, intensiivioppijoille ja ammattilaisille.",
  "landing.pricing.max.cta": "Avaa Max",
  "landing.final.title": "Oppimisesi ansaitsee muutakin kuin kirjaston",
  "landing.final.subtitle": "Aktivoi digitaalinen kaksonen.",
  "landing.footer.tagline": "Henkilökohtainen tekoälytehostettu oppimisympäristösi.",
  "landing.footer.product": "Tuote",
  "landing.footer.product1": "Ominaisuudet",
  "landing.footer.product2": "Tekoälyprofessori",
  "landing.footer.product3": "Kirjasto",
  "landing.footer.product4": "Oma aivoni",
  "landing.footer.product5": "Kertaus",
  "landing.footer.learn": "Opi",
  "landing.footer.learn1": "Kielet",
  "landing.footer.learn2": "Akateeminen työtila",
  "landing.footer.learn3": "Keskustelu",
  "landing.footer.learn4": "Asiakirjat",
  "landing.footer.resources": "Resurssit",
  "landing.footer.resources1": "UKK",
  "landing.footer.resources2": "Ohje",
  "landing.footer.resources3": "Dokumentaatio",
  "landing.footer.company": "Yritys",
  "landing.footer.company1": "Tietoa meistä",
  "landing.footer.company2": "Yhteystiedot",
  "landing.footer.legal": "Lakisääteistä",
  "landing.footer.legal1": "Tietosuoja",
  "landing.footer.legal2": "Käyttöehdot",
  "landing.footer.legal3": "Tietoturva",
  "landing.footer.copy": "© 2026 Second Brain – Henkilökohtainen tekoälypohjainen oppimisympäristösi."
  ,"languageSelector.recent": "Viimeksi käytetyt"
  ,"languageSelector.nativeLabel": "Oma äidinkieli"
  ,"voice11.state.ready": "Valmis"
  ,"voice11.state.listening": "Kuunnellaan"
  ,"voice11.state.transcription": "Muunnetaan tekstiksi"
  ,"voice11.state.thinking": "Professori pohtii"
  ,"voice11.state.response": "Vastaus on valmis"
  ,"voice11.state.paused": "Tallennus keskeytetty"
  ,"voice11.state.error": "Puhetoiminnon virhe"
  ,"voice11.transcribe": "Lopeta ja muunna tekstiksi"
  ,"voice11.pause": "Keskeytä"
  ,"voice11.resume": "Jatka"
  ,"voice11.transcript.edit": "Litterointi on valmis — tarkista tai muokkaa sitä ennen lähettämistä."
  ,"state.processing": "Käsitellään…"
  ,"state.partial": "Osa tuloksista ei ole vielä saatavilla"
  ,"state.success": "Valmis"
  ,"state.stale": "Näytetään aiemmin ladatut tiedot"
  ,"state.offline": "Olet offline-tilassa"
  ,"state.quota-limited": "Käyttöraja saavutettu"
  ,"learning.notTracked": "Ei seurata"
  ,"profile.kyc.goalsImpact": "Nämä tavoitteet ohjaavat Kertausta, tekoälyprofessoria ja digitaalista kaksostasi."
  ,"profile.kyc.languagesEmpty": "Ei vielä yhtään."
  ,"learn.component.dropTitle": "Pudota asiakirjasi tähän"
  ,"learn.component.dropDetail": "PDF, valokuva, skannaus, kirja, muistikirja…"
  ,"learn.component.documentQuestion": "Mikä tämä asiakirja on?"
  ,"learn.component.yourTurn": "Sinun vuorosi."
  ,"ai.professor": "Tekoälyprofessori"
  ,"ai.recommendation": "Tekoälyn suositus"
  ,"ai.insight": "Tekoälyn havainto"
  ,"ai.explanation": "Selitys"
  ,"ai.warning": "Vaikeus havaittu"
  ,"ai.progress": "Edistyminen"
  ,"ai.posture.supportive": "Kannustava"
  ,"ai.posture.challenging": "Haastava"
  ,"ai.posture.examiner": "Arvioiva"
  ,"review.due": "erääntynyt"
  ,"profile.card.photo": "Profiilikuva"
  ,"profile.card.editPhoto": "Muokkaa profiilikuvaa"
  ,"profile.card.takePhoto": "Ota valokuva"
  ,"profile.card.gallery": "Valitse galleriasta"
  ,"profile.card.avatar": "Tai valitse avatar"
  ,"profile.card.removePhoto": "Poista kuva"
  ,"profile.card.identity": "Identiteetti ja oppimispolku"
  ,"profile.card.name": "Nimi"
  ,"profile.card.namePh": "Nimesi"
  ,"profile.card.category": "Oppijan luokka"
  ,"profile.card.curriculum": "Koulutus / ala"
  ,"profile.card.level": "Taso"
  ,"profile.card.institution": "Oppilaitos"
  ,"profile.card.nativeLanguage": "Äidinkieli"
  ,"profile.card.studyLanguage": "Opiskelukieli"
  ,"profile.card.mobility": "Kansainvälinen liikkuvuus"
  ,"profile.card.mobilityOn": "Opiskelet eri kielellä kuin äidinkielelläsi: automaattinen kielituki ja kontekstuaalinen kielikylpy ovat käytössä."
  ,"profile.card.mobilityOff": "Ota tämä käyttöön, jos opiskelet muulla kuin äidinkielelläsi."
  ,"profile.card.languageSupport": "🌍 Kielituki käytössä"
  ,"profile.card.aiTeacher": "Tekoälyprofessori"
  ,"profile.card.posture": "Opetustapa"
  ,"profile.card.toneSupportive": "🟢 Kannustava"
  ,"profile.card.toneBalanced": "🟡 Haastava"
  ,"profile.card.toneDemanding": "🔴 Tiukka / arvioiva"
  ,"profile.card.explanations": "Selitykset"
  ,"profile.card.explShort": "Lyhyet"
  ,"profile.card.explBalanced": "Tasapainoiset"
  ,"profile.card.explDetailed": "Yksityiskohtaiset"
  ,"profile.card.cognitive": "Kognitiivinen profiili (digitaalinen kaksonen)"
  ,"profile.card.strengths": "Vahvuutesi"
  ,"profile.card.strengthsEmpty": "Ne tulevat näkyviin oppimisesi edetessä."
  ,"profile.card.targetRetention": "Tavoiteltu muistissa säilyminen"
  ,"profile.card.target90": "90 %:n tavoite"
  ,"profile.card.retentionCurrent": "nykyinen · tavoite 90 %"
  ,"profile.card.dailyPace": "Päivittäinen tahti"
  ,"profile.card.minDay": "min / päivä"
  ,"profile.card.systemData": "Järjestelmä ja tiedot"
  ,"profile.card.theme": "Teema"
  ,"profile.card.light": "☀︎ Vaalea"
  ,"profile.card.dark": "☾ Tumma"
  ,"profile.card.system": "⚙︎ Järjestelmä"
  ,"profile.card.statistics": "Tilastot"
  ,"profile.card.concepts": "käsitettä"
  ,"profile.card.reviews": "kertausta"
  ,"profile.card.privacyMemory": "Tietosuoja ja muisti"
  ,"profile.card.privacyData": "🔒 Tietosuoja ja tiedot"
  ,"profile.card.vectorMemory": "🧠 Hallitse vektorimuistia"
  ,"profile.card.cat.child": "Lapsi"
  ,"profile.card.cat.student": "Opiskelija"
  ,"profile.card.cat.researcher": "Tutkija"
  ,"profile.card.cat.adult": "Aikuinen"
  ,"profile.card.cat.language": "Kieltenopiskelija"
  ,"brain.panel.overview": "Yleiskatsaus"
  ,"brain.panel.mastered": "hallittu"
  ,"brain.panel.fragile": "hauras"
  ,"brain.panel.average": "keskimääräinen hallinta"
  ,"brain.panel.cognitive": "Kognitiivinen profiili"
  ,"brain.panel.cognitiveEmpty": "Tietoja ei vielä ole riittävästi profiilisi kartoittamiseen."
  ,"brain.panel.indicators": "Sisäisiä hallinnan mittareita, ei kouluarvosanoja."
  ,"brain.panel.maturity": "kypsyys"
  ,"brain.panel.dnaEmpty": "Oppimis-DNA:si muotoutuu, kun suoritat istuntoja."
  ,"brain.panel.dnaNote": "Kehittyviä havaintoja, ei diagnoosi."
  ,"brain.panel.studied": "opiskeltu"
  ,"brain.panel.toReview": "kerrattavaa"
  ,"brain.panel.memoryNote": "Second Brain seuraa automaattisesti tietojesi muuttumista."
  ,"brain.panel.attention": "Huomiotasi tarvitsevat asiat"
  ,"brain.panel.reviewNow": "Kertaa nyt"
  ,"brain8.intro": "Elävä näkymä siihen, mitä tiedät, miten opit, mikä on muuttumassa hauraaksi ja mitä tehdä seuraavaksi."
  ,"brain8.nav.overview": "Yleiskatsaus"
  ,"brain8.nav.knowledge": "Tietämys"
  ,"brain8.nav.learning": "Miten opin"
  ,"brain8.nav.memory": "Muisti"
  ,"brain8.nav.history": "Historia"
  ,"brain8.map.title": "Elävä tietämyskarttasi"
  ,"brain8.maturity.sparse": "Muotoutumassa"
  ,"brain8.maturity.medium": "Yhdistetty"
  ,"brain8.maturity.dense": "Tutkittavissa"
  ,"brain8.maturity.sparse.detail": "Second Brain aloittaa ensimmäisistä todellisista lähteistäsi ja toiminnoistasi."
  ,"brain8.maturity.medium.detail": "Käsitteesi, harjoittelusi ja lähteesi paljastavat nyt hyödyllisiä malleja."
  ,"brain8.maturity.dense.detail": "Kartallasi on riittävästi näyttöä kohdennettuun tutkimiseen ja suodattamiseen."
  ,"brain8.metrics.concepts": "käsitettä"
  ,"brain8.metrics.connections": "yhteyttä"
  ,"brain8.metrics.events": "oppimistapahtumaa"
  ,"brain8.sparse.title": "Aivosi ovat muotoutumassa"
  ,"brain8.sparse.detail": "Opi, tuo lähde tai aseta tavoite. Jokainen todellinen vuorovaikutus rikastaa tätä näkymää."
  ,"brain8.action.learn": "Aloita oppiminen"
  ,"brain8.action.import": "Tuo lähde"
  ,"brain8.action.goal": "Aseta tavoite"
  ,"brain8.recent.documents": "Viimeaikaiset lähteet"
  ,"brain8.recent.knowledge": "Viimeksi aktivoitu tietämys"
  ,"brain8.openKnowledge": "Tutki"
  ,"brain8.knowledge.empty": "Vastaavaa käsitettä ei vielä ole saatavilla."
  ,"brain8.knowledge.list": "Saavutettava luettelo"
  ,"brain8.knowledge.graph": "Visuaalinen kartta"
  ,"brain8.graph.bounded": "{shown}/{total} käsitettä on ladattu. Rajaa karttaa haulla tai lataamalla lisää."
  ,"brain8.loadMore": "Lataa lisää"
  ,"brain8.mastery.unknown": "Ei mitattu"
  ,"brain8.mastery.unknown.detail": "Hallintaa ei mitata ennen kuin kertausnäyttöä on riittävästi."
  ,"brain8.mastery.value": "Arvioitu hallinta: {value} %"
  ,"brain8.strength.title": "Vahvuudet ja hauras tietämys"
  ,"brain8.strength.note": "Nämä mittarit perustuvat kerrattuun tietämykseen, eivät kouluarvosanoihin."
  ,"brain8.nba.badge": "Paras seuraava toiminto"
  ,"brain8.nba.learn.title": "Ymmärrä {concept}"
  ,"brain8.nba.learn.reason": "Tämä käsite on valmis tai jo työn alla nykyisellä tietämysreitilläsi."
  ,"brain8.nba.learn.action": "Kysy professorilta"
  ,"brain8.nba.review.title": "Vahvista: {concept}"
  ,"brain8.nba.review.reason": "Nykyiset kertaus- ja muistisignaalisi osoittavat, että tämä käsite tarvitsee huomiota."
  ,"brain8.nba.review.action": "Kertaa nyt"
  ,"brain8.nba.why": "Miksi tämä?"
  ,"brain8.nba.hideWhy": "Piilota selitys"
  ,"brain8.nba.due": "{count} linkitettyä kertausta on ajankohtaisena."
  ,"brain8.memory.title": "Oppimismuisti"
  ,"brain8.memory.reviews": "suoritettua kertausta"
  ,"brain8.memory.due": "ajankohtaista kertausta"
  ,"brain8.memory.sources": "opittua lähdettä"
  ,"brain8.memory.note": "Tässä lasketaan vain tallennetut oppitunnit, lähteet ja kertaukset."
  ,"brain8.memory.open": "Avaa muisti"
  ,"brain8.memory.fragile": "Vahvistettava tietämys"
  ,"brain8.memory.review": "Avaa Kertaus"
  ,"brain8.declared.title": "Second Brain: sille kertomani asiat"
  ,"brain8.declared.detail": "Nimenomaiset oppimis- ja professoriasetuksesi."
  ,"brain8.declared.empty": "Ilmoitettuja mieltymyksiä ei vielä ole. Voit täydentää niitä profiilissasi."
  ,"brain8.observed.title": "Mitä Second Brain havaitsee"
  ,"brain8.observed.detail": "Todellisista vuorovaikutuksista johdettuja malleja, jotka näytetään vain riittävän näytön perusteella."
  ,"brain8.observed.empty": "Toimintaa ei vielä ole riittävästi luotettavan mallin tunnistamiseen."
  ,"brain8.observed.evidence": "Perustuu {count} tallennettuun vuorovaikutukseen."
  ,"brain8.observed.style.voice": "Käyttää usein ääntä"
  ,"brain8.observed.style.handsOn": "Oppii harjoittelemalla"
  ,"brain8.observed.style.reading": "Oppii lukemalla"
  ,"brain8.observed.depth.simple": "Suosii tiiviitä selityksiä"
  ,"brain8.observed.depth.balanced": "Käyttää tasapainoisia selityksiä"
  ,"brain8.observed.depth.deep": "Työskentelee yksityiskohtaisten selitysten parissa"
  ,"brain8.observed.rhythm.occasional": "Satunnainen rytmi"
  ,"brain8.observed.rhythm.regular": "Säännöllinen rytmi"
  ,"brain8.observed.rhythm.intensive": "Intensiivinen rytmi"
  ,"brain8.observed.focus.morning": "Aktiivisempi aamuisin"
  ,"brain8.observed.focus.afternoon": "Aktiivisempi iltapäivisin"
  ,"brain8.observed.focus.evening": "Aktiivisempi iltaisin"
  ,"brain8.observed.focus.night": "Aktiivisempi öisin"
  ,"brain8.dna.title": "Oppimis-DNA"
  ,"brain8.dna.note": "Kehittyviä havaintoja, ei diagnoosi tai pysyvä identiteetti."
  ,"brain8.dna.empty": "Oppimis-DNA tulee näkyviin, kun toistuvat vuorovaikutukset tarjoavat riittävästi näyttöä."
  ,"brain8.history.title": "Kognitiivinen historia"
  ,"brain8.history.empty": "Oppimistapahtumia ei ole vielä tallennettu."
  ,"brain8.history.kind.lesson": "Oppitunti"
  ,"brain8.history.kind.success": "Oikea vastaus"
  ,"brain8.history.kind.error": "Korjattu virhe"
  ,"brain8.history.kind.revision": "Kertaus"
  ,"brain8.history.kind.conversation": "Keskustelu professorin kanssa"
  ,"brain8.history.kind.homework": "Kotitehtävä"
  ,"brain8.history.kind.report": "Suoritettu istunto"
  ,"brain8.history.kind.document": "Lähde lisätty"
  ,"brain8.history.kind.concept": "Käsite lisätty"
  ,"brain8.history.kind.connection": "Yhteys luotu"
  ,"brain8.foresight.title": "Näkemys kehityssuunnasta"
  ,"brain8.foresight.forecast": "Ennuste"
  ,"brain8.foresight.note": "Tämä on nykyisiin signaaleihin perustuva arvio, ei tosiasia."
  ,"brain8.foresight.action": "Katso ehdotettu toiminto"
  ,"brain8.foresight.kind.dropout": "Jatkuvuusriski"
  ,"brain8.foresight.kind.difficulty": "Vaikeusriski"
  ,"brain8.foresight.kind.overload": "Ylikuormitusriski"
  ,"brain8.foresight.kind.motivation": "Motivaatioriski"
  ,"brain8.foresight.kind.forgetting": "Unohtumisriski"
  ,"brain8.foresight.reason.dropout": "Viimeaikaiset jatkuvuussignaalisi viittaavat nykyisen rytmisi mahdolliseen katkeamiseen."
  ,"brain8.foresight.reason.difficulty": "Nykyinen hallintapolkusi viittaa mahdolliseen edessä olevaan vaikeuteen."
  ,"brain8.foresight.reason.overload": "Nykyiset työmääräsignaalisi viittaavat mahdolliseen ylikuormitukseen."
  ,"brain8.foresight.reason.motivation": "Viimeaikaiset aktiivisuussignaalisi viittaavat mahdolliseen vauhdin hiipumiseen."
  ,"brain8.foresight.reason.forgetting": "Kertausennusteesi osoittaa, että osaa tiedoista voi olla pian vaikeampi palauttaa mieleen."
  ,"brain8.search.label": "Hae aivoistasi"
  ,"brain8.search.placeholder": "Käsite, lähde tai tavoite…"
  ,"brain8.search.action": "Hae"
  ,"brain8.search.kind.concept": "Käsite"
  ,"brain8.search.kind.document": "Lähde"
  ,"brain8.search.kind.goal": "Tavoite"
  ,"brain8.ask.title": "Kysy aivoiltasi…"
  ,"brain8.ask.detail": "Second Brain vastaa vain käsitteidesi ja lähteidesi perusteella."
  ,"brain8.ask.placeholder": "Mitä tiedän verkoista?"
  ,"brain8.ask.action": "Kysy"
  ,"brain8.ask.answer.weakest": "Hallintasignaaleistasi löytyi {count} haurasta käsitettä."
  ,"brain8.ask.answer.neglected": "Löytyi {count} käsitettä, joiden kertaus on ajankohtainen."
  ,"brain8.ask.answer.documents": "Löytyi {count} vastaavaa lähdettä tai käsitettä."
  ,"brain8.ask.answer.knowledge": "Aivoistasi löytyi {count} vastaavaa kohdetta."
  ,"brain8.ask.answer.no-results": "Nykyiset tietosi eivät tue vastausta tähän kysymykseen."
  ,"brain8.ask.grounded": "Vastaus rajoittuu pysyvästi tallennettuihin Second Brain -tietoihisi."
  ,"brain8.concept.pick": "Valitse käsite tarkastellaksesi sen näyttöä ja yhteyksiä."
  ,"brain8.concept.cards": "{count} korttia"
  ,"brain8.concept.due": "{count} ajankohtaisena"
  ,"brain8.concept.stability": "Muistin vakaus {days} päivää"
  ,"brain8.concept.nextReview": "Seuraava ajoitettu kertaus: {date}"
  ,"brain8.concept.tutor": "Kysy professorilta"
  ,"brain8.concept.practice": "Harjoittele"
  ,"brain8.concept.review": "Kertaa"
  ,"brain8.concept.sources": "Lähteet"
  ,"brain8.concept.relations": "Yhteydet"
  ,"brain8.concept.activity": "Viimeaikaiset vuorovaikutukset"
  ,"brain8.concept.truncated": "Vain ensimmäiset saatavilla olevat lähteet näytetään."
  ,"brain8.relation.prerequisite": "esitieto"
  ,"brain8.relation.related": "liittyvä"
  ,"brain8.context.document": "Aktiivinen asiakirja"
  ,"brain8.context.session": "Professori-istunto"
  ,"brain8.context.goal": "Oppimistavoite"
  ,"brain8.partial": "Jotkin osiot ovat tilapäisesti poissa käytöstä; saatavilla olevia tietoja voi edelleen käyttää."
  ,"brain8.error.load": "Aivojasi ei voitu ladata juuri nyt."
  ,"tutor6.result.brain": "Näytä vaikutus aivoihini"
  ,"voice.error.playback": "Opettajasi ääntä ei voitu toistaa."
  ,"voice.error.blocked": "Äänen toisto estettiin."
  ,"voice.error.recordUnsupported": "Äänen tallennus ei ole käytettävissä tällä laitteella."
  ,"voice.error.micDenied": "Mikrofonin käyttö estettiin. Salli mikrofonin käyttö ja yritä uudelleen."
  ,"voice.error.notRecording": "Tallennus ei ole käynnissä."
  ,"voice.error.empty": "Mitään ei tallennettu. Tarkista mikrofonisi ja yritä uudelleen."
  ,"error.timeout": "Pyyntö kesti liian kauan. Yritä uudelleen."
  ,"error.unauthorized": "Istuntosi on vanhentunut tai tunnistetiedot ovat virheelliset."
  ,"error.forbidden": "Tämä toiminto ei ole käytettävissä tällä tilillä."
  ,"error.notFound": "Pyydetty kohde ei ole enää saatavilla."
  ,"error.conflict": "Tämä muutos on ristiriidassa nykyisen tilan kanssa. Päivitä ja yritä uudelleen."
  ,"error.rateLimit": "Liian monta yritystä. Odota hetki ennen uutta yritystä."
  ,"error.validation": "Jotkin tiedot ovat virheellisiä. Tarkista kentät ja yritä uudelleen."
  ,"error.upload": "Lataus epäonnistui. Nykyinen työsi säilytettiin."
  ,"error.download": "Tiedostoa ei voitu ladata. Yritä uudelleen."
  ,"onb.languages.explanation": "Selityskieli"
  ,"onb.languages.explanationWhy": "Tekoälyprofessori käyttää tätä kieltä yleisiin selityksiin ja ohjaukseen."
  ,"mfa.title": "Kaksivaiheinen vahvistus"
  ,"mfa.intro": "Suojaa tilisi todennussovelluksen koodilla."
  ,"mfa.profileTitle": "Tilin turvallisuus"
  ,"mfa.profileDetail": "Määritä kaksivaiheinen vahvistus suojatulla verkkokäyttöönoton sivulla."
  ,"mfa.open": "Määritä kaksivaiheinen vahvistus"
  ,"mfa.idleTitle": "Lisää todennussovellus"
  ,"mfa.idleDetail": "Aloita vasta, kun todennussovelluksesi on valmis. Uusi yksityinen määritysavain luodaan."
  ,"mfa.start": "Aloita suojattu määritys"
  ,"mfa.setupTitle": "Yhdistä todentajasi"
  ,"mfa.setupDetail": "Lisää tili manuaalisesti alla olevalla avaimella tai tuo otpauth-URI yhteensopivaan todennussovellukseen."
  ,"mfa.secretLabel": "Manuaalinen Base32-avain"
  ,"mfa.secretWarning": "Käsittele tätä avainta kuin salasanaa. Älä jaa sitä tai tallenna sitä suojaamattomaan muistiinpanoon."
  ,"mfa.uriLabel": "Todentajan URI"
  ,"mfa.uriDetail": "Käytä tätä vain luottamassasi todennussovelluksessa."
  ,"mfa.codeLabel": "6-numeroinen todennuskoodi"
  ,"mfa.codeHint": "Anna todennussovelluksesi näyttämä nykyinen 6-numeroinen koodi."
  ,"mfa.enable": "Vahvista ja ota käyttöön"
  ,"mfa.alreadyEnabled": "Kaksivaiheinen vahvistus saattaa jo olla käytössä. Varmista se kirjautumalla ulos ja takaisin sisään."
  ,"mfa.setupError": "Suojattua määritystä ei voitu aloittaa. Mitään ei otettu käyttöön. Yritä uudelleen."
  ,"mfa.enableError": "Koodia ei voitu vahvistaa. Tarkista nykyinen koodi ja yritä uudelleen."
  ,"mfa.recoveryTitle": "Tallenna palautuskoodisi nyt"
  ,"mfa.recoveryWarning": "Nämä koodit näytetään vain kerran."
  ,"mfa.recoveryDetail": "Tallenna ne luotettavaan salasanojen hallintaan tai muuhun turvalliseen paikkaan ennen tältä näytöltä poistumista."
  ,"mfa.saved": "Tallensin palautuskoodini"
  ,"mfa.doneTitle": "Kaksivaiheinen vahvistus on käytössä"
  ,"mfa.doneDetail": "Seuraava kirjautumisesi vaatii todentajan tai yhden käyttämättömän palautuskoodin."
  ,"mfa.backProfile": "Takaisin Profiiliin"
  ,"nav.back": "Takaisin"
  ,"shell.backToApp": "Takaisin sovellukseen"
  ,"shell.adminArea": "Hallinta"
  ,"shell.technicalArea": "Tekninen alue"
  ,"shell.demoArea": "Demoalue"
  ,"shell.legacyArea": "Vanha käyttökokemus"
  ,"shell.designSystem": "Suunnittelujärjestelmä"
  ,"learn.backToLearn": "Takaisin Oppimiseen"
  ,"learn.free.kicker": "Vapaa haku"
  ,"learn.free.title": "Kysy mitä tahansa"
  ,"learn.free.subtitle": "Spontaani kysymys — akateeminen, tekninen tai yleinen. Eri asia kuin pedagoginen tekoälyprofessorisi."
  ,"learn.free.placeholder": "Kirjoita kysymyksesi…"
  ,"learn.free.submit": "Kysy"
  ,"learn.deep.kicker": "Syvätutkimus"
  ,"learn.deep.title": "Tutki aihetta perusteellisesti"
  ,"learn.deep.subtitle": "Professori tutkii aihettasi perusteellisesti ja palauttaa jäsennellyn analyysin."
  ,"learn.deep.placeholder": "Mitä haluat tutkia perusteellisesti?"
  ,"learn.deep.submit": "Tutki"
  ,"learn.deep.frame": "Laadi perusteellinen, jäsennelty analyysi (konteksti, pääkohdat, vivahteet, johtopäätös) aiheesta:"
  ,"learn.deep.note": "Ajantasaiset lähteet ja vaiheittainen tutkimussuunnitelma tulevat saataville taustajärjestelmän kehittyessä."
  ,"learn.oral.kicker": "Suullinen harjoitus"
  ,"learn.oral.title": "Vastaa ääneen"
  ,"learn.oral.subtitle": "Professori esittää kysymyksiä; vastaa puhumalla, niin hän arvioi sinua."
  ,"learn.oral.frame": "Järjestä profiiliini sopiva lyhyt suullinen harjoitus. Kysy yksi kysymys kerrallaan; vastaan puhumalla."
  ,"learn.oral.record": "Vastaa puhumalla"
  ,"learn.oral.stop": "Lopeta"
  ,"learn.oral.ready": "Valmis"
  ,"learn.oral.recording": "Kuunnellaan…"
  ,"learn.oral.analyzing": "Analysoidaan…"
  ,"learn.oral.you": "Sinä"
  ,"learn.oral.teacher": "Professori"
  ,"learn.oral.noVoice": "Puheen tallennus ei ole käytettävissä tällä laitteella."
  ,"learn.oral.starting": "Valmistellaan harjoitusta…"
  ,"learn.explain.kicker": "Selitä"
  ,"learn.explain.title": "Pyydä selitys käsitteelle"
  ,"learn.explain.subtitle": "Selkeä, valitsemasi tasoinen selitys esimerkkeineen ja vertauksineen."
  ,"learn.explain.levelLabel": "Taso"
  ,"learn.explain.lvlBeginner": "Aloittelija"
  ,"learn.explain.lvlIntermediate": "Keskitaso"
  ,"learn.explain.lvlAdvanced": "Edistynyt"
  ,"learn.explain.placeholder": "Minkä käsitteen haluat ymmärtää?"
  ,"learn.explain.submit": "Selitä"
  ,"learn.explain.frame": "Selitä tämä käsite selkeästi käyttäen esimerkkejä ja vertauksia. Taso:"
  ,"learn.discuss.kicker": "Keskustelu"
  ,"learn.discuss.title": "Keskustele professorin kanssa"
  ,"learn.discuss.subtitle": "Vapaa pedagoginen keskustelu — professori tuntee tasosi ja tavoitteesi."
  ,"learn.discuss.placeholder": "Mistä haluaisit keskustella?"
  ,"learn.discuss.submit": "Aloita"
  ,"learn.exam.kicker": "Suullinen koe"
  ,"learn.exam.title": "Suullisen kokeen simulaatio"
  ,"learn.exam.subtitle": "Professori toimii arvioijana: hän kysyy, sinä vastaat ääneen, minkä jälkeen hän arvioi sinut."
  ,"learn.exam.consignes": "Vastaa ääneen, yksi kysymys kerrallaan. Käytä tarvitsemasi aika."
  ,"learn.exam.start": "Aloita koe"
  ,"learn.exam.starting": "Koe alkaa…"
  ,"learn.exam.elapsed": "Aika"
  ,"learn.exam.examiner": "Arvioija"
  ,"learn.exam.end": "Lopeta koe"
  ,"learn.exam.evaluating": "Arvioidaan…"
  ,"learn.exam.startFrame": "Pidä minulle suullinen koe. Kerro ensin lyhyesti aihealue ja esitä sitten ensimmäinen kysymys. Yksi kysymys kerrallaan; vastaan ääneen."
  ,"learn.exam.endFrame": "Lopeta koe nyt. Anna arvio: vahvuudet, kehityskohteet ja suositukset. Ole pedagoginen."
  ,"teach.kicker": "Opeta"
  ,"teach.title": "Mitä minun pitäisi opettaa sinulle?"
  ,"teach.subtitle": "Nimeä aihe, niin professori rakentaa sinulle vaiheittaisen oppitunnin."
  ,"teach.placeholder": "Esim. fotosynteesi, Ranskan vallankumous, derivaatat…"
  ,"teach.submit": "Luo oppitunti"
  ,"learn.mode.errTitle": "Tuntematon oppimiskokemus"
  ,"learn.mode.errDetail": "Tätä oppimistilaa ei ole olemassa tai se ei ole vielä käytettävissä."
  ,"home4.loading": "Valmistellaan seuraavaa hyödyllistä toimintoasi…"
  ,"home4.context.new": "Rakennetaan oma Second Brain -järjestelmäsi."
  ,"home4.context.active": "Tässä on nykyisen edistymisesi perusteella hyödyllisin seuraava vaihe."
  ,"home4.context.exam": "{focus}-kokeesi lähestyy."
  ,"home4.context.revision": "Muistissasi on aidosti ajankohtaista työtä."
  ,"home4.context.resume": "Voit jatkaa kohdetta {focus} menettämättä kontekstia."
  ,"home4.context.caught-up": "Olet ajan tasalla. Keinotekoista kiirettä ei ole."
  ,"home4.recommended": "Suositus nyt"
  ,"home4.whyClose": "Piilota perusteet"
  ,"home4.whyIntro": "Perustuu näihin todennettaviin signaaleihin:"
  ,"home4.confidence": "Arvioitu varmuus: {value} %"
  ,"home4.resume": "Jatka siitä, mihin jäit"
  ,"home4.resumeDetail": "Viimeisimmät istuntosi säilyttävät kontekstinsa ja työsi."
  ,"home4.resumeAction": "Jatka"
  ,"home4.session.type.learning": "Oppiminen"
  ,"home4.session.type.tutor": "Ohjaus"
  ,"home4.session.type.research": "Tutkimus"
  ,"home4.session.type.review": "Kertaus"
  ,"home4.session.type.language": "Kieli"
  ,"home4.session.type.workspace": "Työtila"
  ,"home4.session.type.document-processing": "Asiakirja"
  ,"home4.lastActivity": "Viimeisin toiminta"
  ,"home4.artifact": "Viimeisin työ"
  ,"home4.upcoming": "Tulossa"
  ,"home4.upcomingDetail": "Seuraavat huomiotasi tarvitsevat oppimistapahtumat."
  ,"home4.upcomingEmpty": "Mitään ei ole pian ajoitettuna."
  ,"home4.planning": "Oppimiskalenteri"
  ,"home4.upcoming.kind.exam": "Koe"
  ,"home4.upcoming.kind.homework": "Kotitehtävä"
  ,"home4.upcoming.kind.practical": "Käytännön harjoitus"
  ,"home4.upcoming.kind.language": "Kieliharjoitus"
  ,"home4.upcoming.kind.aiSession": "Tekoälyistunto"
  ,"home4.upcoming.kind.revision": "Kertaus"
  ,"home4.upcoming.kind.quiz": "Tietovisa"
  ,"home4.upcoming.kind.objective": "Tavoite"
  ,"home4.upcoming.kind.deadline": "Määräaika"
  ,"home4.mainGoal": "Päätavoite"
  ,"home4.goal.period.daily": "Päivätavoite"
  ,"home4.goal.period.weekly": "Viikkotavoite"
  ,"home4.goal.period.monthly": "Kuukausitavoite"
  ,"home4.goal.open": "Avaa tavoite"
  ,"home4.progress.title": "Edistymisesi"
  ,"home4.progress.detail": "Tiivis näkymä oppimisessasi tapahtuviin muutoksiin."
  ,"home4.progress.due": "ajankohtaista kertausta"
  ,"home4.progress.mastered": "hallittua käsitettä"
  ,"home4.progress.streak": "päivän putki"
  ,"home4.progress.open": "Avaa Omat aivoni"
  ,"home4.other": "Muita tapoja aloittaa"
  ,"home4.otherDetail": "Tallenna tai ilmaise jotakin, kun suositus ei vastaa tarvettasi."
  ,"home4.date.today": "Tänään"
  ,"home4.date.tomorrow": "Huomenna"
  ,"home4.date.yesterday": "Eilen"
  ,"home4.date.unknown": "Tuntematon päivämäärä"
  ,"home4.partial": "Jotkin lähteet ovat tilapäisesti poissa käytöstä. Saatavilla olevat prioriteetit käyttävät silti todennettuja tietoja."
  ,"home4.stale": "Näytetään viimeisin saatavilla oleva Kotisi päivitysyrityksen aikana."
  ,"home4.unavailable": "Todennettua prioriteettia ei voitu ladata juuri nyt."
  ,"learn5.eyebrow": "Opi"
  ,"learn5.title": "Aloita siitä, mitä haluat saavuttaa"
  ,"learn5.subtitle": "Kysy, puhu, tallenna tai tuo. Second Brain valitsee aikomukseesi sopivan nykyisen kokemuksen ja säilyttää kontekstisi."
  ,"learn5.question": "Mitä haluat oppia tai tehdä?"
  ,"learn5.composer.badge": "Yksi älykäs aloituspiste"
  ,"learn5.composer.detail": "Kuvaile tavoite omin sanoin. Aikomuksen valitseminen on vapaaehtoista."
  ,"learn5.composer.placeholder": "Esimerkiksi: selitä fotosynteesi, auta minua harjoittelemaan espanjaa tai luo muistiinpanoistani tietovisa…"
  ,"learn5.composer.inputLabel": "Mitä haluat oppia tai saavuttaa"
  ,"learn5.composer.submit": "Jatka"
  ,"learn5.examples.label": "Kokeile jotakin näistä"
  ,"learn5.examples.understand": "Ymmärrä aihe"
  ,"learn5.examples.understandPrompt": "Selitä minulle tämä aihe: "
  ,"learn5.examples.practice": "Harjoittele kieltä"
  ,"learn5.examples.practicePrompt": "Auta minua harjoittelemaan englanninkielistä keskustelua"
  ,"learn5.examples.scan": "Skannaa sivu"
  ,"learn5.examples.import": "Tuo kurssi"
  ,"learn5.intent.label": "Aikomus (valinnainen)"
  ,"learn5.intent.understand": "Ymmärrä"
  ,"learn5.intent.learn": "Opi"
  ,"learn5.intent.practice": "Harjoittele"
  ,"learn5.intent.research": "Tutki"
  ,"learn5.intent.create": "Luo"
  ,"learn5.intent.suggested": "ehdotettu"
  ,"learn5.depth.label": "Tutkimuksen syvyys"
  ,"learn5.depth.quick": "Nopea vastaus"
  ,"learn5.depth.standard": "Tutkimus"
  ,"learn5.depth.deep": "Syvätutkimus"
  ,"learn5.modality.write": "Kirjoita"
  ,"learn5.modality.speak": "Puhu"
  ,"learn5.modality.capture": "Tallenna"
  ,"learn5.modality.import": "Tuo"
  ,"learn5.modality.export": "Vie"
  ,"learn5.modality.exportData": "Avaa tietojesi vienti"
  ,"learn5.route.prefix": "Seuraavaksi:"
  ,"learn5.route.capture": "avaa skanneri, esikatsele sivut ja vahvista."
  ,"learn5.route.import": "tuo tämä tiedosto Kirjastoon ja sen ymmärtämisputkeen."
  ,"learn5.route.voice": "aloita puhuttu vuoro tekoälyprofessorisi kanssa."
  ,"learn5.route.free-question": "kysy suoraan tekoälyprofessoriltasi."
  ,"learn5.route.document-understanding": "kysy aktiivisesta asiakirjasta lähteisiin perustuvin vastauksin."
  ,"learn5.route.concept-explanation": "avaa kohdennettu selitys aktiiviselle käsitteelle."
  ,"learn5.route.explanation": "pyydä tekoälyprofessoriltasi jäsennelty selitys."
  ,"learn5.route.lesson": "luo ohjattu oppitunti tästä aiheesta."
  ,"learn5.route.guided-session": "aloita nykyinen ohjattu istunto."
  ,"learn5.route.learning-path": "avaa mukautuva oppimispolkusi."
  ,"learn5.route.document-learning": "opi aktiivisesta asiakirjasta."
  ,"learn5.route.practice": "valmistele harjoitus."
  ,"learn5.route.document-practice": "luo aktiivisesta asiakirjasta harjoitusmuoto."
  ,"learn5.route.oral-practice": "avaa suullinen harjoitus professorin kanssa."
  ,"learn5.route.language-practice": "jatka erikoistuneessa kielitilassa."
  ,"learn5.route.research-quick": "saa professorilta tiivis vastaus."
  ,"learn5.route.research-library": "tutki Kirjastosi ja näkyvien lähteidesi laajuisesti."
  ,"learn5.route.research-deep": "avaa edistynyt syvätutkimuskokemus."
  ,"learn5.route.create-quiz": "valmistele tietovisa arviointityötilassa."
  ,"learn5.route.create-course": "luo ohjattu kurssi."
  ,"learn5.route.create-work": "avaa Akateeminen työtila näillä ohjeilla."
  ,"learn5.route.create-from-document": "luo aktiivisesta asiakirjasta."
  ,"learn5.clarify.question": "Mitä haluaisit tehdä tämän aiheen parissa?"
  ,"learn5.deep.confirmTitle": "Syvätutkimus käyttää edistynyttä työnkulkua"
  ,"learn5.deep.confirmDetail": "Se voi kestää pidempään ja käyttää enemmän käyttövarastasi. Pyyntösi säilyy, jos palvelu ei ole käytettävissä."
  ,"learn5.deep.confirm": "Vahvista syvätutkimus"
  ,"learn5.attachment.ready": "valmis tuotavaksi"
  ,"learn5.attachment.remove": "Poista"
  ,"learn5.attachment.import": "Tuo ja jatka"
  ,"learn5.attachment.error": "Tätä tiedostoa ei voitu valita."
  ,"learn5.attachment.missing": "Valitse tiedosto uudelleen ennen tuontia."
  ,"learn5.capture.title": "Tallenna tai tuo"
  ,"learn5.capture.detail": "Skannaus esikatsellaan ennen lähetystä. Tiedostot liittyvät samaan asiakirjojen ymmärtämisputkeen."
  ,"learn5.capture.scan": "Valokuvaa tai skannaa sivu"
  ,"learn5.capture.file": "Valitse tiedosto"
  ,"learn5.voice.stop": "Lopeta ja lähetä"
  ,"learn5.voice.error": "Tallennusta ei voitu suorittaa loppuun."
  ,"learn5.voice.missing": "Lähetettävää tallennetta ei ole valmiina."
  ,"learn5.voice.unavailable": "Mikrofoni ei ole käytettävissä tällä laitteella"
  ,"learn5.error.generic": "Tätä toimintoa ei voitu aloittaa."
  ,"learn5.error.preserved": "Tekstisi, kontekstisi ja liitteesi säilytettiin. Voit yrittää uudelleen tai käyttää muuta toimintoa, joka ei tarvitse tekoälyä."
  ,"learn5.draft.restored": "Luonnos palautettu"
  ,"learn5.draft.restoredDetail": "Edellinen pyyntösi ja sen konteksti ovat yhä täällä."
  ,"learn5.draft.clear": "Tyhjennä"
  ,"learn5.cancel": "Peruuta"
  ,"learn5.context.user-profile": "Profiili"
  ,"learn5.context.brain": "Omat aivoni"
  ,"learn5.context.document": "Asiakirja"
  ,"learn5.context.document-collection": "Asiakirjakokoelma"
  ,"learn5.context.concept": "Käsite"
  ,"learn5.context.lesson": "Oppitunti"
  ,"learn5.context.goal": "Tavoite"
  ,"learn5.context.exam": "Koe"
  ,"learn5.context.language": "Opiskeltava kieli"
  ,"learn5.context.workspace": "Työtila"
  ,"learn5.context.tutor-session": "Ohjausistunto"
  ,"learn5.context.research": "Tutkimus"
  ,"learn5.context.revision": "Kertaus"
  ,"learn5.context.learning-path": "Oppimispolku"
  ,"learn5.resume.unavailable": "Istunnot ovat tilapäisesti poissa käytöstä"
  ,"learn5.resume.unavailableDetail": "Kirjoituskenttä on edelleen käytettävissä, ja luonnoksesi säilytetään."
  ,"learn5.spaces.title": "Erikoistuneet tilat"
  ,"learn5.spaces.detail": "Avaa oma ympäristö, kun tehtävä hyötyy siitä."
  ,"learn5.spaces.languages": "Kielet"
  ,"learn5.spaces.languagesDetail": "Kielikylpy, ääntäminen ja keskustelu."
  ,"learn5.spaces.library": "Kirjasto"
  ,"learn5.spaces.libraryDetail": "Asiakirjasi ja lähteesi yhdessä paikassa."
  ,"learn5.spaces.workspace": "Akateeminen työtila"
  ,"learn5.spaces.workspaceDetail": "Luo ja paranna jäsenneltyjä akateemisia töitä."
  ,"learn5.advanced.title": "Edistyneet tilat"
  ,"learn5.advanced.detail": "Nykyiset erikoistuneet kokemukset, kun haluat suoran hallinnan."
  ,"learn5.advanced.explain": "Selitä"
  ,"learn5.advanced.teach": "Opeta minua"
  ,"learn5.advanced.guided": "Ohjattu istunto"
  ,"learn5.advanced.oral": "Suullinen harjoitus"
  ,"learn5.advanced.exam": "Suullinen koe"
  ,"learn5.advanced.deep": "Syvätutkimus"
  ,"teacher.mode.lesson": "Oppitunti"
  ,"teacher.mode.exercise": "Harjoitus"
  ,"teacher.mode.training": "Harjoittelu"
  ,"teacher.mode.assessed": "Arvioitu"
  ,"teacher.mode.exam": "Koe"
  ,"teacher.exam.rulesTitle": "Kokeen säännöt"
  ,"teacher.exam.mode": "Koetila"
  ,"teacher.exam.grading": "Arvostelu"
  ,"teacher.exam.rubric": "Arviointiperusteet"
  ,"teacher.exam.help": "Sallittu apu"
  ,"teacher.exam.helpLimited": "Rajoitettu apu"
  ,"teacher.exam.helpNone": "Ei apua"
  ,"teacher.exam.feedbackAfter": "Palaute palautuksen jälkeen"
  ,"profile.intro": "Hallitse identiteettiäsi, Second Brain -asetuksia, kieliä, tilausta ja tietoja."
  ,"profile.section.myProfile": "Oma profiilini"
  ,"profile.section.myProfileDetail": "Identiteettisi ja koko tuotteessa käytetty oppimiskonteksti."
  ,"profile.section.personalization": "Second Brain -palvelun personointi"
  ,"profile.section.personalizationDetail": "Valitse, miten tekoälyprofessorisi opettaa. Yksityiskohtainen Oppimis-DNA:si säilyy Omissa aivoissani."
  ,"profile.section.languages": "Kielet ja kokemus"
  ,"profile.section.languagesDetail": "Aseta käyttöliittymän kieli erikseen opiskelemastasi kielestä."
  ,"profile.section.billing": "Tilaus ja käyttö"
  ,"profile.section.billingDetail": "Katso nykyinen tilauksesi, todelliset rajat, jäljellä oleva käyttö ja nollauspäivät."
  ,"profile.section.privacy": "Tiedot ja tietosuoja"
  ,"profile.section.privacyDetail": "Hallitse ulkoasua, tekoälymuistia, asiakirjoja, suostumuksia ja henkilötietojasi."
  ,"profile.billing.current": "Nykyinen tilaus"
  ,"profile.billing.unavailable": "Tilaus ei ole saatavilla"
  ,"profile.billing.usageUnavailable": "Käyttötiedot eivät ole tilapäisesti saatavilla."
  ,"profile.billing.viewUsage": "Näytä käyttö ja kiintiöt"
  ,"profile.brainPreview.title": "Oppimisprofiili"
  ,"profile.brainPreview.detail": "Lyhyt esikatselu. Oppimis-DNA:si, muistisi ja hallintasi ovat Omissa aivoissani."
  ,"profile.brainPreview.empty": "Oppimisprofiilisi tulee näkyviin suoritettuasi istuntoja."
  ,"profile.brainPreview.open": "Avaa Omat aivoni"
  ,"profile.languages.specialized": "Käyttöliittymän kieli on erillinen opiskelemastasi kielestä."
  ,"profile.languages.open": "Avaa Kielet ja kielikylpy"
  ,"profile.privacy.detail": "Yksityiskohtaiset tietosuoja- ja muistiasetuksesi ovat käytettävissä milloin tahansa."
  ,"profile.privacy.memory": "Tekoälymuisti"
  ,"profile.privacy.documents": "Omat asiakirjani"
  ,"profile.partial": "Joitakin profiilitietoja ei voitu päivittää. Saatavilla olevia asetuksia voi edelleen käyttää."
  ,"profile.teacher.title": "Tekoälyprofessorini"
  ,"profile.teacher.detail": "Vähemmän vaativa antaa enemmän vihjeitä ja uusia yrityksiä; Normaali on eloisa, kannustava ja jäsennelty; Vaativa edellyttää syvempää päättelyä ja tarkkoja korjauksia."
  ,"profile.teacher.auto": "Automaattinen mukautuminen"
  ,"profile.teacher.autoDetail": "Second Brain mukauttaa ohjausta, tahtia ja vaikeutta todellisen edistymisesi mukaan. Normaali on oletus ilmoitettujen arviointien ulkopuolella."
  ,"profile.teacher.learning": "Opetustaso"
  ,"profile.teacher.learning.guided": "Vähemmän vaativa"
  ,"profile.teacher.learning.balanced": "Normaali"
  ,"profile.teacher.learning.demanding": "Vaativa"
  ,"profile.teacher.conversation": "Keskustelutila"
  ,"profile.teacher.conversation.training": "Harjoittelu"
  ,"profile.teacher.conversation.assessed": "Arvioitu"
  ,"profile.teacher.conversation.trainingDetail": "Harjoittele vapaasti vihjeiden ja korjausten avulla."
  ,"profile.teacher.conversation.assessedDetail": "Suorita ennalta ilmoitettu arvioitu keskustelu, jossa apu on rajattua ja palaute perustuu näyttöön."
  ,"profile.teacher.exam": "Koetila"
  ,"profile.teacher.exam.standard": "Tavallinen"
  ,"profile.teacher.exam.strict": "Tiukka"
  ,"profile.teacher.examDetail": "Kokeen säännöt ohjaavat käytettävissä olevaa apua, arvostelua ja palautteen ajankohtaa."
  ,"profile.teacher.advancedOpen": "Näytä lisäasetukset"
  ,"profile.teacher.advancedClose": "Piilota lisäasetukset"
  ,"profile.teacher.correction": "Korjauksen ajankohta"
  ,"profile.teacher.correction.immediate": "Korjaa heti"
  ,"profile.teacher.correction.let_me_finish": "Anna minun puhua loppuun"
  ,"profile.teacher.correction.adaptive": "Mukauta tilanteeseen"
  ,"profile.teacher.summary": "Istunnon yhteenveto"
  ,"profile.teacher.encouragement": "Kannustus"
  ,"profile.teacher.encouragement.measured": "Hillitty"
  ,"profile.teacher.encouragement.supportive": "Kannustava"
  ,"profile.teacher.reset": "Palauta oletukset"
  ,"profile.settings.saveError": "Näitä asetuksia ei voitu tallentaa."
  ,"profile.settings.preserved": "Aiemmat asetuksesi säilytettiin."
  ,"tutor.fasterMsg": "Ymmärrän tämän — voitko edetä hieman nopeammin?"
  ,"tutor.loadFailed": "Luokkahuonetta ei voitu avata."
  ,"tutor6.lobby.loading": "Avataan oppimisistuntojasi…"
  ,"tutor6.lobby.eyebrow": "Tekoälyprofessori"
  ,"tutor6.lobby.title": "Mitä haluaisit harjoitella?"
  ,"tutor6.lobby.subtitle": "Jatka täsmälleen siitä oppimisketjusta, johon jäit, tai aloita kohdennettu pyyntö."
  ,"tutor6.lobby.continueTitle": "Jatka siitä, mihin jäit"
  ,"tutor6.lobby.resumeDetail": "Tavoitteesi, kontekstisi ja historiasi säilyvät."
  ,"tutor6.lobby.resume": "Jatka istuntoa"
  ,"tutor6.lobby.newTitle": "Uusi pyyntö"
  ,"tutor6.lobby.placeholder": "Selitä käsite, kuulustele minua, auta harjoittelemaan…"
  ,"tutor6.lobby.start": "Kysy professorilta"
  ,"tutor6.lobby.openSaved": "Avaa tallennettu istunto"
  ,"tutor6.lobby.recent": "Viimeaikaiset istunnot"
  ,"tutor6.lobby.completed": "Suoritetut istunnot"
  ,"tutor6.lobby.modes": "Muita työskentelytapoja"
  ,"tutor6.lobby.mode.explain": "Selitä"
  ,"tutor6.lobby.mode.discuss": "Keskustele"
  ,"tutor6.lobby.mode.oral": "Suullinen harjoitus"
  ,"tutor6.lobby.mode.deep": "Syvätutkimus"
  ,"tutor6.objective": "Oppimistavoite"
  ,"tutor6.strategy": "Opetustapa"
  ,"tutor6.empty": "Esitä ensimmäinen kysymyksesi. Tavoitteesi ja aktiivinen konteksti pysyvät liitettyinä tähän istuntoon."
  ,"tutor6.loading.detail": "Palautetaan tavoite, konteksti ja viimeaikainen keskustelu."
  ,"tutor6.backTutor": "Takaisin Professorille"
  ,"tutor6.pause": "Keskeytä ja poistu"
  ,"tutor6.complete": "Päätä istunto"
  ,"tutor6.options": "Istunnon asetukset"
  ,"tutor6.state.ready": "Valmis"
  ,"tutor6.state.listening": "Kuunnellaan"
  ,"tutor6.state.transcription": "Muunnetaan puhettasi tekstiksi…"
  ,"tutor6.state.thinking": "Professori valmistelee vastausta…"
  ,"tutor6.state.response": "Vastaus on valmis"
  ,"tutor6.state.error": "Toimenpiteitä tarvitaan"
  ,"tutor6.voice.heard": "Litterointi säilytetty: “{text}”"
  ,"tutor6.voice.saved": "Puhuttu vuorosi ja kirjoitettu oppitunti “{topic}” on säilytetty."
  ,"tutor6.error.provider": "Professori ei ole tilapäisesti käytettävissä"
  ,"tutor6.error.preserved": "Luonnoksesi ja istuntosi säilytettiin."
  ,"tutor6.error.retry": "Yritä pyyntöä uudelleen"
  ,"tutor6.quota.title": "Tekoälyn käyttöraja saavutettu"
  ,"tutor6.quota.detail": "Tämä tekoälytoiminto on keskeytetty. Voit silti lukea asiakirjojasi ja käyttää alueita, jotka eivät tarvitse tekoälyä."
  ,"tutor6.quota.reset": "Tekoälytoiminnot ovat jälleen käytettävissä {date} jälkeen. Istuntosi pysyy tallennettuna."
  ,"tutor6.quota.usage": "Näytä käyttö"
  ,"tutor6.quota.library": "Avaa Kirjasto"
  ,"tutor6.block.text": "Vastaus"
  ,"tutor6.block.teaching": "Selitys"
  ,"tutor6.block.example": "Esimerkki"
  ,"tutor6.block.question": "Tarkista ymmärryksesi"
  ,"tutor6.block.exercise": "Harjoitus"
  ,"tutor6.block.quiz": "Tietovisa"
  ,"tutor6.block.summary": "Yhteenveto"
  ,"tutor6.block.source": "Lähde"
  ,"tutor6.block.action": "Seuraava vaihe"
  ,"tutor6.block.progress": "Edistyminen"
  ,"tutor6.progress.title": "Mikä muuttui tässä istunnossa"
  ,"tutor6.progress.count": "{done}/{total} todellista vaihetta suoritettu"
  ,"tutor6.progress.completed": "{done} vaihetta suoritettu"
  ,"tutor6.impact.concept-added": "Käsite lisättiin aivoihisi"
  ,"tutor6.impact.connection-added": "Tietämysyhteys lisättiin"
  ,"tutor6.impact.mastery": "Käsitteen hallinta muuttui"
  ,"tutor6.impact.memory": "Muistiaikataulusi muuttui"
  ,"tutor6.impact.progress": "Oppimisesi edistyminen muuttui"
  ,"tutor6.result.title": "Valitse seuraava siirtosi"
  ,"tutor6.result.detail": "Jatka, vahvista tai palaa lähtökontekstiin."
  ,"tutor6.result.continue": "Jatka oppimista"
  ,"tutor6.result.consolidate": "Vahvista harjoittelemalla"
  ,"tutor6.result.origin": "Palaa alkuperäiseen kontekstiin"
  ,"strategy.reason.socratic": "Ohjaavat kysymykset auttavat sinua rakentamaan päättelyn itse ennen professorin vahvistusta."
  ,"strategy.reason.project_based": "Konkreettinen tuotos antaa jokaiselle käsitteelle välittömän käyttötarkoituksen."
  ,"strategy.reason.problem_solving": "Aihe selkiytyy ratkaisemalla yksi merkityksellinen vaihe kerrallaan."
  ,"strategy.reason.case_study": "Realistinen tapaus helpottaa taustalla olevien periaatteiden tutkimista."
  ,"strategy.reason.task_based": "Taidon käyttäminen todellisessa tehtävässä tukee aktiivista oppimista."
  ,"strategy.reason.guided_demonstration": "Läpikäyty esimerkki tukee sinua ennen kuin otat vastuun vähitellen."
  ,"strategy.reason.active_learning": "Lyhyet, toistuvat tehtävät pitävät sinut aktiivisesti mukana."
  ,"strategy.reason.experiential": "Käsitteen soveltaminen ja tuloksen pohtiminen syventävät hallintaa."
  ,"library7.owned": "Mitä omistan"
  ,"library7.mission": "Kaikki Second Brain -palvelulle antamasi — järjestettynä, ymmärrettynä ja valmiina opittavaksi."
  ,"library7.offline": "Kirjasto on tällä hetkellä offline-tilassa."
  ,"library7.stale.title": "Offline-näkymä"
  ,"library7.stale.detail": "Nämä ovat viimeisimmät tallennetut Kirjaston tiedot. Second Brain -palvelua tarvitsevat toiminnot palaavat yhteyden muodostuttua."
  ,"library7.import": "Tuo"
  ,"library7.scan": "Skannaa"
  ,"library7.batch": "Useita asiakirjoja"
  ,"library7.ask": "Kysy lähteiltäni"
  ,"library7.search": "Hae tiedostoja, aiheita tai yhteenvetoja…"
  ,"library7.sort.newest": "Uusimmat"
  ,"library7.sort.oldest": "Vanhimmat"
  ,"library7.sort.title": "Otsikko"
  ,"library7.more": "Lataa lisää"
  ,"library7.favorite": "Lisää suosikkeihin tai poista niistä"
  ,"library7.conceptsCount": "{n} käsitettä havaittu"
  ,"library7.documentsCount": "{n} asiakirjaa"
  ,"library7.collection.create": "Uusi kokoelma"
  ,"library7.collection.name": "Kokoelman nimi"
  ,"library7.collection.none": "Ei kokoelmaa"
  ,"library7.empty.title": "Kirjastosi on vielä tyhjä"
  ,"library7.empty.detail": "Lisää kurssi, kirja, artikkeli tai muistiinpanosi. Second Brain voi ymmärtää ne, yhdistää ne aivoihisi ja auttaa sinua oppimaan niistä."
  ,"library7.empty.pipeline": "Mitä tuonnin jälkeen tapahtuu"
  ,"library7.empty.import": "Tuo"
  ,"library7.empty.read": "Lue"
  ,"library7.empty.understand": "Ymmärrä"
  ,"library7.empty.connect": "Yhdistä"
  ,"library7.empty.ready": "Valmis"
  ,"library7.import.title": "Lisää lähde"
  ,"library7.import.file": "Tiedosto"
  ,"library7.import.text": "Muistiinpanot"
  ,"library7.import.url": "Verkkosivu"
  ,"library7.import.formats": "PDF, teksti, Markdown ja kuvat käyttävät samaa asiakirjaputkea."
  ,"library7.import.choose": "Valitse tiedosto"
  ,"library7.quota.title": "Käyttöraja saavutettu"
  ,"library7.quota.reset": "Jälleen käytettävissä: {date}."
  ,"library7.quota.usage": "Näytä käyttö"
  ,"library7.quota.alternatives": "Yhä käytettävissä"
  ,"document.pipeline.queued": "Odottaa lukemista"
  ,"document.pipeline.reading": "Asiakirjaa luetaan"
  ,"document.pipeline.extracting": "Hyödyllistä sisältöä poimitaan"
  ,"document.pipeline.indexing": "Asiakirjahakua valmistellaan"
  ,"document.pipeline.connecting": "Käsitteitä yhdistetään"
  ,"document.pipeline.completed": "Asiakirja on valmis"
  ,"document.pipeline.failed": "Käsittely pysähtyi"
  ,"document.pipeline.noEstimate": "Nykyinen vaihe — luotettavaa aika-arviota ei ole"
  ,"document.pipeline.retry": "Yritä tätä asiakirjaa uudelleen"
  ,"document.pipeline.retryOcr": "Lue tallennettu skannaus uudelleen"
  ,"document.pipeline.ocrFailed": "Tekstintunnistus epäonnistui. Tallennetut sivusi ovat yhä tallessa."
  ,"document.pipeline.ocrRetryHelp": "Tallennetut sivut säilyvät. Tämä toiminto yrittää tekstintunnistusta uudelleen; se ei indeksoi tyhjää asiakirjaa."
  ,"document.batch.title": "Usean asiakirjan tuonti"
  ,"document.batch.detail": "Jokainen tiedosto käsitellään erikseen. Epäonnistuminen ei koskaan peruuta onnistuneita asiakirjoja."
  ,"document.batch.choose": "Valitse asiakirjat"
  ,"document.batch.start": "Aloita tuonti"
  ,"document.batch.cancel": "Pysäytä odottavat tuonnit"
  ,"document.batch.summary": "yhteensä {total} · valmiina {done} · käsittelyssä {processing} · epäonnistui {failed}"
  ,"document.batch.waiting": "Odottaa"
  ,"document.batch.uploading": "Lähetetään…"
  ,"document.batch.result": "Erän yhteenveto"
  ,"document.batch.resultDetail": "{documents} asiakirjaa valmiina · {concepts} käsitettä havaittu"
  ,"document.batch.subjects": "Havaitut aiheet"
  ,"source.passage": "Katkelma {n}"
  ,"source.close": "Sulje lähteen esikatselu"
  ,"source.openDocument": "Avaa asiakirja"
  ,"library7.document.loading": "Avataan Asiakirjaälyä…"
  ,"library7.document.intelligence": "Asiakirjaäly"
  ,"library7.document.processingHelp": "Voit poistua tältä näytöltä. Käsittely jatkuu menettämättä tuotua asiakirjaa."
  ,"library7.document.previewLimited": "Rajoitettu esikatselu"
  ,"library7.document.previewLimitedDetail": "Vain alkuosa ladataan tähän, jotta näyttö pysyy nopeana."
  ,"library7.backLibrary": "Takaisin Kirjastoon"
  ,"library7.action.ask": "Kysy tästä asiakirjasta"
  ,"library7.action.learn": "Opi tästä asiakirjasta"
  ,"library7.action.more": "Lisää toimintoja"
  ,"library7.action.less": "Vähemmän toimintoja"
  ,"library7.action.advanced": "Muunna tai järjestä"
  ,"library7.action.quiz": "Luo tietovisa"
  ,"library7.action.flashcards": "Luo muistikortteja"
  ,"library7.action.workspace": "Lisää työhön"
  ,"library7.tab.document": "Asiakirja"
  ,"library7.tab.understand": "Ymmärrä"
  ,"library7.tab.ask": "Kysy"
  ,"library7.understood": "Mitä Second Brain ymmärtää"
  ,"library7.summaryUnavailable": "Yhteenvetoa ei vielä ole. Alkuperäinen asiakirja on edelleen käytettävissä."
  ,"library7.concepts": "{n} käsitettä havaittu"
  ,"library7.noConcepts": "Asiakirjamoottori ei palauttanut käsitteitä."
  ,"library7.brainImpact": "{known} jo tunnettua · {new} uutta · {links} yhteyttä luotu"
  ,"library7.brain.open": "Näytä Omissa aivoissani"
  ,"library7.resources": "Muunnokset"
  ,"library7.resources.trace": "Luotu kohteesta {title}"
  ,"library7.compare.with": "Vertaa kohteeseen…"
  ,"library7.nba.title": "Ehdotettu seuraava vaihe"
  ,"library7.nba.learn": "Opi {n} uutta käsitettä"
  ,"library7.nba.ask": "Kysy tästä asiakirjasta"
  ,"library7.nba.flashcards": "Luo muistikortteja"
  ,"library7.nba.brain": "Näytä aivojen yhteydet"
  ,"library7.ask.documentTitle": "Kysy tästä asiakirjasta"
  ,"library7.ask.noAnswer": "Valitut lähteet eivät sisällä vastausta"
  ,"library7.ask.ownedSources": "Vain omat lähteeni"
  ,"library7.ask.title": "Kysy lähteiltäni"
  ,"library7.ask.detail": "Valitse tarkka laajuus. Second Brain vastaa vain haettujen katkelmien perusteella ja näyttää lähteensä."
  ,"library7.ask.scope.all": "Kaikki"
  ,"library7.ask.scope.collection": "Kokoelma"
  ,"library7.ask.scope.selected": "Valitut"
  ,"library7.ask.noCollections": "Luo ensin kokoelma Kirjastossa."
  ,"library7.ask.selectedCount": "{n} valittu"
  ,"library7.ask.chooseScope": "Valitse lähteet"
  ,"library7.ask.chooseScopeDetail": "Valitse kokoelma tai vähintään yksi asiakirja ennen kysymistä."
  ,"research10.eyebrow": "Tutkimus"
  ,"research10.title": "Tutki näytön avulla"
  ,"research10.subtitle": "Etsi, ristiintarkista, analysoi ja kokoa se, mitä omat lähteesi todella tukevat."
  ,"research10.question": "Tutkimuskysymys"
  ,"research10.placeholder": "esim. Vertaa TCP:tä ja UDP:tä kurssiasiakirjojeni avulla."
  ,"research10.depth": "Syvyys"
  ,"research10.depth.quick": "Nopea kysymys"
  ,"research10.depth.sourced": "Lähteistetty tutkimus"
  ,"research10.depth.deep": "Syvätutkimus"
  ,"research10.depth.quick.detail": "Tiivis vastaus saatavilla olevista lähteistä."
  ,"research10.depth.sourced.detail": "Analyysi, jossa lähteet ja viittaukset näkyvät selkeästi."
  ,"research10.depth.deep.detail": "Suunnitelma, kokoelma, vertailu ja jäsennelty synteesi."
  ,"research10.scope": "Haettavat lähteet"
  ,"research10.scope.edit": "Valitse lähteet · {count} valittu"
  ,"research10.scope.apply": "Käytä lähteitä"
  ,"research10.scope.brain": "Omat aivoni"
  ,"research10.scope.library": "Oma kirjastoni"
  ,"research10.scope.documents": "Valitut asiakirjat"
  ,"research10.scope.collection": "Kokoelma"
  ,"research10.scope.external": "Ulkoiset lähteet"
  ,"research10.scope.web": "Verkko"
  ,"research10.webUnavailable": "Verkkotutkimus ei ole käytettävissä"
  ,"research10.webUnavailableDetail": "Ulkoista tutkimuspalvelua ei ole määritetty. Aivosi ja Kirjastosi ovat edelleen käytettävissä."
  ,"research10.documents": "Valitse asiakirjat"
  ,"research10.documents.empty": "Valmiita asiakirjoja ei ole saatavilla."
  ,"research10.collections": "Valitse kokoelma"
  ,"research10.collections.empty": "Kokoelmia ei ole saatavilla."
  ,"research10.deep.costTitle": "Enemmän käyttöä vaativa tutkimus"
  ,"research10.deep.costDetail": "Syvätutkimus lukee enemmän lähteitä. Tarkista suunnitelma ennen aloittamista; mitään kallista ei käynnistetä huomaamatta."
  ,"research10.reviewPlan": "Tarkista tutkimussuunnitelma"
  ,"research10.launch": "Aloita tutkimus"
  ,"research10.cancel": "Peruuta"
  ,"research10.cancelled": "Tutkimus peruutettiin. Tallennettu istuntosi on edelleen käytettävissä."
  ,"research10.plan.title": "Ehdotettu tutkimussuunnitelma"
  ,"research10.plan.find": "Tunnista valitun laajuuden olennaiset lähteet."
  ,"research10.plan.compare": "Vertaa näiden lähteiden tukemia näkemyksiä."
  ,"research10.plan.verify": "Tuo esiin ristiriidat ja näytön puutteet."
  ,"research10.plan.synthesize": "Tuota jäsennelty, viitattu synteesi."
  ,"research10.running": "Tutkimus käynnissä"
  ,"research10.runningDetail": "Second Brain tekee hakuja valituista lähteistä. Valmistumisprosenttia ei arvioida."
  ,"research10.running.collect": "Kerätään valittuja lähteitä"
  ,"research10.noSources": "Tukevaa lähdettä ei löytynyt"
  ,"research10.noSourcesDetail": "Second Brain ei luonut vastausta, koska valitut lähteet eivät tue sitä. Muuta laajuutta tai kysymystä."
  ,"research10.partial": "Osittainen tutkimus"
  ,"research10.partialDetail": "Jotkin valitut lähteet eivät olleet käytettävissä. Alla oleva tulos käyttää vain todella luettuja lähteitä."
  ,"research10.synthesis": "Synteesi"
  ,"research10.keyPoints": "Pääkohdat"
  ,"research10.comparison": "Lähteiden vertailu"
  ,"research10.agreements": "Yhteneväisyydet"
  ,"research10.divergences": "Eroavaisuudet"
  ,"research10.specificities": "Erityispiirteet"
  ,"research10.sources": "Käytetyt lähteet"
  ,"research10.stage.sources-found": "Lähteet löydetty"
  ,"research10.stage.sources-read": "Lähteet luettu"
  ,"research10.stage.compared": "Lähteet vertailtu"
  ,"research10.stage.synthesized": "Synteesi valmis"
  ,"research10.next": "Jatka tästä tutkimuksesta"
  ,"research10.next.reason": "Lähteistetty synteesi on valmis muutettavaksi aktiiviseksi oppimiseksi."
  ,"research10.action.learn": "Opi tämä aihe"
  ,"research10.action.workspace": "Lisää Työtilaan"
  ,"research10.action.deepen": "Syvennä"
  ,"research10.quota": "Tutkimusraja saavutettu"
  ,"research10.quotaDetail": "Tutkimusta ei aloitettu uudelleen. Voit yhä käyttää tekoälyttömiä alueita tai tarkistaa käyttösi."
  ,"research10.openUsage": "Näytä käyttö"
  ,"workspace10.eyebrow": "Akateeminen työtila"
  ,"workspace10.title": "Rakenna työsi"
  ,"workspace10.subtitle": "Järjestä suunnitelma, kirjoita, merkitse lähteet ja pyydä kontekstuaalista apua luopumatta tekijyydestäsi."
  ,"workspace10.create": "Luo työtila"
  ,"workspace10.createAction": "Luo työtila"
  ,"workspace10.template.memoire": "Opinnäytetyö"
  ,"workspace10.template.tfc": "Lopputyö"
  ,"workspace10.template.dissertation": "Tutkielma"
  ,"workspace10.template.report": "Raportti"
  ,"workspace10.template.article": "Artikkeli"
  ,"workspace10.template.assignment": "Tehtävä"
  ,"workspace10.template.academic-research": "Akateeminen tutkimus"
  ,"workspace10.template.other": "Muu"
  ,"workspace10.field.title": "Otsikko"
  ,"workspace10.field.titlePlaceholder": "Nimeä tämä työ"
  ,"workspace10.field.objective": "Tavoite"
  ,"workspace10.field.objectivePlaceholder": "Mitä yrität osoittaa tai tuottaa?"
  ,"workspace10.field.due": "Valinnainen määräpäivä"
  ,"workspace10.sources": "Lähteet"
  ,"workspace10.sourceCount": "{n} valittu"
  ,"workspace10.sourceMode.documents": "Asiakirjat"
  ,"workspace10.sourceMode.collections": "Kokoelmat"
  ,"workspace10.structure": "Aloitusrakenne"
  ,"workspace10.defaultPlan.0": "Johdanto"
  ,"workspace10.defaultPlan.1": "Käsittely"
  ,"workspace10.defaultPlan.2": "Johtopäätös"
  ,"workspace10.integrity": "Oma päättelysi säilyy keskiössä"
  ,"workspace10.integrityDetail": "Second Brain auttaa ymmärtämään, merkitsemään lähteet ja tarkistamaan. Se ei kirjoita kokonaista akateemista työtä puolestasi salaa."
  ,"workspace10.resume": "Jatka työtilaa"
  ,"workspace10.resumeDetail": "Suunnitelmasi, sisältösi, lähteesi ja avustajahistoriasi säilytetään yhdessä."
  ,"workspace10.loading": "Ladataan työtilojasi…"
  ,"workspace10.empty": "Ei vielä työtilaa"
  ,"workspace10.emptyDetail": "Luo työtila järjestääksesi todellisen työn ja jatkaaksesi sitä myöhemmin."
  ,"workspace10.open": "Jatka"
  ,"workspace10.sourcesN": "{n} lähdettä"
  ,"workspace10.steps": "{done}/{total} todellista vaihetta suoritettu"
  ,"workspace10.status.active": "Aktiivinen"
  ,"workspace10.status.paused": "Keskeytetty"
  ,"workspace10.status.completed": "Valmis"
  ,"workspace10.status.archived": "Arkistoitu"
  ,"workspace10.opening": "Avataan työtilaasi…"
  ,"workspace10.openingDetail": "Ladataan tallennettu suunnitelma, luonnos, lähteet ja avustajahistoria."
  ,"workspace10.unavailable": "Työtila ei ole käytettävissä"
  ,"workspace10.noObjective": "Tavoitetta ei ole vielä lisätty."
  ,"workspace10.area.plan": "Suunnitelma"
  ,"workspace10.area.work": "Työ"
  ,"workspace10.area.sources": "Lähteet"
  ,"workspace10.area.assistant": "Avustaja"
  ,"workspace10.plan": "Suunnitelma"
  ,"workspace10.plan.new": "Uusi osio"
  ,"workspace10.plan.rename": "Nimeä osio uudelleen"
  ,"workspace10.plan.remove": "Poista"
  ,"workspace10.plan.add": "Lisää osio"
  ,"workspace10.editor.heading": "Otsikko"
  ,"workspace10.editor.list": "Luettelo"
  ,"workspace10.editor.quote": "Lainaus"
  ,"workspace10.editor.reference": "Viite"
  ,"workspace10.editor.placeholder": "Aloita kirjoittaminen tästä…"
  ,"workspace10.editor.label": "Työtilan sisältö"
  ,"workspace10.save.idle": "Ei muutoksia"
  ,"workspace10.save.dirty": "Muutoksia ei ole vielä tallennettu"
  ,"workspace10.save.saving": "Tallennetaan…"
  ,"workspace10.save.saved": "Tallennettu"
  ,"workspace10.save.error": "Tallennusvirhe"
  ,"workspace10.save.offline": "Offline — muutokset säilyvät näytöllä"
  ,"workspace10.saveNow": "Tallenna nyt"
  ,"workspace10.conflict": "Tätä työtilaa muutettiin muualla. Lataa uudelleen ennen tallennusta, jotta mitään ei korvata."
  ,"workspace10.sourcesEmpty": "Lähteitä ei ole vielä liitetty."
  ,"workspace10.addSource": "Lisää lähde"
  ,"workspace10.assistant": "Second Brain -avustaja"
  ,"workspace10.assistantDetail": "Kontekstuaalista apua tähän työhön. Luonnoksesi säilyy pääasiallisena työpintana."
  ,"workspace10.assist.explain": "Selitä"
  ,"workspace10.assist.challenge": "Haasta"
  ,"workspace10.assist.suggest": "Ehdota"
  ,"workspace10.assist.structure": "Jäsennä"
  ,"workspace10.assist.compare-sources": "Vertaa lähteitä"
  ,"workspace10.assist.check-coherence": "Tarkista johdonmukaisuus"
  ,"workspace10.assist.rephrase": "Muotoile uudelleen"
  ,"workspace10.selection": "Valittu katkelma"
  ,"workspace10.assistantQuestion": "Pyyntö"
  ,"workspace10.assistantPlaceholder": "Kysy nykyisestä työstä tai valitusta katkelmasta…"
  ,"workspace10.assistantSend": "Kysy avustajalta"
  ,"workspace10.next": "Paras seuraava toiminto"
  ,"workspace10.nextSection": "Jatka: {section}"
  ,"workspace10.nextSources": "Lisää lähde ennen argumentin kehittämistä."
  ,"workspace10.continue": "Jatka kirjoittamista"
  ,"workspace10.askTutor": "Kysy professorilta"
  ,"workspace10.research": "Aloita tutkimus"
  ,"languages11.eyebrow": "Kielet ja kielikylpy"
  ,"languages11.title": "Kieliharjoittelusi"
  ,"languages11.description": "Yksi keskittynyt tila keskustelulle, sanastolle, ymmärtämiselle, kirjoittamiselle ja suulliselle harjoittelulle."
  ,"languages11.preferences": "Kielet"
  ,"languages11.goal.empty": "Lisää tavoite tehdäksesi harjoittelusta tarkempaa."
  ,"languages11.goal.label": "Oppimistavoite"
  ,"languages11.goal.placeholder": "Matkailu, koe, työ, keskustelu…"
  ,"languages11.level.title": "Tasosi"
  ,"languages11.level.declared": "ilmoitettu taso"
  ,"languages11.level.notEvaluated": "Taso on itse ilmoitettu. Sitä ei ole vielä arvioitu."
  ,"languages11.metric.words": "sanaa"
  ,"languages11.metric.due": "ajankohtaisena"
  ,"languages11.metric.sessions": "istuntoa"
  ,"languages11.metric.lessons": "oppituntia"
  ,"languages11.lastActivity": "Viimeisin toiminta: {date}"
  ,"languages11.lastActivity.none": "Ei vielä toimintaa."
  ,"languages11.nba.badge": "SEURAAVA HARJOITUS"
  ,"languages11.nba.start": "Aloita"
  ,"languages11.nba.review": "Kertaa {count} sanastokohdetta"
  ,"languages11.nba.reasonDue": "Nämä kohteet ovat nyt ajankohtaisia FSRS-muistiaikataulusi mukaan."
  ,"languages11.nba.firstConversation": "Aloita ensimmäinen ohjattu keskustelusi"
  ,"languages11.nba.reasonStart": "Lyhyt vuoropuhelu luo ensimmäisen aktiivisen harjoittelukontekstisi."
  ,"languages11.nba.lesson": "Rakenna ensimmäinen kohdennettu oppituntisi"
  ,"languages11.nba.reasonLesson": "Olet harjoitellut, mutta kielioppituntia ei ole vielä luotu."
  ,"languages11.nba.conversation": "Jatka lyhyellä keskustelulla"
  ,"languages11.nba.reasonPractice": "Säännöllinen tuottaminen pitää kielen aktiivisena."
  ,"languages11.resume.title": "Jatka kieli-istuntoa"
  ,"languages11.resume.action": "Jatka"
  ,"languages11.resume.empty": "Ei keskeytynyttä istuntoa"
  ,"languages11.resume.emptyDetail": "Seuraava merkityksellinen harjoituksesi ilmestyy tähän aloitettuasi."
  ,"languages11.openSpace": "Avaa tämä kielitila"
  ,"languages11.empty.title": "Valitse kieli aloittaaksesi"
  ,"languages11.empty.detail": "Second Brain yhdistää oppitunnit, keskustelut ja todelliset FSRS-sanastokertaukset."
  ,"languages11.create.title": "Aloita kielen {language} opiskelu"
  ,"languages11.create.action": "Luo kielitila"
  ,"languages11.other.title": "Muut kielet"
  ,"languages11.space.eyebrow": "Kohdennettu kielitila"
  ,"languages11.formats.title": "Harjoitusmuodot"
  ,"languages11.formats.detail": "Valitse yksi toiminto; työtila pysyy siinä keskittyneenä."
  ,"languages11.practice.focused": "Yksi toiminto kerrallaan, tasosi ja tavoitteesi säilyttäen."
  ,"languages11.practice.conversation": "Keskustelu"
  ,"languages11.practice.vocabulary": "Sanasto"
  ,"languages11.practice.grammar": "Kielioppi"
  ,"languages11.practice.conjugation": "Taivutus"
  ,"languages11.practice.comprehension": "Ymmärtäminen"
  ,"languages11.practice.reading": "Lukeminen"
  ,"languages11.practice.writing": "Kirjoittaminen"
  ,"languages11.practice.pronunciation": "Ääntäminen"
  ,"languages11.practice.oral": "Suullinen"
  ,"languages11.practice.quiz": "Tietovisa"
  ,"languages11.conversation.detail": "Sama tekoälyprofessori mukauttaa kohdekielen osuuden ja korjaukset tähän istuntoon."
  ,"languages11.conversation.start": "Aloita keskustelu"
  ,"languages11.oral.detail": "Puhu saman professorin kanssa. Litterointisi näkyy ja on muokattavissa ennen lähettämistä."
  ,"languages11.oral.start": "Aloita suullinen harjoitus"
  ,"languages11.scenario.label": "Tilanne"
  ,"languages11.scenario.placeholder": "Apteekissa, työhaastattelussa, arjessa…"
  ,"languages11.immersion.title": "Kielikylpy"
  ,"languages11.immersion.guided": "Ohjattu"
  ,"languages11.immersion.mixed": "Sekoitettu"
  ,"languages11.immersion.full": "Täysi"
  ,"languages11.correction.title": "Korjaukset"
  ,"languages11.correction.light": "Kevyet"
  ,"languages11.correction.balanced": "Tasapainoiset"
  ,"languages11.correction.detailed": "Yksityiskohtaiset"
  ,"languages11.generate": "Luo harjoitus"
  ,"languages11.quiz.detail": "Kertaa ajankohtainen sanasto nykyisen FSRS-muistimoottorin avulla."
  ,"languages11.quiz.action": "Avaa kielikertaus"
  ,"languages11.review.return": "Takaisin kieleen"
  ,"languages11.reading.history": "Avaa lukuhistoria"
  ,"languages11.writing.workspace": "Avaa koko kirjoitustyötila"
  ,"languages11.writing.instruction": "Kirjoita kielellä {language}."
  ,"languages11.offline.title": "Puhe ja tekoäly eivät ole käytettävissä offline-tilassa"
  ,"languages11.offline.detail": "Paikallinen luonnoksesi säilyy. Muodosta yhteys ennen litterointia tai professorilta kysymistä."
  ,"rlle.ui.hub.learn": "Opi kieltä {language}"
  ,"rlle.ui.hub.resume": "Jatka kielen {language} kurssiani"
  ,"rlle.ui.hub.courseDetail": "Jäsennelty, mukautuva CEFR-kurssi, joka rakentuu todellisten tarpeidesi ympärille."
  ,"rlle.ui.hub.openCourse": "Avaa kurssini"
  ,"rlle.ui.hub.courseUnavailable": "Kurssipalvelu ei ole vielä käytettävissä. Harjoittelutyökalusi ovat edelleen käytössä."
  ,"rlle.ui.course.eyebrow": "TOSIELÄMÄN KIELIMOOTTORI"
  ,"rlle.ui.course.title": "Kielen {language} kurssi"
  ,"rlle.ui.course.subtitle": "Opi asteittain ja osoita sitten, mitä osaat todellisissa tilanteissa."
  ,"rlle.ui.course.loading": "Ladataan kurssiasi…"
  ,"rlle.ui.course.notStarted": "Rakenna kurssini"
  ,"rlle.ui.course.notStartedDetail": "Valitse aloituskohta ja tosielämän tavoitteesi. Perusteita ei koskaan poisteta."
  ,"rlle.ui.course.startZero": "Aloita nollasta"
  ,"rlle.ui.course.startDeclared": "Aloita ilmoittamaltani tasolta"
  ,"rlle.ui.course.declaredWarning": "{level} on ilmoitettu taso, ei arvioitu tulos."
  ,"rlle.ui.course.targetLevel": "Tavoitetaso"
  ,"rlle.ui.course.goalDomain": "Tosielämän painopiste"
  ,"rlle.ui.course.goal.general": "Yleinen"
  ,"rlle.ui.course.goal.travel": "Matkailu"
  ,"rlle.ui.course.goal.work": "Työ"
  ,"rlle.ui.course.goal.studies": "Opinnot"
  ,"rlle.ui.course.goal.social": "Sosiaalinen elämä"
  ,"rlle.ui.course.start": "Aloita kurssini"
  ,"rlle.ui.course.resume": "Jatka kurssiani"
  ,"rlle.ui.course.pause": "Keskeytä kurssi"
  ,"rlle.ui.course.current": "Jatka nykyistä oppituntia"
  ,"rlle.ui.course.curriculum": "CEFR-oppimispolku"
  ,"rlle.ui.course.curriculumDetail": "Tavoiteyksiköt asetetaan etusijalle, mutta koko oppimisrunko säilyy."
  ,"rlle.ui.course.goalPriority": "Tavoitteesi"
  ,"rlle.ui.course.core": "Perusta"
  ,"rlle.ui.course.unit.open": "Avaa yksikkö"
  ,"rlle.ui.course.status.locked": "Lukittu"
  ,"rlle.ui.course.status.available": "Saatavilla"
  ,"rlle.ui.course.status.in-progress": "Kesken"
  ,"rlle.ui.course.status.completed": "Valmis"
  ,"rlle.ui.course.status.untracked": "Ei aloitettu"
  ,"rlle.ui.course.progress": "Mitattu edistyminen"
  ,"rlle.ui.course.progressUnits": "{done}/{total} yksikköä suoritettu"
  ,"rlle.ui.course.progressUnknown": "Kurssin edistymistä ei ole vielä mitattu."
  ,"rlle.ui.course.lastActivity": "Viimeisin toiminta: {date}"
  ,"rlle.ui.course.noActivity": "Ei vielä kurssitoimintaa"
  ,"rlle.ui.course.levels": "CEFR-tasot"
  ,"rlle.ui.course.level.declared": "Ilmoitettu"
  ,"rlle.ui.course.level.estimated": "Arvioitu"
  ,"rlle.ui.course.level.evaluated": "Testattu"
  ,"rlle.ui.course.level.target": "Tavoite"
  ,"rlle.ui.course.notEvaluated": "Ei arvioitu"
  ,"rlle.ui.course.dimensions": "Näytöllä mitatut taidot"
  ,"rlle.ui.course.evidenceCount": "{count} näyttökohdetta"
  ,"rlle.ui.course.review": "Kertaa tätä kieltä"
  ,"rlle.ui.course.brain": "Näytä kielitietämys Omissa aivoissani"
  ,"rlle.ui.course.professor": "Kysy professorilta"
  ,"rlle.ui.course.offline": "Kurssin viimeisintä tilaa ei voitu päivittää."
  ,"rlle.ui.course.preferences.title": "Kurssiasetukset"
  ,"rlle.ui.course.preferences.detail": "Mukauta kielikylvyn ja korjausten voimakkuutta menettämättä edistymistäsi."
  ,"rlle.ui.course.preferences.save": "Tallenna asetukset"
  ,"rlle.ui.course.preferences.saved": "Kurssiasetukset tallennettu."
  ,"rlle.ui.course.preferences.error": "Asetuksia ei voitu tallentaa."
  ,"rlle.ui.review.returnCourse": "Takaisin kurssilleni"
  ,"rlle.ui.brain.evidenceTitle": "Mitatut kielitaidot"
  ,"rlle.ui.brain.evidenceDetail": "Tässä näytetään vain tällä kielikurssilla havaittu näyttö."
  ,"rlle.ui.brain.backCourse": "Avaa kielikurssi"
  ,"rlle.ui.lesson.eyebrow": "JÄSENNELTY OPPITUNTI"
  ,"rlle.ui.lesson.title": "Oppitunti"
  ,"rlle.ui.lesson.intro": "Viestinnällinen tavoite"
  ,"rlle.ui.lesson.start": "Aloita tämä oppitunti"
  ,"rlle.ui.lesson.resume": "Jatka tätä oppituntia"
  ,"rlle.ui.lesson.complete": "Päätä oppitunti"
  ,"rlle.ui.lesson.completeStage": "Suorita tämä vaihe"
  ,"rlle.ui.lesson.completed": "Oppitunti suoritettu. Käytännön taidot vaativat edelleen todellista näyttöä."
  ,"rlle.ui.lesson.openGenerated": "Avaa oppitunnin sisältö"
  ,"rlle.ui.lesson.path": "Oppitunnin vaiheet"
  ,"rlle.ui.lesson.stageAction": "Harjoittele tätä vaihetta"
  ,"rlle.ui.lesson.noActive": "Tässä yksikössä ei vielä ole aktiivista oppituntia."
  ,"rlle.ui.lesson.proofNote": "Oppitunnin suorittaminen ei yksin vahvista osaamistavoitetta."
  ,"rlle.ui.mission.eyebrow": "MAAILMAN TEHTÄVÄT"
  ,"rlle.ui.mission.title": "Tosielämän tehtävät"
  ,"rlle.ui.mission.subtitle": "Suorita viestintätehtävä professorin kanssa. Onnistuminen vaatii havaittua näyttöä, ei tietovisapisteitä."
  ,"rlle.ui.mission.start": "Aloita tehtävä"
  ,"rlle.ui.mission.resume": "Jatka tehtävää"
  ,"rlle.ui.mission.minimum": "Tasosta {level}"
  ,"rlle.ui.mission.survival": "Viestinnän selviytymistaidot"
  ,"rlle.ui.mission.notAvailable": "Tehtävien seuranta ei ole vielä käytettävissä palvelimelta."
  ,"rlle.ui.mission.dynamic": "Professori reagoi todellisiin vastauksiisi ja tarkistaa, suoritettiinko tehtävä."
  ,"rlle.ui.mission.all": "Kaikki"
  ,"rlle.ui.cando.eyebrow": "OSAAMISKARTTA"
  ,"rlle.ui.cando.title": "Mitä todella osaan"
  ,"rlle.ui.cando.subtitle": "Taito vahvistetaan vain onnistuneella tehtävällä, arvioinnilla tai valvotulla toiminnolla."
  ,"rlle.ui.cando.open": "Avaa osaamiskarttani"
  ,"rlle.ui.cando.status.not-evaluated": "Ei arvioitu"
  ,"rlle.ui.cando.status.in-progress": "Näyttöä kertyy"
  ,"rlle.ui.cando.status.validated": "Osoitettu"
  ,"rlle.ui.cando.evidence": "Näyttö"
  ,"rlle.ui.cando.noEvidence": "Ei vielä havaittua näyttöä."
  ,"rlle.ui.cando.source.mission": "Maailman tehtävä"
  ,"rlle.ui.cando.source.assessment": "Arviointi"
  ,"rlle.ui.cando.source.controlled-activity": "Valvottu toiminto"
  ,"rlle.ui.recovery.title": "Kohdennettu vahvistaminen"
  ,"rlle.ui.recovery.subtitle": "Tässä näkyvät vain toiminnan aikana todella havaitut vaikeudet."
  ,"rlle.ui.recovery.empty": "Ei vahvistettua korjattavaa vaikeutta."
  ,"rlle.ui.recovery.gaps": "Toiminnalliset puutteet"
  ,"rlle.ui.recovery.mistakes": "Virhemuisti"
  ,"rlle.ui.recovery.repair": "Korjaussilmukka"
  ,"rlle.ui.recovery.occurrences": "{count} havaittua esiintymää"
  ,"rlle.ui.recovery.next": "Nykyinen korjausvaihe: {stage}"
  ,"rlle.ui.common.retry": "Yritä uudelleen"
  ,"rlle.ui.common.backCourse": "Takaisin kurssille"
  ,"rlle.ui.common.error": "Kurssia ei voitu ladata."
  ,"rlle.ui.category.travel": "Matkailu"
  ,"rlle.ui.category.work": "Työ"
  ,"rlle.ui.category.studies": "Opinnot"
  ,"rlle.ui.category.social": "Sosiaalinen elämä"
  ,"rlle.ui.dimension.vocabulary": "Sanasto"
  ,"rlle.ui.dimension.grammar": "Kielioppi"
  ,"rlle.ui.dimension.conversation": "Keskustelu"
  ,"rlle.ui.dimension.listening": "Kuunteleminen"
  ,"rlle.ui.dimension.reading": "Lukeminen"
  ,"rlle.ui.dimension.writing": "Kirjoittaminen"
  ,"rlle.ui.dimension.interaction": "Vuorovaikutus"
  ,"rlle.ui.dimension.pronunciation": "Ääntäminen"
  ,"rlle.ui.dimension.mediation": "Välittäminen"
  ,"rlle.ui.dimension.status.not-evaluated": "Ei arvioitu"
  ,"rlle.ui.dimension.status.emerging": "Kehittymässä"
  ,"rlle.ui.dimension.status.demonstrated": "Osoitettu"
  ,"rlle.ui.dimension.status.consistent": "Vakiintunut"
  ,"rlle.ui.strand.vocabulary": "Sanasto"
  ,"rlle.ui.strand.verbs": "Verbit"
  ,"rlle.ui.strand.conjugation": "Taivutus"
  ,"rlle.ui.strand.grammar": "Kielioppi"
  ,"rlle.ui.strand.listening": "Kuunteleminen"
  ,"rlle.ui.strand.reading": "Lukeminen"
  ,"rlle.ui.strand.conversation": "Keskustelu"
  ,"rlle.ui.strand.interaction": "Vuorovaikutus"
  ,"rlle.ui.strand.pronunciation": "Ääntäminen"
  ,"rlle.ui.strand.writing": "Kirjoittaminen"
  ,"rlle.ui.strand.mediation": "Välittäminen"
  ,"rlle.ui.stage.communicative-objective": "Viestinnällinen tavoite"
  ,"rlle.ui.stage.vocabulary": "Sanasto kontekstissa"
  ,"rlle.ui.stage.grammar-verbs": "Kielioppi ja verbit"
  ,"rlle.ui.stage.example": "Malliesimerkki"
  ,"rlle.ui.stage.comprehension": "Ymmärtäminen"
  ,"rlle.ui.stage.practice": "Ohjattu harjoittelu"
  ,"rlle.ui.stage.oral": "Puhu ensin"
  ,"rlle.ui.stage.writing": "Kirjoittaminen"
  ,"rlle.ui.stage.verification": "Tarkistus"
  ,"rlle.ui.stage.review": "Muistikertaus"
  ,"rlle.ui.stage.status.pending": "Tekemättä"
  ,"rlle.ui.stage.status.active": "Nyt"
  ,"rlle.ui.stage.status.completed": "Valmis"
  ,"rlle.ui.stage.status.skipped": "Ei tarvita"
  ,"rlle.ui.repair.explain": "Selitys"
  ,"rlle.ui.repair.guided-practice": "Ohjattu harjoittelu"
  ,"rlle.ui.repair.retry-now": "Yritä nyt uudelleen"
  ,"rlle.ui.repair.reuse-later": "Käytä myöhemmin uudelleen"
  ,"rlle.ui.repair.consolidate": "Vahvista Kertauksessa"
  ,"rlle.ui.survival.ask-repeat": "Pyydä toistamaan"
  ,"rlle.ui.survival.ask-slow-down": "Pyydä puhumaan hitaammin"
  ,"rlle.ui.survival.ask-definition": "Pyydä määritelmää"
  ,"rlle.ui.survival.rephrase": "Muotoile uudelleen"
  ,"rlle.ui.survival.check-understanding": "Tarkista ymmärtäminen"
  ,"rlle.ui.survival.explain-unknown-word": "Selitä tuntematon sana"
  ,"rlle.ui.survival.buy-thinking-time": "Hanki aikaa vastata"
  ,"rlle.unit.a1FirstContact": "Ensikohtaaminen"
  ,"rlle.objective.a1FirstContact": "Esittele itsesi ja vaihda olennaiset henkilötiedot."
  ,"rlle.unit.a1DailyNeeds": "Arjen perustarpeet"
  ,"rlle.objective.a1DailyNeeds": "Hoida yksinkertaiset arjen tarpeet hyödyllisillä sanoilla ja perusmuodoilla."
  ,"rlle.unit.a1Survival": "Viestinnän selviytymispaketti"
  ,"rlle.objective.a1Survival": "Pidä vuoropuhelu käynnissä, vaikka et ymmärtäisi kaikkea."
  ,"rlle.unit.a2Routines": "Rutiinit ja suunnitelmat"
  ,"rlle.objective.a2Routines": "Kuvaile tapoja, toimintaa ja yksinkertaisia tulevaisuuden suunnitelmia."
  ,"rlle.unit.a2PastPlans": "Menneet kokemukset"
  ,"rlle.objective.a2PastPlans": "Kerro yksinkertainen tarina ja yhdistä menneitä tapahtumia."
  ,"rlle.unit.a2TravelStudy": "Matkailun ja opiskelun perustaidot"
  ,"rlle.objective.a2TravelStudy": "Etsi tietoa ja hoida tavallisia matkailu- tai opiskelutehtäviä."
  ,"rlle.unit.b1Experiences": "Kerro tarinasi"
  ,"rlle.objective.b1Experiences": "Kuvaile kokemuksia selkeässä aikajärjestyksessä ja hyödyllisin yksityiskohdin."
  ,"rlle.unit.b1WorkTravel": "Toimi itsenäisesti"
  ,"rlle.objective.b1WorkTravel": "Selviydy tavallisista työ- ja matkailutilanteista ilman käsikirjoitusta."
  ,"rlle.unit.b1Opinions": "Selitä mielipide"
  ,"rlle.objective.b1Opinions": "Ymmärrä näkökulma ja perustele omasi."
  ,"rlle.unit.b2Collaboration": "Tee sujuvaa yhteistyötä"
  ,"rlle.objective.b2Collaboration": "Osallistu aktiivisesti kokouksiin, keskusteluihin ja esityksiin."
  ,"rlle.unit.b2Argument": "Rakenna argumentti"
  ,"rlle.objective.b2Argument": "Vertaa näkemyksiä, rajaa väitteitä ja jäsennä vakuuttava vastaus."
  ,"rlle.unit.b2Professional": "Ammatillinen tuottaminen"
  ,"rlle.objective.b2Professional": "Kirjoita ja puhu ammatillisissa tilanteissa odotetulla rekisterillä."
  ,"rlle.unit.c1ComplexInput": "Ymmärrä vaativaa aineistoa"
  ,"rlle.objective.c1ComplexInput": "Poimi, yhdistä ja muotoile uudelleen ajatuksia vaativasta aineistosta."
  ,"rlle.unit.c1Influence": "Vaikuta ja neuvottele"
  ,"rlle.objective.c1Influence": "Mukauta kieltä täsmällisesti vakuuttamiseen, yhteistyöhön ja erimielisyyksien ratkaisemiseen."
  ,"rlle.unit.c1Production": "Tuota täsmällisesti"
  ,"rlle.objective.c1Production": "Luo selkeää ja vivahteikasta työtä akateemisille ja ammatillisille yleisöille."
  ,"rlle.unit.c2Nuance": "Vivahteet ja epäsuora merkitys"
  ,"rlle.objective.c2Nuance": "Ymmärrä hienovaraisia eroja, rekisteriä ja epäsuoraa merkitystä."
  ,"rlle.unit.c2Adaptation": "Mukauta reaaliajassa"
  ,"rlle.objective.c2Adaptation": "Välitä ja muotoile luontevasti uudelleen eri yleisöille ja tilanteisiin."
  ,"rlle.unit.c2Mastery": "Yhdistetty hallinta"
  ,"rlle.objective.c2Mastery": "Yhdistä kaikki taidot täsmällisesti, joustavasti ja viestintää halliten."
  ,"rlle.mission.travelAirport": "Selviydy lentoasemalla"
  ,"rlle.missionObjective.travelAirport": "Ymmärrä ohjeet ja löydä oikealle lähtöportille."
  ,"rlle.mission.travelHotel": "Ratkaise ongelma hotellissa"
  ,"rlle.missionObjective.travelHotel": "Selitä ongelma ja sovi käytännöllisestä ratkaisusta."
  ,"rlle.mission.travelRestaurant": "Tilaa ravintolassa"
  ,"rlle.missionObjective.travelRestaurant": "Kysy ruokalistasta ja tee sopiva tilaus."
  ,"rlle.mission.travelTransport": "Käytä paikallisliikennettä"
  ,"rlle.missionObjective.travelTransport": "Kysy reittiä, ymmärrä vaihtoehdot ja vahvista määränpääsi."
  ,"rlle.mission.travelDirections": "Kysy tietä"
  ,"rlle.missionObjective.travelDirections": "Kysy, minne mennä, ja varmista ymmärtäneesi."
  ,"rlle.mission.travelEmergency": "Toimi hätätilanteessa"
  ,"rlle.missionObjective.travelEmergency": "Kuvaile kiireellinen ongelma ja ymmärrä seuraava ohje."
  ,"rlle.mission.workInterview": "Osallistu työhaastatteluun"
  ,"rlle.missionObjective.workInterview": "Esittele kokemuksesi ja vastaa jatkokysymyksiin luontevasti."
  ,"rlle.mission.workMeeting": "Osallistu kokoukseen"
  ,"rlle.missionObjective.workMeeting": "Seuraa keskustelua, esitä ajatus ja selvennä toimenpide."
  ,"rlle.mission.workPresentation": "Esittele projekti"
  ,"rlle.missionObjective.workPresentation": "Selitä projekti selkeästi ja vastaa kysymyksiin."
  ,"rlle.mission.workEmail": "Kirjoita ammatillinen sähköposti"
  ,"rlle.missionObjective.workEmail": "Kirjoita tiivis viesti sopivalla sävyllä ja pyynnöllä."
  ,"rlle.mission.workNegotiation": "Neuvottele sopimus"
  ,"rlle.missionObjective.workNegotiation": "Kerro prioriteetit, reagoi vastaväitteisiin ja saavuta kompromissi."
  ,"rlle.mission.studiesLecture": "Seuraa luentoa"
  ,"rlle.missionObjective.studiesLecture": "Tunnista keskeiset ajatukset ja selitä ne yksinkertaisemmin."
  ,"rlle.mission.studiesSynthesis": "Yhdistä vaativia lähteitä"
  ,"rlle.missionObjective.studiesSynthesis": "Yhdistä vaativaa puhuttua ja kirjoitettua aineistoa ja välitä se täsmällisesti."
  ,"rlle.mission.studiesPresentation": "Pidä akateeminen esitys"
  ,"rlle.missionObjective.studiesPresentation": "Jäsennä selitys ja vastaa yleisölle."
  ,"rlle.mission.studiesDiscussion": "Osallistu luokkakeskusteluun"
  ,"rlle.missionObjective.studiesDiscussion": "Jatka toisen ajatusta ja perustele oma panoksesi."
  ,"rlle.mission.studiesTeacher": "Keskustele opettajan kanssa"
  ,"rlle.missionObjective.studiesTeacher": "Pyydä selvennystä ja varmista odotukset."
  ,"rlle.mission.studiesAdministration": "Hoida hallinnollinen asia"
  ,"rlle.missionObjective.studiesAdministration": "Ymmärrä menettely ja pyydä tarvitsemasi tiedot."
  ,"rlle.mission.socialIntroduction": "Esittele itsesi"
  ,"rlle.missionObjective.socialIntroduction": "Aloita ystävällinen keskustelu ja jaa perustietoja."
  ,"rlle.mission.socialChat": "Pidä keskustelu käynnissä"
  ,"rlle.missionObjective.socialChat": "Reagoi, esitä jatkokysymys ja korjaa väärinkäsityksiä."
  ,"rlle.mission.socialStory": "Kerro tarina"
  ,"rlle.missionObjective.socialStory": "Kerro tapahtumat selkeässä järjestyksessä ja pidä kuulija mukana."
  ,"rlle.mission.socialInvitation": "Kutsu joku"
  ,"rlle.missionObjective.socialInvitation": "Ehdota suunnitelmaa, keskustele yksityiskohdista ja vastaa kohteliaasti."
  ,"rlle.mission.socialDebate": "Väittele ajatuksesta"
  ,"rlle.missionObjective.socialDebate": "Puolusta kantaa ja vastaa toiseen näkökulmaan."
  ,"rlle.canDo.travelOrder": "Tilata ravintolassa"
  ,"rlle.canDo.travelDirections": "Kysyä ja ymmärtää reittiohjeita"
  ,"rlle.canDo.travelHotelProblem": "Selittää ongelma hotellissa"
  ,"rlle.canDo.travelTransport": "Järjestää matka paikallisliikenteellä"
  ,"rlle.canDo.travelEmergency": "Selittää kiireellinen ongelma"
  ,"rlle.canDo.workInterview": "Esitellä itseni työhaastattelussa"
  ,"rlle.canDo.workMeeting": "Osallistua kokoukseen"
  ,"rlle.canDo.workPresent": "Esitellä projekti"
  ,"rlle.canDo.workEmail": "Kirjoittaa ammatillinen sähköposti"
  ,"rlle.canDo.workNegotiate": "Neuvotella sopimus"
  ,"rlle.canDo.studiesRequest": "Pyytää akateemista tai hallinnollista apua"
  ,"rlle.canDo.studiesFollowLecture": "Seurata luentoa ja tunnistaa sen pääajatukset"
  ,"rlle.canDo.studiesDiscuss": "Osallistua luokkakeskusteluun"
  ,"rlle.canDo.studiesPresent": "Pitää akateeminen esitys"
  ,"rlle.canDo.studiesSynthesise": "Tiivistää ja selittää monimutkaista tietoa"
  ,"rlle.canDo.socialIntroduce": "Esitellä itseni luontevasti"
  ,"rlle.canDo.socialClarify": "Korjata väärinkäsitys"
  ,"rlle.canDo.socialInvite": "Kutsua joku ja järjestää suunnitelma"
  ,"rlle.canDo.socialTellStory": "Kertoa menneestä kokemuksesta"
  ,"rlle.canDo.socialDefendOpinion": "Perustella mielipide"
  ,"rlle.demo.objectiveInternationalWork": "Työskennellä kansainvälisesti"
  ,"rlle.ui.badge": "JÄSENNELTY KURSSI"
  ,"rlle.ui.cefr": "CEFR"
  ,"rlle.ui.nba.badge": "SEURAAVA KIELITOIMINTO"
  ,"rlle.ui.nba.review": "Kertaa {count} ajankohtaista kielikohdetta"
  ,"rlle.ui.nba.reviewReason": "{count} todellista FSRS-kohdetta on nyt ajankohtaisena."
  ,"rlle.ui.nba.reviewAction": "Kertaa nyt"
  ,"rlle.ui.nba.retryMission": "Yritä tosielämän tehtävää uudelleen"
  ,"rlle.ui.nba.retryMissionReason": "Havaitulla vaikeudella on mikrotunti, ja se on valmis uuteen yritykseen."
  ,"rlle.ui.nba.resumeMission": "Jatka Maailman tehtävää"
  ,"rlle.ui.nba.resumeMissionReason": "Tämä tosielämän tehtävä on yhä aktiivinen."
  ,"rlle.ui.nba.resumeLesson": "Jatka kielioppituntia"
  ,"rlle.ui.nba.resumeLessonReason": "Jäsennellyn oppitunnin vaihe on yhä aktiivinen."
  ,"rlle.ui.nba.nextLesson": "Jatka jäsenneltyä kurssia"
  ,"rlle.ui.nba.nextLessonReason": "Tämä on seuraava keskeneräinen yksikkö CEFR-opetussuunnitelmassa."
  ,"rlle.ui.nba.nextLessonAction": "Aloita seuraava oppitunti"
  ,"rlle.ui.course.status.paused": "Keskeytetty"
  ,"rlle.ui.course.status.not-started": "Ei aloitettu"
  ,"rlle.ui.mission.category": "Tehtäväluokka"
  ,"rlle.ui.mission.modality": "Harjoittelutapa"
  ,"rlle.ui.mission.current": "Tehtävä käynnissä"
  ,"rlle.ui.mission.starting": "Tehtävä alkaa…"
  ,"rlle.ui.mission.status.active": "Kesken"
  ,"rlle.ui.mission.status.paused": "Keskeytetty"
  ,"rlle.ui.mission.status.succeeded": "Onnistui"
  ,"rlle.ui.mission.status.needs-retry": "Yritä uudelleen"
  ,"rlle.ui.mission.feedback.succeeded": "Tehtävä suoritettu havaitun näytön perusteella."
  ,"rlle.ui.mission.feedback.repair": "Tietty vaikeus havaittiin. Käytä mikrotuntia ja yritä sitten uudelleen."
  ,"rlle.ui.mission.feedback.proof": "VIESTINNÄLLINEN NÄYTTÖ"
  ,"rlle.ui.mission.feedback.microLesson": "MIKROTUNTI"
  ,"rlle.ui.mission.feedback.example": "Esimerkki"
  ,"rlle.ui.modality.text": "Kirjoita"
  ,"rlle.ui.modality.voice": "Puhu"
  ,"rlle.ui.modality.mixed": "Kirjoita ja puhu"
  ,"rlle.ui.cando.notAvailable": "Osaamiskartta ei ole vielä saatavilla palvelimelta."
  ,"rlle.ui.cando.all": "Kaikki taidot"
  ,"rlle.ui.cando.summary": "Vain havaittu näyttö voi vahvistaa taidon."
  ,"rlle.ui.cando.validatedCount": "{count} osoitettua"
  ,"rlle.ui.cando.measuredCount": "{count} arvioitua"
  ,"rlle.ui.gap.status.observed": "Havaittu kerran"
  ,"rlle.ui.gap.status.repeated": "Havaittu uudelleen"
  ,"rlle.ui.gap.status.confirmed": "Vahvistettu"
  ,"rlle.ui.gap.status.repairing": "Korjattavana"
  ,"rlle.ui.gap.status.consolidated": "Vahvistettu"
  ,"rlle.ui.dimension.conjugation": "Taivutus"
  ,"rlle.ui.dimension.fluency": "Sujuvuus"
  ,"rlle.ui.dimension.formulation": "Muotoilu"
  ,"tutor6.state.paused": "Tallennus keskeytetty"
  ,"scan.openDocument": "Avaa Asiakirjaäly"
  ,"scan.captured": "Sivut tallennettu turvallisesti"
  ,"scan.capturedDetail": "Kaappaus säilytettiin. Tekstianalyysi tulee saataville, kun valtuutettu konenäköpalvelu on aktiivinen."
  ,"sub.usageAction": "Näytä käyttö ja kiintiöt"
  ,"sub.availablePlans": "Yksilötilaukset"
  ,"sub.availablePlansDetail": "Vertaa kullekin saatavilla olevalle tarjoukselle määritettyjä nykyisiä rajoja."
  ,"sub.notAvailable": "Ei tällä hetkellä saatavilla"
  ,"sub.periodEnd": "Nykyinen kausi päättyy"
  ,"sub.trialEnds": "Kokeilujakso päättyy"
  ,"sub.openInvoice": "Avaa lasku"
  ,"sub.upgrade": "Vaihda tasoon"
  ,"sub.partial": "Jotkin laskutustiedot eivät ole tilapäisesti saatavilla. Nykyistä tilausta ei ole muutettu."
  ,"usage.loading": "Ladataan käyttötietojasi…"
  ,"usage.remaining": "Jäljellä"
  ,"usage.reset": "Nollautuu"
  ,"usage.mb": "Mt"
  ,"usage.kb": "kt"
  ,"usage.managePlan": "Hallitse tilausta"
  ,"usage.currentPlan": "Nykyinen tilaus"
  ,"usage.planUnavailable": "Tilaustiedot eivät ole tilapäisesti saatavilla."
  ,"usage.limitReached": "Tilauksen raja on saavutettu"
  ,"usage.limitResetKnown": "Tämä laskuri vapautuu uudelleen {date}."
  ,"usage.limitNoReset": "Raja kuvastaa nykyistä käyttöä. Vapauta kapasiteettia tai vaihda tilausta jatkaaksesi."
  ,"usage.nonAiAvailable": "Muu Second Brain on edelleen käytettävissä, myös toiminnot, jotka eivät kuluta tätä kiintiötä."
  ,"usage.partial": "Joitakin tilaus- tai käyttötietoja ei voitu päivittää. Näytetyt arvot ovat viimeisimmät saatavilla olevat."
  ,"priv.controls": "Liittyvät asetukset"
  ,"priv.memory": "Tekoälymuisti"
  ,"priv.memoryHelp": "Tarkista, mitä Second Brain muistaa ja mitä asetuksia tähän muistiin liittyy."
  ,"priv.documents": "Asiakirjat ja lähteet"
  ,"priv.documentsHelp": "Tarkista Kirjastoon tuomasi lähteet."
  ,"landing.nav.menu": "Valikko"
  ,"landing12.seo.title": "Second Brain — henkilökohtainen älykäs oppimisjärjestelmäsi"
  ,"landing12.seo.description": "Opi, ymmärrä, harjoittele, muista ja tuota yhdellä yhdistetyllä oppimisjärjestelmällä: asiakirjasi, tekoälyprofessori, kognitiivinen kaksonen, kertaus, tutkimus, kielet ja työtila."
  ,"landing12.brand": "Second Brain"
  ,"landing12.signature": "Yksi tuote. Yksi kokemus."
  ,"landing12.nav.product": "Tuote"
  ,"landing12.nav.how": "Miten se toimii"
  ,"landing12.nav.languages": "Kielet"
  ,"landing12.nav.pricing": "Hinnat"
  ,"landing12.nav.download": "Lataa"
  ,"landing12.nav.faq": "Usein kysyttyä"
  ,"landing12.nav.contact": "Yhteystiedot"
  ,"landing12.nav.menu": "Avaa navigointi"
  ,"landing12.nav.close": "Sulje navigointi"
  ,"landing12.cta.signin": "Kirjaudu sisään"
  ,"landing12.cta.start": "Aloita ilmaiseksi"
  ,"landing12.cta.startShort": "Aloita"
  ,"landing12.cta.how": "Katso, miten se toimii"
  ,"landing12.cta.download": "Lataa Second Brain"
  ,"landing12.cta.language": "Opi kieli"
  ,"landing12.cta.next": "Seuraava vaihe"
  ,"landing12.cta.restart": "Toista matka"
  ,"landing12.demo.label": "Tuote-esittely"
  ,"landing12.demo.disclaimer": "Staattinen julkinen esimerkki. Ei oikeita käyttäjätietoja eikä simuloitua käsittelyä."
  ,"landing12.hero.eyebrow": "Henkilökohtainen älykäs oppimisjärjestelmä"
  ,"landing12.hero.title": "Opi. Ymmärrä. Harjoittele. Muista. Edisty."
  ,"landing12.hero.subtitle": "Anna Second Brain -palvelulle kysymys, asiakirja tai tavoite. Se rakentaa kontekstin, opettaa, auttaa harjoittelemaan, vahvistaa olennaisen ja ehdottaa seuraavaa toimintoa."
  ,"landing12.hero.availability": "Saatavilla verkossa · mobiili- ja työpöytäsovelluksia valmistellaan"
  ,"landing12.hero.scene.product": "SECOND BRAIN · YKSI KONTEKSTI"
  ,"landing12.hero.scene.tabsLabel": "Tuote-esittelyn vaiheet"
  ,"landing12.hero.scene.question.tab": "Aikomus"
  ,"landing12.hero.scene.context.tab": "Konteksti"
  ,"landing12.hero.scene.teaching.tab": "Kokemus"
  ,"landing12.hero.scene.next.tab": "Seuraava toiminto"
  ,"landing12.hero.scene.question.title": "Mitä haluat ymmärtää?"
  ,"landing12.hero.scene.question.message": "Auta minua ymmärtämään soluhengitys koettani varten."
  ,"landing12.hero.scene.question.intent": "Ymmärrä"
  ,"landing12.hero.scene.question.source": "Biologian kurssi.pdf"
  ,"landing12.hero.scene.context.title": "Second Brain kokoaa hyödyllisen kontekstin"
  ,"landing12.hero.scene.context.brain": "Omat aivoni"
  ,"landing12.hero.scene.context.document": "Biologian kurssi.pdf"
  ,"landing12.hero.scene.context.goal": "Koetavoite"
  ,"landing12.hero.scene.context.concept": "Soluhengitys"
  ,"landing12.hero.scene.context.fragile": "Vahvistettava käsite"
  ,"landing12.hero.scene.teaching.title": "Tekoälyprofessori"
  ,"landing12.hero.scene.teaching.message": "Yhdistetään glukoosi, happi ja ATP ja tarkistetaan ajatus yhdellä kysymyksellä."
  ,"landing12.hero.scene.teaching.explain": "Selitys"
  ,"landing12.hero.scene.teaching.practice": "Harjoittelu"
  ,"landing12.hero.scene.teaching.voice": "Puhe"
  ,"landing12.hero.scene.next.title": "Paras seuraava toiminto"
  ,"landing12.hero.scene.next.action": "Vahvista soluhengitystä"
  ,"landing12.hero.scene.next.reason": "Ehdotettu, koska käsite liittyy koetavoitteeseesi ja tarvitsee vielä harjoittelua."
  ,"landing12.hero.scene.next.context": "Peruste näkyvissä · määränpää säilytetty"
  ,"landing12.story.kicker": "Yksi tuote, yksi kokemus"
  ,"landing12.story.title": "Katso, miten tieto kulkee koko järjestelmän läpi"
  ,"landing12.story.lead": "Lähde ei jää vain varastoon. Esittely seuraa samaa kontekstia asiakirjasta ymmärtämiseen, harjoitteluun, kertaukseen ja akateemiseen tuotokseen."
  ,"landing12.story.documents.title": "Asiakirjasta tulee käyttökelpoista tietoa"
  ,"landing12.story.documents.short": "Asiakirjat"
  ,"landing12.story.documents.desc": "Kirjasto vastaanottaa lähteen. Asiakirjaäly lukee sen, poimii käsitteitä ja valmistelee lähteisiin perustuvia kysymyksiä keksimättä edistystä."
  ,"landing12.story.brain.title": "Käsitteet liittyvät yhdistettyyn kognitiiviseen karttaan"
  ,"landing12.story.brain.short": "Omat aivoni"
  ,"landing12.story.brain.desc": "Kognitiivinen kaksonen näyttää käsitteet, yhteydet, vahvuudet ja hauraudet. Julkinen esimerkki on havainnollistava, ei todellinen oppijan pistemäärä."
  ,"landing12.story.professor.title": "Professori opettaa samasta kontekstista"
  ,"landing12.story.professor.short": "Tekoälyprofessori"
  ,"landing12.story.professor.desc": "Asiakirja, kohdekäsite ja oppimistavoite seuraavat istuntoa. Kokemus voi muuttua selitykseksi, oppitunniksi, kysymykseksi tai ohjatuksi harjoitukseksi."
  ,"landing12.story.oral.title": "Ymmärrys muuttuu puheharjoitteluksi"
  ,"landing12.story.oral.short": "Suullinen ja puhe"
  ,"landing12.story.oral.desc": "Kuuntelu, litterointi ja vastaus ovat erillisiä, luettavia tiloja. Litterointi näkyy; koristeellinen aaltomuoto ei teeskentele mittaavansa puhetta."
  ,"landing12.story.review.title": "Hauraasta ajatuksesta tulee kertaus"
  ,"landing12.story.review.short": "Kertaus"
  ,"landing12.story.review.desc": "Kertausmoottori vahvistaa tiedon oikeaan aikaan. Tässä näkyvä päivä on selvästi esittelyä, ei oikea aikataulu."
  ,"landing12.story.workspace.title": "Tiedosta tulee tuotos"
  ,"landing12.story.workspace.short": "Työtila"
  ,"landing12.story.workspace.desc": "Akateeminen työtila pitää suunnitelman, tekstin, lähteet ja viittaukset yhdessä, ja kontekstuaalinen avustaja tukee oppijan omaa työtä."
  ,"landing12.story.sharedContext": "Jaettu konteksti"
  ,"landing12.story.traceability": "Lähteen jäljitettävyys"
  ,"landing12.story.outcome": "Annan tietoa → Second Brain ymmärtää sen → opettaa minua → auttaa harjoittelemaan → auttaa muistamaan → auttaa käyttämään sitä."
  ,"landing12.story.nba": "Sitten se ehdottaa selkeää, perusteltavaa seuraavaa toimintoa jättämättä minua koontinäyttöön."
  ,"landing12.story.file": "Biologian kurssi.pdf"
  ,"landing12.story.fileType": "Esittelyasiakirja · PDF"
  ,"landing12.story.readyDemo": "Esimerkki valmis"
  ,"landing12.story.pipeline.import": "Lähde tuotu"
  ,"landing12.story.pipeline.read": "Luettava sisältö tunnistettu"
  ,"landing12.story.pipeline.concepts": "Käsitteet poimittu"
  ,"landing12.story.pipeline.connect": "Yhteydet valmisteltu"
  ,"landing12.story.concept.respiration": "Soluhengitys"
  ,"landing12.story.concept.toConsolidate": "Vahvistettava"
  ,"landing12.story.concept.photosynthesis": "Fotosynteesi"
  ,"landing12.story.concept.chlorophyll": "Klorofylli"
  ,"landing12.story.concept.atp": "ATP"
  ,"landing12.story.brain.note": "Kartta näyttää yhteydet ja oppimistilat vain, kun tuotteella on todellista näyttöä."
  ,"landing12.story.context.brain": "Omat aivoni"
  ,"landing12.story.context.document": "Biologian kurssi.pdf"
  ,"landing12.story.context.goal": "Koetavoite"
  ,"landing12.story.professor.question": "Miksi tämä käsite tuntuu yhä vaikealta?"
  ,"landing12.story.professor.answer": "Rakennetaan se uudelleen ATP:stä: ensin tarkoitus, sitten vaiheet ja lopuksi lyhyt tarkistus omin sanoin."
  ,"landing12.story.professor.session": "Kokemusistunto pitää lähteen, aikomuksen, historian ja seuraavan toiminnon yhdessä."
  ,"landing12.story.oral.listen": "Kuuntelu"
  ,"landing12.story.oral.transcript": "Litterointi"
  ,"landing12.story.oral.answer": "Vastaus"
  ,"landing12.story.oral.visibleTranscript": "Näkyvä litterointi"
  ,"landing12.story.oral.transcriptText": "“Soluhengitys muuttaa glukoosin energian ATP:ksi, jota solu voi käyttää.”"
  ,"landing12.story.oral.note": "Puhe täydentää kirjoitettua kokemusta. Äänipalvelun häiriö ei poista luettavaa sisältöä."
  ,"landing12.story.review.cardLabel": "Käsitteen kertaus"
  ,"landing12.story.review.question": "Selitä ATP:n tehtävä katsomatta lähdettä."
  ,"landing12.story.review.tomorrow": "Esimerkki: kertaa huomenna"
  ,"landing12.story.review.note": "Oikea sovellus ajoittaa todellisen kertaushistorian perusteella; tämä Landing ei luo aikataulua."
  ,"landing12.story.review.fsrs": "Jaksotettu kertaus"
  ,"landing12.story.workspace.plan": "Suunnitelma"
  ,"landing12.story.workspace.context": "Konteksti"
  ,"landing12.story.workspace.analysis": "Analyysi"
  ,"landing12.story.workspace.conclusion": "Johtopäätös"
  ,"landing12.story.workspace.documentTitle": "Miten solut muuntavat energiaa"
  ,"landing12.story.workspace.copy": "Lähde ja käsitteet pysyvät jäljitettävinä, kun oppija jäsentää argumentin ja kirjoittaa lopullisen tekstin."
  ,"landing12.story.workspace.source": "Biologian kurssi.pdf"
  ,"landing12.story.workspace.citation": "Lähdeviite"
  ,"landing12.features.kicker": "Yhdistetyt ominaisuudet"
  ,"landing12.features.title": "Ei tekoälytyökalujen kokoelma"
  ,"landing12.features.lead": "Jokaisella ominaisuudella on selkeä rooli, mutta ne jakavat samat lähteet, istunnot ja oppimiskontekstin."
  ,"landing12.features.group.personal": "Henkilökohtainen älykkyys"
  ,"landing12.features.group.personal.desc": "Tuntee oppijan"
  ,"landing12.features.group.understand": "Ymmärrä"
  ,"landing12.features.group.understand.desc": "Kysymykset ja lähteet"
  ,"landing12.features.group.practice": "Harjoittele ja säilytä"
  ,"landing12.features.group.practice.desc": "Aktiivinen oppiminen"
  ,"landing12.features.group.produce": "Käytä ja jatka"
  ,"landing12.features.group.produce.desc": "Työ ja seuraava toiminto"
  ,"landing12.feature.brain.title": "Omat aivoni"
  ,"landing12.feature.brain.desc": "Näkyvä kognitiivinen kaksonen käsitteille, yhteyksille, hallinnalle, muistille ja oppimishistorialle."
  ,"landing12.feature.professor.title": "Tekoälyprofessori"
  ,"landing12.feature.professor.desc": "Pedagoginen identiteetti, joka opettaa, selittää, kysyy, arvioi ja mukautuu aktiiviseen kontekstiin."
  ,"landing12.feature.learn.title": "Opi"
  ,"landing12.feature.learn.desc": "Yksi kirjoituskenttä ymmärtämiseen, oppimiseen, harjoitteluun, tutkimiseen tai luomiseen tekstillä, puheella ja lähteillä."
  ,"landing12.feature.documents.title": "Asiakirjaäly"
  ,"landing12.feature.documents.desc": "Tuo, ymmärrä, kysele ja muunna yksi asiakirja tai rajattu erä lähteiden jäljitettävyys säilyttäen."
  ,"landing12.feature.review.title": "Kertaus"
  ,"landing12.feature.review.desc": "Vahvistaa unohtumisvaarassa olevan tiedon todellisen kertaushistorian ja jaksotetun kertauksen avulla."
  ,"landing12.feature.research.title": "Tutkimus"
  ,"landing12.feature.research.desc": "Nopea, lähteistetty tai syvällinen tutkimus Omissa aivoissani ja Kirjastossa; viittaukset voi tarkistaa."
  ,"landing12.feature.workspace.title": "Akateeminen työtila"
  ,"landing12.feature.workspace.desc": "Pysyvä työtila suunnitelmille, luonnoksille, lähteille, viittauksille ja kontekstuaaliselle avulle."
  ,"landing12.feature.languages.title": "Kielet ja kielikylpy"
  ,"landing12.feature.languages.desc": "Jäsennelty CEFR-kurssi, joka liittyy tosielämän tehtäviin, palautteeseen, kertaukseen ja toiminnallisen osaamisen näyttöön."
  ,"landing12.feature.voice.title": "Suullinen ja puhe"
  ,"landing12.feature.voice.desc": "Puhu, tarkista litterointi ja saa kirjoitettu vastaus, joka säilyy saatavilla äänen epäonnistuessa."
  ,"landing12.feature.next.title": "Paras seuraava toiminto"
  ,"landing12.feature.next.desc": "Perusteltava suositus, joka yhdistää tavoitteet, istunnot, kertauksen ja nykyisen kontekstin."
  ,"landing12.features.researchScope": "Tutkimus omista lähteistäsi"
  ,"landing12.features.noWebClaim": "Ulkoista verkkopalvelua ei ole määritetty"
  ,"landing12.features.sameContext": "Yksi jaettu konteksti"
  ,"landing12.brain.kicker": "Omat aivoni"
  ,"landing12.brain.title": "Näkyvä kognitiivinen kaksosesi"
  ,"landing12.brain.lead": "Se kertoo, mitä tiedät, mikä on haurasta, miten tieto yhdistyy ja mikä tarvitsee huomiota seuraavaksi."
  ,"landing12.brain.center": "Oppimiskontekstisi"
  ,"landing12.brain.knowledge": "Tietämys"
  ,"landing12.brain.connections": "Yhteydet"
  ,"landing12.brain.strengths": "Vahvuudet"
  ,"landing12.brain.fragilities": "Hauraudet"
  ,"landing12.brain.memory": "Muisti"
  ,"landing12.brain.noScores": "Second Brain näyttää hallinnan ja vaikutuksen vain näytön perusteella; Landing ei keksi pisteitä."
  ,"landing12.professor.kicker": "Tekoälyprofessori"
  ,"landing12.professor.title": "Opettaja, ei jälleen yksi yleinen chatbot"
  ,"landing12.professor.lead": "Se voi vaihtaa kokemuksen muotoa säilyttäen oppijan kontekstin ja istunnon."
  ,"landing12.professor.level": "Taso"
  ,"landing12.professor.goals": "Tavoitteet"
  ,"landing12.professor.documents": "Asiakirjat"
  ,"landing12.professor.progress": "Edistyminen"
  ,"landing12.professor.identity": "Pedagoginen identiteetti"
  ,"landing12.professor.example": "“Voin selittää sen toisella tavalla, kysyä sinulta, siirtyä suulliseen harjoitteluun tai muuttaa vaikeuden kertaukseksi.”"
  ,"landing12.professor.mode.explain": "Selitä"
  ,"landing12.professor.mode.teach": "Opeta"
  ,"landing12.professor.mode.question": "Kysy"
  ,"landing12.professor.mode.assess": "Arvioi"
  ,"landing12.professor.mode.voice": "Puhe"
  ,"landing12.personal.kicker": "Henkilökohtainen älykkyys"
  ,"landing12.personal.title": "Oppimisesi mukana kehittyvä järjestelmä"
  ,"landing12.personal.lead": "Mitä enemmän opit, harjoittelet ja kertaat, sitä paremmin Second Brain järjestää kontekstisi ja tekee seuraavasta toiminnosta hyödyllisen."
  ,"landing12.personal.learn": "Mitä opit"
  ,"landing12.personal.understand": "Mitä ymmärrät"
  ,"landing12.personal.forget": "Mikä uhkaa unohtua"
  ,"landing12.personal.master": "Mitä hallitset"
  ,"landing12.personal.goals": "Mitä haluat saavuttaa"
  ,"landing12.personal.twin": "Elävä kognitiivinen kartta"
  ,"landing12.personal.note": "Ensin aikajana, kun tietoa on vähän; tutkittava kaavio, kun näyttö on kypsää."
  ,"landing12.personal.nbaLabel": "Esimerkki parhaasta seuraavasta toiminnosta"
  ,"landing12.personal.nbaAction": "Jatka englanninkielisen kokouksen tehtävää"
  ,"landing12.personal.nbaReason": "Koska se liittyy kansainvälisen työn tavoitteeseesi ja viimeisin istuntosi on valmis jatkettavaksi."
  ,"landing12.languages.kicker": "Kielet ja kielikylpy"
  ,"landing12.languages.title": "Opi kieli tekoälyprofessorisi kanssa"
  ,"landing12.languages.lead": "Valitse, mitä haluat osata. Second Brain yhdistää kokonaisen kurssin, tosielämän tehtävät, suullisen harjoittelun, kohdennetun korjauksen ja kertauksen."
  ,"landing12.languages.demoDisclaimer": "Skenaario Lot 11 bis -suunnitelmasta. Vain esittely; sertifiointia tai oppijan pisteitä ei väitetä."
  ,"landing12.languages.objective": "Tavoite"
  ,"landing12.languages.objectiveValue": "Haluan työskennellä kansainvälisesti"
  ,"landing12.languages.missionMeeting": "Osallistu kokoukseen"
  ,"landing12.languages.rlle": "Tosielämän kielimoottori"
  ,"landing12.languages.stage.goal": "Tavoite"
  ,"landing12.languages.stage.course": "Kurssi"
  ,"landing12.languages.stage.mission": "Tehtävä"
  ,"landing12.languages.stage.conversation": "Keskustelu professorin kanssa"
  ,"landing12.languages.stage.gap": "Vaikeus havaittu"
  ,"landing12.languages.stage.micro-lesson": "Mikrotunti"
  ,"landing12.languages.stage.retry": "Uusi yritys"
  ,"landing12.languages.stage.vocabulary": "Hyödyllinen kieli"
  ,"landing12.languages.stage.review": "Kertaus"
  ,"landing12.languages.stage.functional-progress": "Käytännön osaamisen edistyminen"
  ,"landing12.languages.stage.goal.note": "Oppijan todellinen tavoite määrää kurssin prioriteetit."
  ,"landing12.languages.stage.course.note": "CEFR jäsentää polun; sitä ei esitetä ulkoisena sertifiointina."
  ,"landing12.languages.stage.mission.note": "Maailman tehtävä muuttaa tiedon konkreettiseksi viestintätehtäväksi."
  ,"landing12.languages.stage.conversation.note": "Opiskeltava kieli pysyy erillään käyttöliittymän kielestä."
  ,"landing12.languages.stage.gap.note": "Puute perustuu havaittuun näyttöön, ei koristeelliseen pistemäärään."
  ,"landing12.languages.stage.micro-lesson.note": "Korjaus keskittyy tarkkaan esteeseen ennen uutta yritystä."
  ,"landing12.languages.stage.retry.note": "Uusi yritys antaa oppijalle mahdollisuuden soveltaa korjausta heti."
  ,"landing12.languages.stage.vocabulary.note": "Valittu kieli säilyttää alkuperänsä tehtävään ja istuntoon."
  ,"landing12.languages.stage.review.note": "Sanasto voi siirtyä nykyiseen kertaus- ja FSRS-työnkulkuun."
  ,"landing12.languages.stage.functional-progress.note": "Osaaminen vahvistetaan vain hyväksytyn näytön perusteella todellisessa tuotteessa."
  ,"landing12.languages.path.goal": "Toiminnallinen määränpää, ei epämääräinen aihe"
  ,"landing12.languages.path.goal.desc": "Kurssi alkaa tilanteesta, jonka oppija haluaa hallita tosielämässä."
  ,"landing12.languages.path.course": "Jäsennelty B1-polku"
  ,"landing12.languages.path.course.desc": "Opetussuunnitelma, osa-alueet ja tehtävät pysyvät yhteydessä erillisten minisovellusten sijaan."
  ,"landing12.languages.path.mission": "Kokous todellisena tehtävänä"
  ,"landing12.languages.path.mission.desc": "Professori luo kontekstuaalisen keskustelun, havaitsee esteet ja ohjaa korjaussilmukkaa."
  ,"landing12.languages.professorLabel": "Tekoälyprofessori · englanti B1"
  ,"landing12.languages.transcriptVisible": "Puhetila ja litterointi näkyvät selkeästi ja ovat muokattavissa sovelluksessa."
  ,"landing12.languages.gapDetected": "Havaittu toiminnallinen puute"
  ,"landing12.languages.gapExplanation": "Tarkoitus on selvä, mutta adverbin muoto estää luontevan ammatillisen lauseen. Oikeassa tuotteessa vaikeus voi siirtyä Virhemuistiin, jotta Korjaussilmukka kohdistuu siihen myöhemmin."
  ,"landing12.languages.gapGrammar": "Kielioppi"
  ,"landing12.languages.gapFluency": "Sujuvuus"
  ,"landing12.languages.microLesson": "Kohdennettu korjaus"
  ,"landing12.languages.microRule": "Kuvaile joukkueen työskentelytapaa adverbilla."
  ,"landing12.languages.microHint": "Professori yhdistää säännön lauseeseen avaamatta irrallista oppituntia."
  ,"landing12.languages.retryLabel": "Yritä samaa tehtävää uudelleen"
  ,"landing12.languages.retryObserved": "Korjattu rakenne näkyy uudessa yrityksessä"
  ,"landing12.languages.vocabularyTitle": "Tästä tehtävästä valittu kieliaines"
  ,"landing12.languages.vocabularyTrace": "Tuotteessa jokainen tallennettu kohde säilyttää kielensä, lähteensä ja istuntoalkuperänsä."
  ,"landing12.languages.reviewLabel": "Yhdistetty Kertaukseen"
  ,"landing12.languages.reviewAction": "Vahvista hyödyllinen rakenne oikeaan aikaan"
  ,"landing12.languages.reviewTrace": "Todellinen aikataulu syntyy aidosta kertausnäytöstä; tämä esittely ei luo sitä."
  ,"landing12.languages.canDoTitle": "Mitä osaan jo tehdä"
  ,"landing12.languages.canDo.introduce": "Esitellä itseni"
  ,"landing12.languages.canDo.restaurant": "Tilata ravintolassa"
  ,"landing12.languages.canDo.meeting": "Osallistua kokoukseen"
  ,"landing12.languages.canDo.opinion": "Perustella mielipiteen"
  ,"landing12.languages.canDoDisclaimer": "Havainnollistava luettelo. Vain näyttö voi vahvistaa taidon sovelluksessa."
  ,"landing12.languages.courseTitle": "Kokonainen kielikurssi"
  ,"landing12.languages.courseLead": "Keskustelu on yksi kurssin osa selkeän kielityön ja ymmärtämisen rinnalla."
  ,"landing12.languages.strand.vocabulary": "Sanasto"
  ,"landing12.languages.strand.grammar": "Kielioppi"
  ,"landing12.languages.strand.verbs": "Verbit"
  ,"landing12.languages.strand.conjugation": "Taivutus"
  ,"landing12.languages.strand.reading": "Lukeminen"
  ,"landing12.languages.strand.writing": "Kirjoittaminen"
  ,"landing12.languages.strand.listening": "Kuunteleminen"
  ,"landing12.languages.strand.oral": "Suullinen"
  ,"landing12.languages.strand.pronunciation": "Ääntäminen"
  ,"landing12.languages.strand.mediation": "Välittäminen"
  ,"landing12.languages.missionsTitle": "Maailman tehtävät"
  ,"landing12.languages.missionsLead": "Rajattu tilanneluettelo kielen käyttämiseen, tavoitteineen ja vähimmäistasoineen."
  ,"landing12.languages.mission.travel": "Matkailu"
  ,"landing12.languages.mission.work": "Työ"
  ,"landing12.languages.mission.studies": "Opinnot"
  ,"landing12.languages.mission.social": "Sosiaalinen elämä"
  ,"landing12.languages.registryTitle": "34 tuettua opiskelukieltä"
  ,"landing12.languages.registryLead": "Kielen oma nimi ja käyttöliittymän kielinen nimi välittävät merkityksen. Neutraali symboli korvaa maan lipun, jos yksi maa olisi monitulkintainen."
  ,"landing12.how.kicker": "Miten se toimii"
  ,"landing12.how.title": "Yksinkertainen matka, vaikka älykkyys on syvää"
  ,"landing12.how.lead": "Sinä tuot aikomuksen. Second Brain piilottaa teknisen monimutkaisuuden yhden jatkuvan kokemuksen taakse."
  ,"landing12.how.goal.title": "Kerro tavoitteesi"
  ,"landing12.how.goal.desc": "Kerro, mitä haluat ymmärtää tai saavuttaa."
  ,"landing12.how.act.title": "Opi, tuo tai kysy"
  ,"landing12.how.act.desc": "Käytä tekstiä, puhetta, skannausta tai tiedostoa."
  ,"landing12.how.context.title": "Rakenna konteksti"
  ,"landing12.how.context.desc": "Yhdistä olennaiset istunnot, lähteet ja tavoitteet."
  ,"landing12.how.practice.title": "Harjoittele"
  ,"landing12.how.practice.desc": "Siirry selityksestä aktiiviseen kokemukseen."
  ,"landing12.how.consolidate.title": "Vahvista"
  ,"landing12.how.consolidate.desc": "Kertaa näytön mukaan hauraat asiat."
  ,"landing12.how.continue.title": "Jatka"
  ,"landing12.how.continue.desc": "Seuraa yhtä perusteltavaa seuraavaa toimintoa."
  ,"landing12.nba.kicker": "Paras seuraava toiminto"
  ,"landing12.nba.title": "Tiedä, mikä tarvitsee huomiota nyt"
  ,"landing12.nba.lead": "Suositukset yhdistävät todellisen kontekstin ja perustelevat hyötynsä. Ne ovat ehdotuksia, eivät näkymättömiä käskyjä."
  ,"landing12.nba.english": "Jatka englannin kurssiasi"
  ,"landing12.nba.review": "Kertaa 5 ajankohtaista käsitettä"
  ,"landing12.nba.workspace": "Jatka opinnäytetyösi hahmotelmaa"
  ,"landing12.nba.professor": "Jatka professori-istuntoasi"
  ,"landing12.nba.why": "Miksi tämä suositus? · Tavoite ja jatkettava istunto"
  ,"landing12.platform.web": "Verkko"
  ,"landing12.platform.android": "Android"
  ,"landing12.platform.ios": "iOS"
  ,"landing12.platform.windows": "Windows"
  ,"landing12.platform.macos": "macOS"
  ,"landing12.platform.status.available": "Saatavilla"
  ,"landing12.platform.status.prepared": "Sovellus on teknisesti valmis; julkista kauppalinkkiä ei vielä ole"
  ,"landing12.platform.status.coming-soon": "Tulossa pian; julkista latauslinkkiä ei vielä ole"
  ,"landing12.download.kicker": "Jatkuvuus eri alustoilla"
  ,"landing12.download.title": "Second Brain kaikkialla, missä opit"
  ,"landing12.download.lead": "Aloita verkkokokemuksella tänään. Mobiili- ja työpöytäjakelu näytetään rehellisesti saatavuuden edetessä."
  ,"landing12.download.continuity": "Istuntomalli antaa aloittaa yhdellä laitteella ja jatkaa toisella."
  ,"landing12.download.webAction": "Käytä verkossa"
  ,"landing12.download.sameSession": "Sama istunto"
  ,"landing12.download.synced": "Konteksti valmis jatkettavaksi"
  ,"landing12.privacy.kicker": "Tietosuoja ja hallinta"
  ,"landing12.privacy.title": "Tietosi pysyvät hallinnassasi"
  ,"landing12.privacy.lead": "Second Brain tarjoaa tilitason hallinnan muistille, asiakirjoille, siirrettävyydelle ja poistolle."
  ,"landing12.privacy.scope": "Nämä ovat tuoteasetuksia, eivät ylimääräinen oikeudellinen tai turvallisuuslupaus."
  ,"landing12.privacy.memory": "Hallitse tekoälymuistia"
  ,"landing12.privacy.export": "Vie tietosi"
  ,"landing12.privacy.documents": "Hallitse asiakirjojasi"
  ,"landing12.privacy.delete": "Pyydä tilin poistoa vahvistuksella"
  ,"landing12.pricing.kicker": "Ilmainen · Pro · Max"
  ,"landing12.pricing.title": "Kolme henkilökohtaista tarjousta ilman keksittyjä yksityiskohtia"
  ,"landing12.pricing.lead": "Lopulliset hinnat, kiintiöt ja edut päätetään julkisen beetan jälkeen. Landing näyttää vain nykyisen todellisen luettelon."
  ,"landing12.pricing.free.name": "Ilmainen"
  ,"landing12.pricing.free.desc": "Henkilökohtainen oletustarjous Second Brain -kokemukseen tutustumiseen."
  ,"landing12.pricing.pro.name": "Pro"
  ,"landing12.pricing.pro.desc": "Edistynyt henkilökohtainen tarjous, jonka lopullinen hinta, kiintiöt ja edut määritetään myöhemmin."
  ,"landing12.pricing.max.name": "Max"
  ,"landing12.pricing.max.desc": "Laajin henkilökohtainen tarjous; lopulliset kaupalliset tiedot määritetään myöhemmin."
  ,"landing12.pricing.freeStatus": "Ilmainen tarjous saatavilla"
  ,"landing12.pricing.pending": "Tiedot julkisen beetan jälkeen"
  ,"landing12.pricing.sourceNote": "Tunnistautuneet tilaussivut ovat edelleen taustajärjestelmän datan ohjaamia. Hintaa, alennusta, kiintiötä tai yksinoikeusetua ei ole kovakoodattu tähän."
  ,"landing12.faq.kicker": "Hyödyllisiä vastauksia"
  ,"landing12.faq.title": "Kysyttävää? Me vastaamme."
  ,"landing12.faq.lead": "Lyhyet vastaukset siitä, mitä tuote todella tekee nyt."
  ,"landing12.faq.q1": "Mikä Second Brain on?"
  ,"landing12.faq.a1": "Henkilökohtainen älykäs oppimisjärjestelmä, joka yhdistää kysymykset, lähteet, opetuksen, harjoittelun, muistin ja akateemisen työn yhteen kontekstiin."
  ,"landing12.faq.q2": "Onko se vain chatbot?"
  ,"landing12.faq.a2": "Ei. Keskustelu on yksi käyttöliittymä. Sama istunto voi muuttua oppitunniksi, suulliseksi harjoitukseksi, lähteistetyksi asiakirjakysymykseksi, kertaukseksi tai Työtilan toiminnoksi."
  ,"landing12.faq.q3": "Miten Omat aivoni toimii?"
  ,"landing12.faq.a3": "Se näyttää käsitteesi, yhteytesi, hallinnan näytön, muistisi ja oppimishistoriasi. Näkymä mukautuu saatavilla olevien tietojen kypsyyteen."
  ,"landing12.faq.q4": "Voinko käyttää omia asiakirjojani?"
  ,"landing12.faq.a4": "Kyllä. Kirjasto hyväksyy tuetut tiedostot ja skannaukset, näyttää todelliset käsittelytilat, poimii käsitteitä ja tukee lähteisiin perustuvia kysymyksiä ja muunnoksia."
  ,"landing12.faq.q5": "Voinko oppia kieltä?"
  ,"landing12.faq.a5": "Kyllä. Tosielämän kielimoottori yhdistää CEFR-opetussuunnitelman, selkeän kielityön, Maailman tehtävät, suullisen harjoittelun, kohdennetun korjauksen, kertauksen ja osaamisnäytön."
  ,"landing12.faq.q6": "Miten tekoälyprofessori toimii?"
  ,"landing12.faq.a6": "Se käyttää oppijan aktiivista kontekstia ja voi selittää, opettaa, kysyä, arvioida tai harjoituttaa säilyttäen Kokemusistunnon."
  ,"landing12.faq.q7": "Miten kertaukset toimivat?"
  ,"landing12.faq.a7": "Kertaus käyttää todellista historiaa ja jaksotettua toistoa unohtumisvaarassa olevan tiedon priorisointiin. Tekoälytön kertaus on käytettävissä tekoälykiintiöistä riippumatta."
  ,"landing12.faq.q8": "Mitkä kielet ovat saatavilla?"
  ,"landing12.faq.a8": "Jaettu rekisteri sisältää tällä hetkellä 34 opiskelukieltä. Käyttöliittymän kieli ja opiskeltava kieli valitaan aina erikseen."
  ,"landing12.faq.q9": "Hakeeko Tutkimus verkosta?"
  ,"landing12.faq.a9": "Tutkimus voi tällä hetkellä käyttää Omia aivojani ja Kirjastoasi. Ulkoista verkkopalvelua ei ole määritetty nykyiseen julkaisuun, joten Landing ei väitä muuta."
  ,"landing12.faq.q10": "Ovatko tietoni yksityisiä?"
  ,"landing12.faq.a10": "Tunnistautuneet asetukset kattavat tekoälymuistin, asiakirjat, suostumukset, viennin ja tilin poiston. Sivu ei lisää niiden ulkopuolisia oikeudellisia tai infrastruktuurilupauksia."
  ,"landing12.faq.q11": "Mitä eroa on Ilmaisella, Prolla ja Maxilla?"
  ,"landing12.faq.a11": "Ne ovat taustajärjestelmän luettelon kolme henkilökohtaista tilaustasoa. Lopulliset hinnat, kiintiöt ja edut määritetään julkisen beetan jälkeen."
  ,"landing12.faq.q12": "Missä Second Brain on käytettävissä?"
  ,"landing12.faq.a12": "Verkkokokemus on saatavilla tässä sovelluksessa. Android ja iOS ovat teknisesti valmiita ilman julkisia kauppalinkkejä; Windows- ja macOS-jakelu on tulossa myöhemmin."
  ,"landing12.contact.kicker": "Yhteydenotto ja tuki"
  ,"landing12.contact.title": "Kerro, mitä tarvitset"
  ,"landing12.contact.lead": "Julkinen yhteydenotto pysyy rehellisenä: sähköpostikanava avautuu vain, kun julkinen tukiosoite on määritetty."
  ,"landing12.contact.write": "Kirjoita tukeen"
  ,"landing12.contact.account": "Kirjaudu tilillesi"
  ,"landing12.contact.notConfigured": "Julkista tukiosoitetta ei ole vielä määritetty. Kirjaudu käyttämään tili- ja tietoasetuksia; viestiä ei simuloida."
  ,"landing12.contact.subject": "Second Brain -tukipyyntö"
  ,"landing12.contact.general": "Yleinen kysymys"
  ,"landing12.contact.general.desc": "Tutustu tuotteeseen tai sen saatavuuteen."
  ,"landing12.contact.technical": "Tekninen tuki"
  ,"landing12.contact.technical.desc": "Ilmoita sovelluksen käyttöongelmasta."
  ,"landing12.contact.billing": "Tilaus ja laskutus"
  ,"landing12.contact.billing.desc": "Kysymyksiä tarjouksesta, laskusta tai maksusta."
  ,"landing12.contact.privacy": "Tietosuoja ja tiedot"
  ,"landing12.contact.privacy.desc": "Kysymyksiä muistista, viennistä tai poistosta."
  ,"landing12.contact.problem": "Ilmoita ongelmasta"
  ,"landing12.contact.problem.desc": "Kuvaile toistettava tuoteongelma."
  ,"landing12.contact.feedback": "Ehdotus ja palaute"
  ,"landing12.contact.feedback.desc": "Jaa ajatus kokemuksen parantamiseksi."
  ,"report.title": "Ilmoita ongelmasta"
  ,"report.intro": "Kerro, mitä tapahtui. Ihmiset tarkistavat raporttisi; se ei ole järjestelmän ohje eikä käynnistä automaattista korjausta."
  ,"report.category": "Mihin ongelma vaikuttaa?"
  ,"report.category.app_not_working": "Sovellus ei toimi"
  ,"report.category.ai_teacher_problem": "Tekoälyopettaja"
  ,"report.category.document_pdf_problem": "Asiakirja tai PDF"
  ,"report.category.voice_problem": "Puhe"
  ,"report.category.language_learning_problem": "Kielenoppiminen"
  ,"report.category.revision_problem": "Kertaus"
  ,"report.category.brain_digital_twin_problem": "Omat aivoni tai digitaalinen kaksonen"
  ,"report.category.subscription_payment_problem": "Tilaus tai maksu"
  ,"report.category.account_login_problem": "Tili tai kirjautuminen"
  ,"report.category.other": "Muu"
  ,"report.description": "Kuvaile ongelma"
  ,"report.placeholder": "Mitä yritit tehdä ja mitä tapahtui sen sijaan?"
  ,"report.counter": "{count}/{max} merkkiä"
  ,"report.minimum": "Kirjoita vähintään {min} merkkiä."
  ,"report.privacyTitle": "Pidä raportti turvallisena"
  ,"report.privacyDetail": "Älä sisällytä salasanoja, pääsykoodeja, maksutietoja, yksityisiä asiakirjoja, keskustelusisältöä tai henkilötietoja. Arkaluonteisilta näyttävät arvot peitetään ennen lähettämistä."
  ,"report.consent": "Valtuutan rajatun lisädiagnostiikan tarvittaessa. Tämä on valinnaista; raportin voi lähettää ilman sitä."
  ,"report.contextTitle": "Rajattu diagnostiikkakonteksti"
  ,"report.contextDetail": "Sovellus lähettää vain raporttiluokan, rajatun kuvauksen, turvallisen reittinimen, sovellus-/koontiversion, alustan ja läpinäkymättömän pyyntötunnuksen. Se ei lähetä kuvakaappauksia, asiakirjoja, keskusteluja tai ääntä."
  ,"report.attachments": "Liitteet"
  ,"report.attachmentsDetail": "EI INSTRUMENTOITU — liitteet eivät tarkoituksella ole käytettävissä ongelmaraporteissa."
  ,"report.submit": "Lähetä raportti"
  ,"report.successTitle": "Raportti lähetetty"
  ,"report.successDetail": "Kiitos. Ihmisen tarkistus voi yhdistää sen turvalliseen telemetriaan; se ei vahvista syytä eikä tee automaattista muutosta."
  ,"report.error": "Raporttia ei voitu lähettää. Automaattista uutta yritystä ei tehty."
  ,"report.profileTitle": "Ohjeet ja ongelmaraportit"
  ,"report.profileDetail": "Ilmoita tuoteongelmasta liittämättä yksityistä oppimissisältöä."
  ,"report.open": "Ilmoita ongelmasta"
  ,"landing12.final.kicker": "Yksi tuote. Yksi kokemus."
  ,"landing12.final.title": "Rakenna kanssasi oppiva järjestelmä"
  ,"landing12.final.lead": "Aloita yhdestä aikomuksesta. Säilytä konteksti. Jatka oikealla seuraavalla toiminnolla."
  ,"landing12.footer.tagline": "Henkilökohtainen älykäs oppimisjärjestelmäsi: ymmärrä, harjoittele, muista ja tuota yhdessä jatkuvassa kontekstissa."
  ,"landing12.footer.beta": "Julkinen beeta · ominaisuudet ja kaupallinen määritys kehittyvät edelleen."
  ,"landing12.footer.product": "Tuote"
  ,"landing12.footer.resources": "Resurssit"
  ,"landing12.footer.features": "Ominaisuudet"
  ,"landing12.footer.brain": "Omat aivoni"
  ,"landing12.footer.languages": "Kielet"
  ,"landing12.footer.pricing": "Hinnat"
  ,"landing12.footer.download": "Lataa"
  ,"landing12.footer.how": "Miten se toimii"
  ,"landing12.footer.faq": "Usein kysyttyä"
  ,"landing12.footer.contact": "Yhteystiedot"
  ,"landing12.footer.account": "Tili"
  ,"landing12.footer.privacy": "Tietosuoja- ja tietoasetukset"
  ,"landing12.footer.copy": "© 2026 Second Brain. Kaikki tuote-esittelyt ovat julkisia esimerkkejä."
  ,"landing12.footer.noTracking": "Ei kuvitteellista kumppania, suositusta tai mittaria."
  ,"capture.permission.pending": "Valmistellaan kameraa…"
  ,"capture.permission.title": "Kameran käyttöoikeus tarvitaan"
  ,"capture.permission.detail": "Second Brain avaa kameran vasta toimintosi jälkeen. Voit silti tuoda olemassa olevan kuvan."
  ,"capture.permission.allow": "Salli kamera"
  ,"capture.importFallback": "Tuo kuva"
  ,"capture.error.capture": "Valokuvaa ei voitu ottaa."
  ,"capture.error.fallback": "Sulje toinen kameraa käyttävä sovellus, tarkista käyttöoikeus tai tuo kuva."
  ,"capture.error.unavailable": "Käytettävissä olevaa kameraa ei löytynyt."
  ,"capture.error.paused": "Kamera on keskeytetty."
  ,"capture.error.denied": "Kameran käyttöoikeus evättiin."
  ,"capture.error.secureContext": "Kamera vaatii suojatun HTTPS-yhteyden."
  ,"capture.error.busy": "Kamera ei ole käytettävissä tai se on jo käytössä."
  ,"capture.retake": "Ota uudelleen"
  ,"capture.confirm": "Käytä tätä kuvaa"
  ,"capture.take": "Ota kuva"
  ,"capture.switch": "Vaihda kameraa"
  ,"capture.preview": "Kameran suora esikatselu"
  ,"capture.cameraChoice": "Valitse kamera"
  ,"capture.camera": "Kamera"
  ,"qr.title": "Lue QR-koodi"
  ,"qr.detail": "Tähtää QR-koodiin. Sen sisältö pysyy passiivisena, kunnes tarkistat sen."
  ,"qr.aim": "Pidä QR-koodi kehyksen sisällä."
  ,"qr.unsupported": "QR-luku ei ole käytettävissä tässä selaimessa"
  ,"qr.unsupportedDetail": "Käytä yhteensopivaa HTTPS-selainta tai toista laitetta. Sisältöä ei ole avattu."
  ,"qr.detected": "QR-kohde havaittu"
  ,"qr.confirmDetail": "Tarkista koko kohde ennen avaamista."
  ,"qr.open": "Avaa tämä kohde"
  ,"qr.openError": "Kohdetta ei voitu avata. Sitä ei suoritettu eikä tuotu."
  ,"qr.noneFound": "QR-koodia ei löytynyt. Rajaa uudelleen ja yritä."
  ,"qr.scanAgain": "Skannaa toinen QR-koodi"
  ,"qr.textDetected": "QR-teksti havaittu"
  ,"qr.textInert": "Teksti vain näytetään. Sitä ei suoriteta eikä lähetetä tekoälyopettajalle."
  ,"qr.done": "Valmis"
  ,"qr.blocked": "Turvaton QR-kohde estetty"
  ,"qr.blockedDetail": "Vain nimenomaiset HTTP- ja HTTPS-linkit voidaan avata. Mukautetut, tiedosto-, data- ja komentosarjamallit torjutaan."
  ,"scan.importError": "Valittuja kuvia ei voitu tuoda."
  ,"scan.editError": "Tätä sivua ei voitu muokata. Muut sivut säilytettiin."
  ,"scan.uploadError": "Skannausta ei voitu tallentaa."
  ,"scan.inProgress": "Skannausta käsitellään yhä. Yritä pian uudelleen."
  ,"scan.retryNewAttempt": "Edellinen yritys päättyi turvallisesti. Aloita uusi skannausyritys painamalla tallenna uudelleen."
  ,"scan.returnToLearn": "Palaa Oppimiseen tämän asiakirjan kanssa"
  ,"scan.captureFirst": "Tarkista ennen tallennusta"
  ,"scan.captureFirstDetail": "Kaappaa tai tuo sivut, säädä niiden järjestystä, rajausta ja kiertoa ja vahvista. Mitään ei lähetetä ennen viimeistä toimintoa."
  ,"scan.retryPreserved": "Sivusi pysyvät täällä, joten voit yrittää uudelleen kaappaamatta niitä uudestaan."
  ,"scan.pagePosition": "Sivu {current}/{total}"
  ,"scan.moveBefore": "Siirrä vasemmalle"
  ,"scan.moveAfter": "Siirrä oikealle"
  ,"scan.rotate": "Kierrä"
  ,"scan.crop": "Säädä rajausta"
  ,"scan.perspectiveLimit": "Vedä neljä kulmaa sivun reunoille. Perspektiivi ja luettavuus korjataan tallennettaessa."
  ,"learn5.capture.photo": "Valokuva"
  ,"learn5.capture.document": "Skannaa asiakirja"
  ,"learn5.capture.qr": "Lue QR-koodi"
  ,"profile.card.webcam": "Käytä verkkokameraa"
  ,"profile.card.importImage": "Tuo kuva"
  ,"profile.email.verified": "Sähköposti vahvistettu"
  ,"profile.email.unverified": "Sähköpostia ei ole vahvistettu"
  ,"profile.edit": "Muokkaa profiiliani"
  ,"profile.avatar.loadError": "Tallennettua profiilikuvaa ei voitu ladata."
  ,"profile.avatar.saveError": "Uutta profiilikuvaa ei voitu tallentaa."
  ,"profile.avatar.removeError": "Profiilikuvaa ei voitu poistaa."
  ,"profile.avatar.denied": "Kuvien käyttöoikeus evättiin."
  ,"profile.avatar.error": "Kuvan valitsinta ei voitu avata."
  ,"profile.avatar.preserved": "Aiempi tallennettu kuva säilytettiin. Voit yrittää turvallisesti uudelleen."
  ,"profile.avatar.editorTitle": "Säädä profiilikuvaa"
  ,"profile.avatar.editorDetail": "Esikatsele pyöreä tulos. Kierto ja zoomaus otetaan käyttöön vasta vahvistuksen jälkeen."
  ,"profile.avatar.rotate": "Kierrä"
  ,"profile.avatar.zoomOut": "Loitonna"
  ,"profile.avatar.zoomIn": "Lähennä"
  ,"profile.avatar.confirm": "Tallenna tämä kuva"
};

registerLocale('fi', "Suomi", fi);
