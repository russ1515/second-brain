import { registerLocale } from '../i18n';

/** Ukrainian UI locale — machine-generated (Step 2), review recommended.
 *  Regenerate/extend with: node scripts/translate-locale.mjs uk */
const uk: Record<string, string> = {
  "app.today": "Сьогодні",
  "app.signOut": "Вийти",
  "app.back": "Повернутися до сьогодні",
  "app.tryAgain": "Спробувати знову",
  "app.language": "Мова додатку",
  "error.title": "Щось пішло не так",
  "error.detail": "У цьому вікні сталася помилка. Ви можете спробувати знову.",
  "auth.title": "Ваш клас",
  "auth.subtitle": "Приватний викладач, який пам'ятає кожен урок, помилку та успіх.",
  "auth.name": "Ім'я (необов'язково)",
  "auth.email": "Ел. пошта",
  "auth.password": "Пароль",
  "auth.start": "Почати навчання",
  "auth.signIn": "Увійти",
  "auth.haveAccount": "У мене вже є акаунт",
  "auth.createAccount": "Створити акаунт",
  "auth.headline": "Активувати цифрового двійника",
  "auth.emailPh": "you@example.com",
  "auth.namePh": "Ваше ім'я",
  "auth.createBtn": "Створити мій акаунт",
  "auth.forgot": "Забули пароль?",
  "auth.noAccount": "Ще немає акаунта?",
  "auth.otpTitle": "Підтвердьте свою ел. пошту",
  "auth.otpSubtitle": "Введіть 6-значний код, надісланий на {email}.",
  "auth.verify": "Підтвердити",
  "auth.notReceived": "Не отримали?",
  "auth.resend": "Надіслати код повторно",
  "auth.resendIn": "Надіслати повторно через {n}с",
  "auth.skip": "Пропустити цей крок",
  "auth.expired": "Термін дії коду минув — запитайте новий.",
  "auth.otpError": "Невірний код. Спробуйте знову.",
  "auth.forgotTitle": "Відновлення пароля",
  "auth.forgotSubtitle": "Введіть свою ел. пошту, і ми надішлемо код для скидання.",
  "auth.sendCode": "Надіслати код",
  "auth.back": "Назад",
  "auth.resetTitle": "Скинути пароль",
  "auth.resetSubtitle": "Введіть код і новий пароль.",
  "auth.newPassword": "Новий пароль",
  "auth.reset": "Скинути",
  "auth.resetSent": "Якщо для {email} існує акаунт, код скидання надіслано.",
  "auth.resetOk": "Пароль скинуто — будь ласка, увійдіть.",
  "auth.codeSent": "Код надіслано на {email}.",
  "auth.newCodeSent": "Новий код надіслано.",
  "auth.2faTitle": "Двохетапна перевірка",
  "auth.2faSubtitle": "Введіть код із програми автентифікації.",
  "auth.useRecovery": "Використати код відновлення",
  "auth.recoveryPh": "Код відновлення",
  "classroom.opening": "Відкриваємо ваш клас…",
  "classroom.streak": "днів поспіль",
  "classroom.milestone": "Нове досягнення",
  "classroom.emptyTitle": "Поки що нічого не заплановано",
  "classroom.emptyDetail": "Ваш день будується на реальній роботі. Відскануйте сторінку курсу або почніть обговорення, і клас складе план навколо цього.",
  "classroom.replan": "Перепланувати сьогодні",
  "classroom.offlineTitle": "Не вдається підключитися до класу",
  "classroom.offlineDetail": "Ви досі увійшли в систему, але сервер не відповідає. Перевірте, чи працює API, і спробуйте знову.",
  "classroom.start": "Почати",
  "classroom.done": "Готово",
  "classroom.skip": "Пропустити",
  "classroom.isDone": "✓ Готово",
  "classroom.isSkipped": "Пропущено",
  "slot.morning": "Ранок · огляд вчорашнього",
  "slot.afternoon": "День · сьогоднішній урок",
  "slot.evening": "Вечір · практика",
  "slot.night": "Перед сном · швидке повторення",
  "nav.teacher": "Запитати вчителя",
  "nav.scan": "📷 Сканувати курс",
  "nav.languages": "Мови",
  "nav.revision": "Черга повторення",
  "nav.progress": "Прогрес",
  "tab.home": "Головна",
  "tab.learn": "Навчання",
  "tab.brain": "Мій Brain",
  "tab.study": "Повторення",
  "tab.profile": "Профіль",
  "learn.title": "Навчання",
  "learn.intro": "Місце, де ви засвоюєте нові знання.",
  "learn.teacher.title": "Запитати вчителя",
  "learn.teacher.detail": "Обговорюйте будь-що — відповіді на основі ваших нотаток, голосом або текстом.",
  "learn.languages.title": "Мови",
  "learn.languages.detail": "Словниковий запас, розмова та вимова мови, яку вивчаєте.",
  "learn.scan.title": "Сканувати курс",
  "learn.scan.detail": "Сфотографуйте сторінку чи свої нотатки та збережіть їх у пам'яті.",
  "brain.title": "Мій Brain",
  "brain.intro": "Усе, що ви вивчили, і те, наскільки добре ви це знаєте.",
  "brain.progress.title": "Прогрес і майстерність",
  "brain.progress.detail": "Ваша серія днів, утримання пам'яті, засвоєні поняття та віхи.",
  "study.title": "Повторення",
  "study.intro": "Практикуйте в потрібний момент за розкладом інтервального повторення.",
  "study.revision.title": "Черга повторення",
  "study.revision.detail": "Повторіть картки, які потрібно здати саме зараз.",
  "profile.title": "Профіль",
  "profile.account": "Обліковий запис",
  "profile.health.title": "Працездатність системи",
  "profile.health.detail": "Перевірте, чи працюють сервіси вашого класу.",
  "home.greeting": "Привіт",
  "home.objective": "Сьогоднішня мета",
  "home.objectiveNone": "Поки що нічого не заплановано — скануйте курс або почніть обговорення.",
  "home.teacher": "Ваш AI-вчитель",
  "home.continue": "Продовжити останній урок",
  "home.continueNone": "Уроків поки немає — ваш перший з'явиться тут.",
  "home.priority": "Пріоритетне повторення",
  "home.cardsDue": "карток до повторення",
  "home.reviewNow": "Повторити зараз",
  "home.nothingDue": "Зараз нічого повторювати — ви в актуальному стані.",
  "home.plan": "План на сьогодні",
  "home.progress": "Прогрес",
  "home.retention": "утримання пам'яті",
  "home.mastered": "засвоєно",
  "home.recommendations": "Рекомендації AI",
  "home.recommendWork": "Працювати над",
  "home.recommendNone": "Додайте поняття чи документи, і тут з'являться рекомендації.",
  "home.open": "Відкрити",
  "teacher.streak": "Чудова регулярність — підтримуйте свою серію днів!",
  "teacher.due": "У вас є очікувані повторення. Почніть із них.",
  "teacher.first": "Готові до першого уроку? Скануйте курс або запитуйте мене про що завгодно.",
  "teacher.default": "Готові вивчити щось нове сьогодні?",
  "soon.badge": "Незабаром",
  "soon.detail": "Дані з'являться після достатньої кількості навчальних сесій.",
  "learn.library": "Бібліотека",
  "learn.ocr": "OCR-сканер",
  "learn.documents": "Документи",
  "learn.exercises": "Вправи",
  "learn.assessments": "Оцінювання",
  "learn.assessments.detail": "Викладач як екзаменатор: тести, есе, кейси, пробні іспити — з оцінками, поясненнями та порадами.",
  "learn.writing.title": "Тренер з письма",
  "learn.writing.detail": "Надішліть есе, звіт чи дисертацію — перевірка структури, логіки, ясності, граматики та аргументації.",
  "learn.reading.title": "Тренер з читання",
  "learn.reading.detail": "Уривки з адаптованим рівнем та питаннями на розуміння — складність змінюється в міру вашого прогресу.",
  "study.planning": "Планування",
  "study.fsrs": "FSRS",
  "study.fsrs.detail": "Повторюйте будь-що за допомогою FSRS",
  "study.goals": "Цілі",
  "study.exams": "Іспити",
  "study.notifications": "Сповіщення",
  "brain.twin": "Цифровий двійник",
  "brain.twin.detail": "Ваш навчальний профіль",
  "brain.memory": "Пам'ять навчання",
  "brain.memory.detail": "Усе, що штучний інтелект пам'ятає про вас",
  "brain.mastery": "Володіння концептами",
  "brain.mastery.detail": "Оцінка для кожного концепту",
  "brain.graph": "Граф знань",
  "brain.graph.detail": "Як пов'язані ваші концепти",
  "brain.dna": "Навчальна ДНК",
  "brain.score": "Оцінка навчання",
  "brain.strengths": "Сильні сторони",
  "brain.strengths.detail": "У чому ви сильні",
  "brain.weaknesses": "Слабкі сторони",
  "brain.weaknesses.detail": "Що випадає з поля зору",
  "brain.insights": "Інсайти ШІ",
  "brain.insights.detail": "Чому ШІ пропонує саме це",
  "brain.recommend": "Рекомендації",
  "brain.recommend.detail": "Що робити далі",
  "brain.dash.tagline": "Розум, що навчається — усе, що Second Brain знає про вас, у реальному часі.",
  "brain.dash.memories": "спогади",
  "brain.dash.concepts": "концепти",
  "brain.dash.links": "зв'язки",
  "brain.dash.none": "Ще нічого немає",
  "revEng.title": "Рушій повторення",
  "revEng.intro": "Одна черга FSRS для всього — уроків, вправ, квизів, домашніх завдань, мов.",
  "revEng.loading": "Формування черги повторення…",
  "revEng.empty": "Поки що нічого повторювати — попрацюйте з чимось, і це з'явиться в розкладі.",
  "revEng.next": "наступний",
  "revEng.now": "зараз",
  "revEng.tomorrow": "завтра",
  "revEng.days": "днів",
  "revEng.again": "Знову",
  "revEng.hard": "Складно",
  "revEng.good": "Добре",
  "revEng.easy": "Легко",
  "plan.title": "Планувальник навчання",
  "plan.tileDetail": "Ваш день, зібраний штучним інтелектом",
  "plan.intro": "Диригент. Він нічого не створює сам — він збирає ваш день з інших рушіїв.",
  "plan.loading": "Збираємо ваш день…",
  "plan.assembled": "Зібрано з",
  "plan.live": "Живий план — він змінюється протягом дня.",
  "plan.replan": "🔄 Перепланувати з цього моменту",
  "plan.items": "елементів",
  "plan.k.revision": "Повторення",
  "plan.k.lesson": "Урок",
  "plan.k.discussion": "Обговорення",
  "plan.k.practical": "Практика",
  "plan.k.quiz": "Тест",
  "plan.k.summary": "Підсумок",
  "plan.k.break": "Перерва",
  "plan.k.end": "Кінець",
  "daily.title": "Щоденне заняття",
  "daily.start": "🎓 Почати сьогоднішнє заняття",
  "daily.loading": "Налаштування вашого класу…",
  "daily.noRevision": "Зараз нічого повторювати — переходьте до навчання.",
  "daily.revisionIntro": "Спершу повторимо те, що потрібно здати:",
  "daily.discussionIntro": "Запитайте вчителя про будь-що з цієї теми — просто тут.",
  "daily.ask": "💬 Запитати вчителя",
  "daily.askMore": "💬 Запитати знову",
  "daily.askPrompt": "Чи можете ви пояснити головну ідею цієї теми простими словами?",
  "daily.askError": "Учитель зараз недоступний — спробуйте пізніше.",
  "daily.checkIntro": "Відповідайте своїми словами — я перевірю ваше розуміння й допоможу за потреби.",
  "daily.check.placeholder": "Ваша відповідь…",
  "daily.check.btn": "Перевірити моє розуміння",
  "daily.check.again": "Перевірити знову",
  "daily.check.understood": "Зрозуміло!",
  "daily.check.partial": "Майже — давайте допрацюємо",
  "daily.check.confused": "Давайте пройдемо це ще раз",
  "daily.check.reexplain": "Ось інший погляд на це",
  "daily.planningIntro": "Ось що я запланував для вас далі:",
  "daily.p.welcome": "Вітаємо",
  "daily.p.objectives": "Цілі",
  "daily.p.revision": "Повторення",
  "daily.p.lesson": "Урок",
  "daily.p.questions": "Запитання",
  "daily.p.discussion": "Обговорення",
  "daily.p.exercises": "Вправи",
  "daily.p.homework": "Практика / Домашнє завдання",
  "daily.p.correction": "Виправлення",
  "daily.p.quiz": "Тест",
  "daily.p.summary": "Підсумок",
  "daily.p.flashcards": "Картки",
  "daily.p.brain": "Оновлення мозку",
  "daily.p.planning": "Автопланування",
  "cal.title": "Розумний календар",
  "cal.tileDetail": "Іспити, повторення тощо — автогенерація",
  "cal.intro": "Автоматично створено на основі всього, що запланував штучний інтелект. Додайте власні іспити та цілі; ШІ підтримує пріоритети.",
  "cal.loading": "Створення вашого календаря…",
  "cal.add": "Додати своє",
  "cal.titlePlaceholder": "напр., іспит з математики",
  "cal.addBtn": "➕ Додати до календаря",
  "cal.todayTag": "Сьогодні",
  "cal.nothing": "Нічого не заплановано",
  "cal.today": "Сьогодні",
  "cal.tomorrow": "Завтра",
  "cal.in3": "Через 3 дні",
  "cal.in7": "За тиждень",
  "cal.k.exam": "Іспит",
  "cal.k.homework": "Домашнє завдання",
  "cal.k.practical": "Практика",
  "cal.k.language": "Мова",
  "cal.k.aiSession": "Сесія ШІ",
  "cal.k.revision": "Повторення",
  "cal.k.quiz": "Тест",
  "cal.k.objective": "Мета",
  "cal.k.deadline": "Дедлайн",
  "pred.title": "Предиктивне повторення",
  "pred.tileDetail": "Прогнозуйте забування до того, як воно станеться",
  "pred.intro": "Рівень вище за FSRS. FSRS каже, що потрібно повторити зараз; це прогнозує, що ви забудете — щоб ШІ діяв наперед.",
  "pred.loading": "Прогнозування ваших кривих забування…",
  "pred.fsrs": "FSRS: «Потрібно повторити сьогодні».",
  "pred.predictive": "Предиктивне: «Через кілька днів ваше забування перетне поріг».",
  "pred.empty": "Усе стабільно — ніщо не ризикує бути забутим найближчим часом.",
  "pred.in": "Через",
  "pred.forgettingPass": "ваше забування перетне",
  "pred.now": "зараз",
  "pred.today": "сьогодні",
  "pred.oneDay": "1 день",
  "pred.days": "днів",
  "pred.reviewAhead": "🔁 Повторіть зараз, щоб випереджати події",
  "notif.title": "Розумні сповіщення",
  "notif.tileDetail": "Педагогічно, завжди обґрунтовано",
  "notif.loading": "Підготовка ваших сповіщень…",
  "notif.hello": "Привіт",
  "notif.helloNoName": "Привіт.",
  "notif.empty": "Зараз немає нічого важливого — ви на правильному шляху.",
  "notif.review": "Коротке {m}-хвилинне повторення {s} сьогодні підвищило б ваше засвоєння на {p}%.",
  "notif.exam": "Ваш іспит “{s}” через {d} днів. Я автоматично переорганізував ваш план.",
  "notif.unlock": "Чудова робота. Тепер ми можемо почати {next}.",
  "notif.forecast": "Через {d} днів ваше згадування {s} впаде, а забування перевищить {p}%. Швидке повторення зараз запобігає цьому.",
  "notif.src.mastery": "На основі вашого поточного засвоєння",
  "notif.src.calendar": "З вашого календаря",
  "notif.src.path": "З вашого навчального шляху",
  "notif.src.forecast": "З предиктивного повторення",
  "notif.cta.review": "🔁 Почати повторення",
  "notif.cta.exam": "📅 Переглянути мій план",
  "notif.cta.unlock": "🎓 Почати зараз",
  "notif.cta.forecast": "🔮 Повторити наперед",
  "apath.title": "Адаптивний шлях",
  "apath.tileDetail": "ШІ визначає порядок вашого навчання",
  "apath.intro": "Скажіть мені, що ви хочете вивчити. Я перевірю граф знань і ваше засвоєння, а потім визначу правильний порядок.",
  "apath.loading": "Завантаження ваших понять…",
  "apath.thinking": "Визначення найкращого порядку…",
  "apath.pickGoal": "Я хочу вивчити…",
  "apath.noConcepts": "Понять ще немає — спершу щось вивчіть, а потім установіть ціль.",
  "apath.verdictConsolidate": "Перш ніж почати {target}, давайте закріпимо {list}. Ви набагато краще зрозумієте те, що буде далі.",
  "apath.verdictReady": "Усе готово — ви можете почати {target} одразу!",
  "apath.and": "і",
  "apath.a.ready": "Засвоєно",
  "apath.a.consolidate": "Для закріплення",
  "apath.a.target": "Ціль",
  "profile.preferences": "Налаштування",
  "profile.languages": "Мови",
  "profile.subscription": "Підписка",
  "profile.aiSettings": "Налаштування ШІ",
  "profile.notifications": "Сповіщення",
  "aiteacher.continue": "Сьогодні ми продовжимо",
  "aiteacher.work": "Сьогодні ми працюватимемо над",
  "aiteacher.reviewFirst": "Але спершу давайте швидко повторимо",
  "aiteacher.startLesson": "Почати урок",
  "aiteacher.empty": "Я ваш викладач. Скажіть мені, що хочете вивчити, або скануйте курс, щоб почати.",
  "aiteacher.ready": "Щойно будете готові.",
  "aiteacher.talkTitle": "Поговоріть зі своїм викладачем",
  "aiteacher.topicPlaceholder": "Про що ви хочете поговорити?",
  "aiteacher.talk": "Почати розмову",
  "aiteacher.resume": "💬 Продовжити нашу розмову",
  "aiteacher.twinPick": "Дозвольте вчителю вибрати ваше слабке місце",
  "aiteacher.recent": "Останні обговорення",
  "aiteacher.messages": "повідомлення",
  "aiteacher.focusedOn": "зосереджено на",
  "aiteacher.untitled": "Без назви",
  "aiteacher.open": "Відкрити",
  "aiteacher.finishedLesson": "Вчора ми завершили урок на тему",
  "aiteacher.todayReview": "Сьогодні я пропоную повторити",
  "aiteacher.difficulties": "оскільки я помітив(-ла) деякі труднощі.",
  "aiteacher.todayDiscover": "Сьогодні ми почнемо з",
  "aiteacher.thenNext": "Потім ми перейдемо до",
  "aiteacher.sessionCard": "Сьогоднішнє заняття",
  "aiteacher.objective": "Мета",
  "aiteacher.duration": "Орієнтовний час",
  "aiteacher.levelLabel": "Рівень",
  "aiteacher.minutes": "хв",
  "aiteacher.objReview": "Повторити та закріпити",
  "aiteacher.objDiscover": "Зрозуміти",
  "aiteacher.readyQ": "Готові?",
  "aiteacher.start": "▶  Почати",
  "level.beginner": "Початковий",
  "level.intermediate": "Середній",
  "level.advanced": "Просунутий",
  "lesson.opening": "Відкриваємо ваш урок…",
  "lesson.pitchedAt": "рівень, підібраний спеціально для вас",
  "lesson.objectives": "Цілі",
  "lesson.introduction": "Вступ",
  "lesson.concept": "Концепція",
  "lesson.explanation": "Пояснення",
  "lesson.objectiveLabel": "Мета",
  "lesson.example": "Приклад",
  "lesson.keyPoints": "Головні висновки",
  "lesson.examples": "Приклади",
  "lesson.questions": "Запитання",
  "lesson.exercises": "Вправи",
  "lesson.correction": "Виправлення",
  "lesson.summary": "Підсумок",
  "lesson.flashcards": "Картки",
  "lesson.revision": "Повторення",
  "lesson.homework": "Домашнє завдання",
  "lesson.reflect": "Поміркуйте над цим, перш ніж рухатися далі.",
  "lesson.readAloud": "Прочитайте це мені",
  "lesson.yourAnswer": "Ваша відповідь",
  "lesson.submit": "Надіслати відповідь",
  "lesson.answerAgain": "Відповісти знову",
  "lesson.correct": "✓ Правильно",
  "lesson.notQuite": "✗ Не зовсім",
  "lesson.feedback": "Відгук",
  "lesson.rootCause": "Першопричина",
  "lesson.showCorrections": "Показати зразки відповідей",
  "lesson.hideCorrections": "Сховати зразки відповідей",
  "lesson.reveal": "Натисніть, щоб показати",
  "lesson.noFlashcards": "Для цього уроку немає карток.",
  "lesson.cardsScheduled": "картки заплановані у вашій черзі повторень.",
  "lesson.reviewNow": "Повторити зараз",
  "lesson.savePdf": "📄 Зберегти як PDF",
  "lesson.doHomework": "📝 Зробити домашнє завдання",
  "lesson.step": "Крок",
  "lesson.of": "з",
  "lesson.continue": "Продовжити",
  "lesson.previous": "Назад",
  "lesson.finish": "Завершити урок",
  "lesson.finishSession": "Завершити сесію",
  "lesson.why": "Чому?",
  "lesson.how": "Як?",
  "lesson.errorMade": "Яка помилка?",
  "lesson.howToAvoid": "Як цього уникнути?",
  "exercise.qcm": "Множинний вибір",
  "exercise.open": "Відкрите питання",
  "exercise.exercise": "Вправа",
  "exercise.case": "Практичний кейс",
  "lesson.scheduleIn": "Я запланую цей перегляд на",
  "lesson.days": "днів",
  "lesson.day": "день",
  "lesson.scheduleWhy": "Чому? Тому що інтервальне повторення передбачає, коли ви забудете — і нагадує якраз перед цим.",
  "lesson.scheduleNow": "Ці картки готові. Повторіть їх, і я запланую наступну якраз у момент, коли ви почнете забувати.",
  "aiteacher.yesterday": "Вчора ми розглянули",
  "aiteacher.beforeContinuing": "Перш ніж продовжити, давайте повторимо ключові ідеї.",
  "lang.dialogue": "Діалог",
  "lang.dialogueHelp": "Коротка заготовлена розмова для вивчення.",
  "lang.scenarioPlaceholder": "Сценарій (необов'язково) — напр. на ринку",
  "lang.generateDialogue": "Створити діалог",
  "lang.essay": "Виправити мій текст",
  "lang.essayHelp": "Напишіть кілька речень, і я виправлю їх як учитель.",
  "lang.essayPlaceholder": "Напишіть свій текст тут…",
  "lang.correctEssay": "Виправити",
  "lang.assessment": "Оцінювання",
  "lang.correctedVersion": "Виправлена версія",
  "lang.noMistakes": "Жодних помилок — чудова робота!",
  "coach.title": "Ваш тренер",
  "coach.suggestToday": "Сьогодні я пропоную:",
  "coach.min": "хв",
  "coach.why": "Чому?",
  "mentor.why": "Чому я це пропоную",
  "mentor.act": "Зробімо це",
  "mentor.dismiss": "Не зараз",
  "coachp.title": "Мій академічний тренер",
  "coachp.tileDetail": "Темп, складність і метод — адаптовані під вас",
  "coachp.loading": "Аналізую ваші звички навчання…",
  "coachp.state": "Ваші поточні результати",
  "coachp.streak": "Серія днів",
  "coachp.discipline": "Дисципліна",
  "coachp.week": "Цього тижня",
  "coachp.mastery": "Майстерність",
  "coachp.goals": "Цілі",
  "coachp.pace": "Темп",
  "coachp.difficulty": "Складність",
  "coachp.method": "Метод",
  "coachp.session": "Тривалість сесії",
  "coachp.byCoach": "Тренер",
  "coachp.byYou": "Ваш вибір",
  "coachp.reset": "Повернути тренеру",
  "coachp.pace.gentle": "М'який",
  "coachp.pace.steady": "Стабільний",
  "coachp.pace.intensive": "Інтенсивний",
  "coachp.diff.beginner": "Початківець",
  "coachp.diff.intermediate": "Середній",
  "coachp.diff.advanced": "Просунутий",
  "coachp.method.practice": "Практика",
  "coachp.method.reading": "Читання",
  "coachp.method.socratic": "Сократівський",
  "coachp.method.mixed": "Змішаний",
  "coachp.disc.strong": "Сильний",
  "coachp.disc.building": "Формування",
  "coachp.disc.irregular": "Нерегулярний",
  "coach.forgetting": "Ви поступово забуваєте",
  "risk.title": "Передбачення",
  "risk.tileDetail": "Ризики попереду — до того, як вони стануть реальністю",
  "risk.loading": "Аналізуємо ситуацію наперед…",
  "risk.intro": "Я дивлюся наперед і вказую на ризики на вашому шляху, щоб ми діяли до того, як вони стануть проблемами.",
  "risk.calm": "Наразі немає нагальних ризиків — ви на правильному шляху.",
  "risk.cause": "Ймовірна причина",
  "risk.action": "Рекомендована дія",
  "risk.why": "Сигнали, що за цим стоять",
  "risk.kind.dropout": "Ризик припинення навчання",
  "risk.kind.difficulty": "Складнощі попереду",
  "risk.kind.overload": "Перевантаження",
  "risk.kind.motivation": "Спад мотивації",
  "risk.kind.forgetting": "Ймовірне забування",
  "risk.level.low": "Низький",
  "risk.level.moderate": "Помірний",
  "risk.level.high": "Високий",
  "reco.title": "Для вас",
  "reco.tileDetail": "Уроки, вправи, матеріали — підібрані спеціально для вас",
  "reco.loading": "Підбираємо найкраще для вас…",
  "reco.intro": "Персоналізовані рекомендації для кожної вашої наступної дії з поясненням.",
  "reco.empty": "Поки що немає пропозицій — повертайтеся після невеликої сесії навчання.",
  "reco.accept": "Зробім це",
  "reco.dismiss": "Не зараз",
  "reco.kind.lesson": "Новий урок",
  "reco.kind.exercise": "Вправи",
  "reco.kind.reading": "Читання",
  "reco.kind.review": "Повторення",
  "reco.kind.practical": "Практичний",
  "reco.kind.document": "Документ",
  "ment.title": "ШІ-наставник",
  "ment.tileDetail": "Чесна оцінка ваших справ",
  "ment.loading": "Погляд на ситуацію в цілому…",
  "ment.intro": "Крім сьогоднішнього уроку — чесний аналіз вашого успіху, підготовки до іспитів, організації, методу та впевненості.",
  "ment.focus": "Фокус",
  "ment.why": "На чому це базується",
  "ment.dim.success": "Академічний успіх",
  "ment.dim.exams": "Підготовка до іспитів",
  "ment.dim.organization": "Організація",
  "ment.dim.method": "Метод роботи",
  "ment.dim.confidence": "Впевненість",
  "ment.rating.good": "На правильному шляху",
  "ment.rating.building": "Формування",
  "ment.rating.concern": "Потребує доопрацювання",
  "succ.title": "Прогноз успіху",
  "succ.tileDetail": "Ваші шанси на кожному іспиті — і як їх підвищити",
  "succ.loading": "Оцінюємо вашу готовність до іспитів…",
  "succ.intro": "Для кожного іспиту: рівень підготовки, орієнтовні шанси та моя впевненість.",
  "succ.note": "Мета полягає не в тому, щоб передбачити майбутнє, а в тому, щоб допомогти вам краще підготуватися.",
  "succ.empty": "Немає майбутніх іспитів — додайте один, щоб побачити готовність.",
  "succ.preparation": "Підготовка",
  "succ.probability": "Шанси на успіх",
  "succ.confidence": "Впевненість моделі",
  "succ.advice": "Як підготуватися",
  "succ.why": "Фактори",
  "succ.in": "через",
  "succ.days": "днів",
  "succ.today": "сьогодні",
  "succ.band.low": "низький",
  "succ.band.medium": "середній",
  "succ.band.high": "високий",
  "ic.title": "Центр інтелекту",
  "ic.metricValue": "Сильні сторони, прогрес, наступні кроки",
  "ic.loading": "Об'єднуємо ваш інтелект...",
  "ic.intro": "Усе, що штучний інтелект дізнався про вас — сильні сторони, слабкі сторони, прогрес, звички, продуктивність та сфери для покращения. Завжди з поясненням причин.",
  "ic.cat.strengths": "Сильні сторони",
  "ic.cat.weaknesses": "Слабкі сторони",
  "ic.cat.progress": "Прогрес",
  "ic.cat.habits": "Звички",
  "ic.cat.performance": "Продуктивність",
  "ic.cat.improvement": "Сфери для покращення",
  "dna.title": "Навчальна ДНК",
  "dna.metricValue": "Як ви навчаєтеся найкраще",
  "dna.loading": "Аналізуємо вашу навчальну ДНК…",
  "dna.intro": "Ваш глибокий і стабільний навчальний профіль: як ви запам'ятовуєте, коли ваш пік продуктивності, які модальність та формати вам підходять. Він вдосконалюється в процесі навчання.",
  "dna.maturity": "ДНК складено",
  "dna.interactions": "проаналізовано взаємодій від",
  "dna.trait.memory": "Як ви запам'ятовуєте",
  "dna.trait.peakTime": "Час пік",
  "dna.trait.modality": "Навчальна модальність",
  "dna.trait.explanation": "Глибина пояснень",
  "dna.trait.retentionFormat": "Найкращий формат для запам'ятовування",
  "dna.band.emerging": "з'являється",
  "dna.band.forming": "формується",
  "dna.band.established": "встановлено",
  "sync.title": "Центр синхронізації",
  "sync.tileDetail": "Працюйте офлайн — зміни синхроняться, коли ви повернетесь",
  "sync.intro": "Продовжуйте працювати без підключення. Ваші зміни зберігаються та синхронізуються автоматично, коли ви знову з'явитеся в мережі.",
  "sync.online": "Онлайн",
  "sync.online.detail": "Підключено — зміни синхроняться миттєво.",
  "sync.offline": "Офлайн",
  "sync.offline.detail": "Немає підключення — зміни збережено і вони синхронізуються автоматично.",
  "sync.pending": "Очікувані зміни",
  "sync.last": "Остання синхронізація",
  "sync.never": "Ніколи",
  "sync.now": "Синхронізувати зараз",
  "sync.note": "Читання кешується, тому дані залишаються доступними офлайн; записи стають у чергу та відтворюються послідовно при відновленні з'єднання.",
  "mon.title": "Моніторинг",
  "mon.tileDetail": "Стан системи — трафік, затримка, ШІ, кеш",
  "mon.loading": "Зчитування стану системи…",
  "mon.intro": "Поточний стан платформи на основі внутрішніх метрик (також експортуються у Prometheus).",
  "mon.http": "HTTP-трафік",
  "mon.requests": "запитів",
  "mon.errorRate": "частота помилок",
  "mon.ai": "Виклики ШІ",
  "mon.aiCalls": "викликів",
  "mon.errors": "помилок",
  "mon.avgLatency": "сер. затримка",
  "mon.byModel": "За моделлю",
  "mon.cache": "Кеш",
  "mon.hitRate": "коефіцієнт влучень",
  "mon.hits": "влучень",
  "mon.misses": "промахів",
  "mon.process": "Процес",
  "mon.memory": "пам'ять",
  "mon.heap": "купа пам’яті",
  "mon.uptime": "безперебійна робота",
  "mon.note": "Помилки також надходять до точки інтеграції Sentry/OpenTelemetry (активно, якщо налаштовано DSN). Prometheus збирає GET /metrics.",
  "lm.title": "Мови",
  "lm.manage": "Керування мовами",
  "lm.intro": "Кожна мова інтерфейсу та рівень її повноти. Перемикання також змінює мову вчителя зі штучним інтелектом.",
  "lm.active": "Активно",
  "lm.translated": "перекладено",
  "lm.fallback": "решта використовує англійську як запасний варіант",
  "lm.note": "Нові мови додаються шляхом додавання файлу ресурсів — без зміни коду програми. Неперекладені ключі автоматично перемикаються на англійську.",
  "aim.title": "Провайдери ШІ",
  "aim.tileDetail": "Мультимодельний оркестратор — виберіть найкращий / найдешевший / найшвидший",
  "aim.loading": "Читання інфраструктури ШІ…",
  "aim.intro": "Доступні серверні частини ШІ та стратегія вибору між ними. Перемикання спрямовує всі запити до ШІ за новим маршрутом.",
  "aim.strategy": "Стратегія",
  "aim.active": "Активний провайдер",
  "aim.catalog": "Провайдери",
  "aim.ready": "Готово",
  "aim.off": "Вимкнено",
  "aim.cost": "вартість",
  "aim.speed": "швидкість",
  "aim.quality": "якість",
  "aim.vision": "зір",
  "aim.strat.quality": "Найкращий",
  "aim.strat.cost": "Найдешевший",
  "aim.strat.speed": "Найшвидший",
  "aim.strat.balanced": "Збалансований",
  "plg.title": "Розширення",
  "plg.tileDetail": "Простори, конектори та рушії ШІ — дорожня карта",
  "plg.loading": "Завантаження розширень…",
  "plg.intro": "Усе, чим може стати Second Brain — кожен є плагіном, який реєструється без зміни ядра.",
  "plg.active": "Активно",
  "plg.available": "Доступно",
  "plg.planned": "Заплановано",
  "plg.requires": "Вимагає",
  "plg.note": "Рушій плагінів дозволяє додавати нові Brains, конектори та рушії ШІ без глобального переписування — програма може розвиватися роками.",
  "coach.upToDate": "Усе актуально — зараз нічого не пропущено.",
  "coach.score": "Оцінка навчання",
  "coach.wouldRaise": "Цей повтор підвищив би вашу оцінку навчання на",
  "coach.points": "балів",
  "coach.newScore": "Ще недостатньо даних — почніть урок, щоб підвищити свою оцінку.",
  "briefing.hello": "Привіт",
  "briefing.analyzed": "Я проаналізував ваш прогрес.",
  "briefing.recommend": "Сьогодні я рекомендую:",
  "briefing.achievable": "Ви можете досягти своєї мети за {n} хвилин.",
  "briefing.start": "Почати сеанс",
  "briefing.min": "хв",
  "briefing.k.review": "Повторення",
  "briefing.k.lesson": "Новий урок",
  "briefing.k.vocabulary": "Словниковий запас",
  "briefing.upToDate": "Усе оновлено — на сьогодні нічого термінового. Коротке повторення все одно допоможе.",
  "homework.title": "Домашнє завдання",
  "homework.preparing": "Підготовка вашого персоналізованого домашнього завдання…",
  "homework.focusLabel": "Чому це домашнє завдання",
  "homework.masteryAt": "Адаптовано до вашого поточного рівня:",
  "homework.exercises": "Вправи",
  "homework.questions": "Запитання",
  "homework.correction": "Виправлення",
  "homework.reflect": "Подумайте над цим — без оцінок, лише рефлексія.",
  "homework.showAnswers": "Показати зразки відповідей",
  "homework.hideAnswers": "Приховати зразки відповідей",
  "homework.regenerate": "↻ Нове домашнє завдання",
  "homework.regenHint": "Згенерувати заново, адаптувавши до вашого останнього прогресу.",
  "homework.back": "Назад",
  "session.startGuided": "▶ Почати керовану сесію",
  "session.welcome": "Ваша сесія",
  "session.yourSession": "Сьогоднішня сесія",
  "session.defaultPlan": "Я крок за кроком проведу вас через усю сесію та оновлю ваш Цифровий двійник наприкінці.",
  "session.thePlan": "План",
  "session.start": "▶ Почати урок",
  "session.noLesson": "Для цієї сесії ще немає уроку.",
  "session.home": "На головну",
  "session.closing": "Завершення сесії та оновлення Цифрового двійника…",
  "session.done": "Сесію завершено",
  "session.whatWeDid": "Що ми зробили",
  "session.twinUpdate": "Оновлення Цифрового двійника",
  "session.before": "До",
  "session.after": "Після",
  "session.points": "од.",
  "session.conceptMastery": "Оволодіння цією концепцією:",
  "session.nowTracked": "Тепер ваш Цифровий двійник відстежує цю концепцію.",
  "session.results": "Результати",
  "session.exercisesRight": "правильних вправ",
  "session.cardsScheduled": "запланованих карток (FSRS)",
  "session.nextReview": "Наступне повторення:",
  "session.reviewNow": "🔁 Повторити зараз",
  "session.today": "сьогодні",
  "session.tomorrow": "завтра",
  "session.inDays": "днів",
  "session.stageLesson": "Урок",
  "session.stageQuestions": "Запитання",
  "session.stageExercises": "Вправи",
  "session.stageCorrection": "Виправлення",
  "session.stageSummary": "Підсумок",
  "session.stageFlashcards": "Картки",
  "session.stageFsrs": "Планування FSRS",
  "session.stageTwin": "Оновлення Цифрового двійника",
  "twin.title": "Цифровий двійник",
  "twin.intro": "Ваш навчальний профіль — він еволюціонує після кожної взаємодії.",
  "twin.loading": "Зчитування вашого Цифрового двійника…",
  "twin.notEnough": "Ще недостатньо даних",
  "twin.progress": "Загальний прогрес",
  "twin.conceptsTracked": "відстежуваних концепцій",
  "twin.lessons": "уроків",
  "twin.evolves": "Навчається безперервно",
  "twin.interactions": "взаємодій на цей момент",
  "twin.level": "Реальний рівень",
  "twin.speed": "Швидкість навчання",
  "twin.subjects": "Улюблені предмети",
  "twin.style": "Стиль навчання",
  "twin.depth": "Глибина пояснення",
  "twin.language": "Бажана мова",
  "twin.rhythm": "Ритм роботи",
  "twin.focus": "Години зосередженості",
  "twin.band.new": "Тільки починаю",
  "twin.band.weak": "Незрілий",
  "twin.band.building": "Формується",
  "twin.band.strong": "Міцний",
  "twin.speed.building": "Нарощування",
  "twin.speed.steady": "Стабільний",
  "twin.speed.fast": "Швидко",
  "twin.style.voice": "Розмовний",
  "twin.style.handsOn": "Практичний",
  "twin.style.reading": "Читання",
  "twin.depth.simple": "Просто, крок за кроком",
  "twin.depth.balanced": "Збалансований",
  "twin.depth.deep": "Поглиблений",
  "twin.rhythm.occasional": "Епізодично",
  "twin.rhythm.regular": "Регулярно",
  "twin.rhythm.intensive": "Інтенсивно",
  "twin.focus.morning": "Ранок",
  "twin.focus.afternoon": "День",
  "twin.focus.evening": "Вечір",
  "twin.focus.night": "Ніч",
  "memory.title": "Навчальна пам'ять",
  "memory.intro": "Усе, що ви зробили — щоб штучний інтелект ніколи не починав з нуля.",
  "memory.loading": "Відкриваємо вашу навчальну пам'ять…",
  "memory.remembered": "збережених спогадів",
  "memory.timeline": "Хронологія",
  "memory.empty": "Поки нічого не збережено — почніть урок, і він з'явиться тут.",
  "memory.exercises": "Вправи",
  "memory.successes": "Успіхи",
  "memory.errors": "Помилки",
  "memory.revisions": "Повторення",
  "memory.conversations": "Розмови",
  "memory.homework": "Домашнє завдання",
  "memory.reports": "Звіти",
  "memory.documents": "Документи",
  "memory.k.lesson": "Урок",
  "memory.k.success": "Успіх",
  "memory.k.error": "Помилка",
  "memory.k.revision": "Повторення",
  "memory.k.conversation": "Розмова",
  "memory.k.homework": "Домашнє завдання",
  "memory.k.report": "Звіт про сесію",
  "memory.k.document": "Документ",
  "mastery.title": "Рівень володіння концепціями",
  "mastery.intro": "Кожна концепція отримує бал — найважливіші для повторення першими.",
  "mastery.loading": "Оцінюємо ваші концепції…",
  "mastery.empty": "Концепцій поки немає — вивчіть урок, пов'язаний з концепцією, щоб побачити її оцінку.",
  "mastery.mastery": "Майстерність",
  "mastery.confidence": "Впевненість",
  "mastery.errors": "Помилки",
  "mastery.forgetting": "Забування",
  "mastery.priority": "Пріоритет повторення",
  "mastery.conf.low": "Низький",
  "mastery.conf.medium": "Середній",
  "mastery.conf.high": "Високий",
  "mastery.err.none": "Немає",
  "mastery.err.low": "Рідко",
  "mastery.err.high": "Часто",
  "mastery.prio.low": "Низький",
  "mastery.prio.medium": "Середній",
  "mastery.prio.high": "Високий",
  "mastery.prio.urgent": "Терміново",
  "graph.title": "Граф знань",
  "graph.intro": "Як ваші концепції залежать одна від одної — спочатку основи.",
  "graph.loading": "Створюємо карту концепцій…",
  "graph.empty": "Концепцій поки немає — вивчіть кілька, а потім зв'яжіть їх, щоб побачити граф.",
  "graph.s.mastered": "Освоєно",
  "graph.s.in_progress": "У процесі",
  "graph.s.ready": "Готово",
  "graph.s.at_risk": "Під загрозою",
  "graph.s.blocked": "Заблоковано",
  "sw.title": "Сильні та слабкі сторони",
  "sw.intro": "Ваші сильні сторони та те, що відстає — на основі цього штучний інтелект планує ваші наступні заняття.",
  "sw.loading": "Зважуємо ваші поняття…",
  "sw.strengths": "Сильні сторони",
  "sw.weaknesses": "Слабкі сторони",
  "sw.noStrengths": "Ще немає сильних понять — продовжуйте!",
  "sw.noWeaknesses": "Нічого не відстає. Чудова робота!",
  "sw.aiNote": "ШІ зосередить ваші наступні заняття на цих слабких місцях у першу чергу.",
  "sw.startWeakest": "▶ Працювати над моїми слабкими місцями",
  "rec.title": "Рекомендації",
  "rec.intro": "Наступні кроки від вашого ментора — не просто аналіз, а заклик до дії.",
  "rec.loading": "Думаємо над вашим наступним кроком…",
  "rec.empty": "Поки що немає рекомендацій — потроху навчайтеся, і я вас скерую.",
  "rec.review": "Рекомендую {m}-хвилинне повторення {s}.",
  "rec.consolidate": "Закріпіть {s}, перш ніж братися за щось нове.",
  "rec.levelUp": "Ви опанували {s} — час переходити на новий рівень.",
  "rec.advance": "Усе надійно — ви готові вивчати щось нове.",
  "rec.cta.review": "🔁 Повторити зараз",
  "rec.cta.consolidate": "🧱 Закріпити",
  "rec.cta.levelUp": "🎓 Вийти на новий рівень",
  "rec.cta.advance": "🚀 Вивчити щось нове",
  "insight.title": "Аналітика від ШІ",
  "insight.intro": "Чому ШІ пропонує саме це — на основі вашої реальної активності.",
  "insight.loading": "Читаємо сигнали…",
  "insight.empty": "Поки що замало активності — потроху навчайтеся, і з'явиться аналітика.",
  "insight.days": "днів",
  "insight.interactions": "взаємодій",
  "insight.strengthA": "Ви успішно просуваєтеся в",
  "insight.forgetA": "Ви схильні забувати",
  "insight.forgetB": "приблизно через",
  "insight.atRiskA": "Ви забуваєте",
  "insight.atRiskB": "— спочатку повторіть це.",
  "insight.focusA": "Ви найкраще засвоюєте матеріал між",
  "insight.focusB": "і",
  "insight.accA": "Ви відповідаєте правильно на",
  "insight.accB": "ваших вправ.",
  "insight.rhythmA": "Ви працюєте",
  "insight.styleA": "Ви найкраще навчаєтеся через",
  "insight.rhythm.occasional": "зрідка",
  "insight.rhythm.regular": "регулярно",
  "insight.rhythm.intensive": "інтенсивно",
  "insight.style.voice": "слухання",
  "insight.style.handsOn": "практику",
  "insight.style.reading": "читання",
  "tutor.discussion": "Обговорення",
  "tutor.opening": "Відкриваємо обговорення…",
  "tutor.focusedOn": "Зосереджено на",
  "tutor.placeholder": "Запитати свого вчителя…",
  "tutor.send": "Надіслати",
  "tutor.slower": "🐢 Повільніше",
  "tutor.faster": "🐇 Швидше",
  "tutor.slowerMsg": "Можете сповільнитись і пояснити це простіше?",
  "tutor.stopSend": "Зупинити та надіслати",
  "tutor.cancel": "Скасувати",
  "tutor.speak": "🎤 Говорити натомість",
  "tutor.voiceUnsupported": "Для голосу потрібен мікрофон — поки що недоступно в цій збірці платформи.",
  "tutor.recording": "Запис… говорите, а потім зупиніть.",
  "tutor.you": "Ви",
  "tutor.teacher": "Викладач",
  "tutor.spoken": "🎤 виголошено",
  "tutor.transcribing": "Розшифровка, відповідь і написання уроку, який залишиться після цього кроку…",
  "tutor.teacherSpeaking": "🔊 Викладач відповідає вголос…",
  "tutor.heard": "Почуто:",
  "tutor.filedA": "— письмовий урок",
  "tutor.filedInto": "було збережено у вашій пам'яті за допомогою",
  "tutor.flashcards": "карток",
  "tutor.groundedPre": "На основі",
  "tutor.groundedPassage": "уривок",
  "tutor.groundedPassages": "уривки",
  "tutor.groundedPost": "з ваших нотаток:",
  "header.lesson": "Урок",
  "header.newLesson": "Новий урок",
  "header.aiTeacher": "ШІ-викладач",
  "header.teacher": "Викладач",
  "header.homework": "Домашнє завдання",
  "header.session": "Навчальна сесія",
  "header.twin": "Цифровий двійник",
  "header.memory": "Пам'ять навчання",
  "header.mastery": "КонцептМастері",
  "header.graph": "Граф знань",
  "header.strengths": "Сильні та слабкі сторони",
  "header.insights": "ШІ-інсайти",
  "header.recommend": "Рекомендації",
  "header.revEngine": "Рушій повторення",
  "header.planner": "Планувальник навчання",
  "header.daily": "Щоденна сесія",
  "header.calendar": "Розумний календар",
  "header.predictions": "Предиктивне повторення",
  "header.notifications": "Розумні сповіщення",
  "header.adaptivePath": "Адаптивний шлях",
  "header.goals": "Цілі",
  "header.exams": "Майбутні іспити",
  "header.library": "Бібліотека",
  "header.document": "Документ",
  "header.ask": "Запитати мою бібліотеку",
  "header.resource": "Навчальний ресурс",
  "header.workspace": "Академічний робочий простір",
  "lib.title": "Бібліотека",
  "lib.tileDetail": "Ваша жива, організована за допомогою ШІ бібліотека",
  "lib.intro": "Кожен доданий документ розуміє ШІ: резюме, предмет, мова, поняття та складність — усе автоматично.",
  "lib.loading": "Відкриття вашої бібліотеки…",
  "lib.all": "Усі",
  "lib.favorites": "Обране",
  "lib.recent": "Недавні",
  "lib.shared": "Поширені",
  "lib.trash": "Кошик",
  "lib.subjects": "Предмети",
  "lib.languages": "Мови",
  "lib.collections": "Колекції",
  "lib.empty": "Тут ще немає документів.",
  "lib.sharedSoon": "Поширення з'явиться на наступному етапі — поки нічого не поширено.",
  "lib.analysing": "ШІ все ще аналізує цей документ…",
  "lib.pipelineRunning": "Автоматична обробка…",
  "lib.stage.cleaning": "Очищення",
  "lib.stage.segmenting": "Сегментація",
  "lib.stage.embedding": "Ембеддинги",
  "lib.stage.indexing": "Індексація",
  "lib.stage.graphing": "Граф знань",
  "lib.add": "＋ Додати",
  "lib.scan": "Сканувати",
  "lib.addText": "📝 Текст",
  "lib.addUrl": "🔗 URL",
  "lib.addTitle": "Назва",
  "lib.addBody": "Вставте свої нотатки / текст сюди…",
  "lib.addBtn": "Додати до бібліотеки",
  "lib.addFile": "📄 Імпортувати файл (PDF, txt, md)",
  "lib.addTextRequired": "Потрібні назва та текст.",
  "lib.addUrlRequired": "Потрібна URL-адреса.",
  "lib.diff.beginner": "Початківець",
  "lib.diff.intermediate": "Середній",
  "lib.diff.advanced": "Просунутий",
  "lib.status.pending": "У черзі",
  "lib.status.processing": "Аналіз",
  "lib.status.ready": "Готово",
  "lib.status.failed": "Помилка",
  "lib.summary": "ШІ-сума",
  "lib.concepts": "Виявлені концепти",
  "lib.noConcepts": "Концептів ще не виявлено — торкніться «Виявити концепти».",
  "lib.content": "Вміст",
  "lib.unknown": "Не виявлено",
  "lib.chars": "символів",
  "lib.m.subject": "Тема",
  "lib.m.language": "Мова",
  "lib.m.difficulty": "Складність",
  "lib.m.author": "Автор",
  "lib.m.collection": "Колекція",
  "lib.m.added": "Додано",
  "lib.m.size": "Розмір",
  "lib.reanalyse": "🤖 Переаналізувати",
  "lib.detectConcepts": "🧩 Виявити концепти",
  "lib.restore": "♻️ Відновити",
  "lib.moveToTrash": "🗑️ Перемістити в кошик",
  "lib.deleteForever": "Видалити назавжди",
  "lib.askLibrary": "Запитати",
  "lib.askThisDoc": "❓ Запитати про цей документ",
  "lib.ask.title": "Запитати мою бібліотеку",
  "lib.ask.intro": "Задайте запитання — відповіді формуються лише з ваших документів із зазначенням джерел. Жодної вигадки.",
  "lib.ask.scope": "Шукати в",
  "lib.ask.all": "Усій бібліотеці",
  "lib.ask.thisDoc": "Цьому документі",
  "lib.ask.placeholder": "напр., Які є етапи фотосинтезу?",
  "lib.ask.btn": "Запитати",
  "lib.ask.answer": "Відповідь",
  "lib.ask.noContext": "У цій області нічого релевантного не знайдено — спробуйте інше запитання або розширте область пошуку.",
  "lib.ask.sources": "Джерела",
  "lib.u.title": "Розуміння ШІ",
  "lib.u.summarize": "Підсумувати",
  "lib.u.rephrase": "Перефразувати",
  "lib.u.simplify": "Спростити",
  "lib.u.explain": "Пояснити",
  "lib.u.adapted": "Адаптовано до вашого рівня:",
  "lib.u.compareTitle": "Порівняти",
  "lib.u.compare": "Порівняти з іншим документом",
  "lib.u.noOther": "Немає іншого документа для порівняння.",
  "lib.u.prereqTitle": "Передумови",
  "lib.u.reviewFirst": "Повторіть це перед вивченням документа:",
  "lib.u.untracked": "не відстежується",
  "lib.level.new": "новий",
  "lib.level.beginner": "початківець",
  "lib.level.intermediate": "середній",
  "lib.level.advanced": "просунутий",
  "lib.r.title": "Навчальні матеріали",
  "lib.r.saved": "Збережені матеріали",
  "lib.r.summary": "Підсумок",
  "lib.r.revisionSheet": "Аркуш повторення",
  "lib.r.flashcards": "Картки",
  "lib.r.quiz": "Тест",
  "lib.r.exercises": "Вправи",
  "lib.r.openQuestions": "Відкриті запитання",
  "lib.r.coursePlan": "План курсу",
  "lib.r.mindmap": "Інтелект-карта (незабаром)",
  "lib.r.review": "🎴 Повторити зараз",
  "lib.workspace": "🎓 Академічний робочий простір",
  "ws.title": "Академічний робочий простір",
  "ws.analysing": "Викладач аналізує цю роботу…",
  "ws.analysisTitle": "Аналіз",
  "ws.levelAdapted": "адаптовано для:",
  "ws.objectives": "Цілі",
  "ws.skills": "Оцінювані навички",
  "ws.prerequisites": "Передумови",
  "ws.successCriteria": "Критерії успіху",
  "ws.keyNotions": "Ключові поняття",
  "ws.likelyHard": "Імовірно, складно для вас",
  "ws.chooseMode": "Виберіть супровід",
  "ws.mode.guide": "Поради",
  "ws.mode.accompany": "Розв'язати разом",
  "ws.mode.solve": "Повне рішення",
  "ws.thinking": "Викладач думає…",
  "ws.placeholder": "Запитайте, дайте відповідь або поділіться своєю спробою…",
  "ws.send": "Надіслати",
  "ws.finishTitle": "Перетворіть цю роботу на навчання",
  "ws.finishHint": "Створіть підсумок, картки та тест на основі цієї роботи — вони збережуться у вашій бібліотеці та підуть на повторення.",
  "ws.generate": "Створити навчальні матеріали",
  "ws.generated": "✅ Матеріали створено та збережено — перевірте матеріали документа.",
  "lib.integ.title": "Інтеграція в мозок",
  "lib.integ.summary": "Цей документ додав {c} понять, {ch} уривків для запам'ятовування та {e} зв'язків графа у ваш мозок.",
  "lib.integ.new": "Нові поняття",
  "lib.integ.known": "Вже відомі (з інших документів)",
  "lib.integ.mastered": "Вже освоєно",
  "lib.integ.fragile": "Ще крихкі",
  "lib.integ.prereq": "Передумови",
  "lib.integ.dependents": "Сприяє досягненню",
  "lib.integ.links": "Зв'язки з наявними знаннями",
  "goals.tileDetail": "Щоденні, щотижневі та щомісячні цілі",
  "goals.title": "Цілі",
  "goals.intro": "Чого ви хочете досягти? Встановіть цілі на сьогодні, цей тиждень та цей місяць.",
  "goals.placeholder": "напр. Завершити розділ з генетики",
  "goals.addBtn": "Додати ціль",
  "goals.daily": "Щодня",
  "goals.weekly": "Щотижня",
  "goals.monthly": "Щомісяця",
  "goals.none": "Цілей ще немає.",
  "goals.loading": "Завантаження ваших цілей…",
  "exams.tileDetail": "Предмети, дати та готовність",
  "exams.title": "Майбутні іспити",
  "exams.intro": "Ваші іспити за датою. Готовність оцінюється на основі засвоєння понять.",
  "exams.placeholder": "Предмет (напр. Генетика)",
  "exams.addBtn": "Додати іспит",
  "exams.none": "Іспитів не заплановано.",
  "exams.loading": "Завантаження іспитів…",
  "exams.prep": "Готовність",
  "exams.prepUnknown": "Ще недостатньо даних",
  "exams.p.high": "Високий",
  "exams.p.medium": "Середній",
  "exams.p.low": "Низький",
  "exams.in3": "Через 3 дні",
  "exams.in7": "Через 1 тиждень",
  "exams.in14": "Через 2 тижні",
  "exams.in30": "Через 1 місяць",
  "exams.past": "Минулий",
  "exams.today": "Сьогодні",
  "exams.tomorrow": "Завтра",
  "exams.in": "через",
  "exams.days": "днів",
  "header.languages": "Мови",
  "header.language": "Мова",
  "header.scan": "Сканувати курс",
  "header.revision": "Повторення",
  "header.progress": "Прогрес",
  "header.health": "Справність системи",
  "verdict.correct": "правильно",
  "verdict.partial": "частково",
  "verdict.incorrect": "неправильно",
  "rating.good": "добре",
  "rating.fair": "задовільно",
  "rating.needs_work": "потребує доопрацювання",
  "examiner.title": "📝 ШІ-екзаменатор",
  "examiner.intro": "Викладач стає вашим екзаменатором — він створює оцінювання, а потім перевіряє його з поясненнями та порадами. Оцінка ніколи не залишається самотньою.",
  "examiner.create": "Створити оцінювання",
  "examiner.topicPlaceholder": "Тема — напр. Французька революція",
  "examiner.difficulty": "Складність",
  "examiner.createTake": "Створити та пройти",
  "examiner.emptyTitle": "Ще немає оцінювань",
  "examiner.emptyDetail": "Виберіть тип і тему вище — тести, відкриті запитання, есе, вправи, кейси, пробні іспити або усне опитування.",
  "examiner.questionsCount": "{n} запит(ів)",
  "examiner.scored": "оцінка {n}/100",
  "examiner.notTaken": "не пройдено",
  "examiner.review": "Огляд",
  "examiner.take": "Пройти",
  "examiner.levelWord": "рівень",
  "examiner.question": "Запитання",
  "examiner.points": "{n} бал(ів)",
  "examiner.yourAnswer": "Ваша відповідь…",
  "examiner.why": "Чому: ",
  "examiner.how": "Як: ",
  "examiner.mistake": "Помилка: ",
  "examiner.avoid": "Як уникнути: ",
  "examiner.submit": "Надіслати на перевірку",
  "examiner.next": "Що робити далі",
  "examiner.back": "Назад до оцінювань",
  "examiner.t.mcq": "Тест",
  "examiner.t.open": "Відкриті запитання",
  "examiner.t.dissertation": "Есе",
  "examiner.t.exercise": "Вправи",
  "examiner.t.case_study": "Кейс",
  "examiner.t.mock_exam": "Пробний іспит",
  "examiner.t.oral": "Усне оцінювання",
  "writing.title": "✍️ Письмовий наставник",
  "writing.intro": "Надішліть текст — викладач проаналізує структуру, логіку, чіткість, орфографію, граматику, аргументацію та академічну якість, а потім чітко пояснить, як його покращити.",
  "writing.new": "Нова робота",
  "writing.titlePlaceholder": "Назва (необов'язково)",
  "writing.briefPlaceholder": "Тема / завдання, на яке дається відповідь (необов'язково)",
  "writing.textPlaceholder": "Вставте текст сюди…",
  "writing.review": "Перевірити мій текст",
  "writing.emptyTitle": "Ще немає робіт",
  "writing.emptyDetail": "Вставте есе, звіт, дисертацію чи будь-яку письмову роботу вище для повного структурованого огляду.",
  "writing.scored": "оцінка {n}/100",
  "writing.open": "Відкрити огляд",
  "writing.reviewTitle": "Аналіз тексту",
  "writing.works": "Що вдалося",
  "writing.improve": "Як покращити: ",
  "writing.first": "Зробіть це насамперед",
  "writing.back": "Назад до написання",
  "writing.t.redaction": "Есе",
  "writing.t.dissertation": "Дисертація",
  "writing.t.memoire": "Магістерська робота",
  "writing.t.rapport": "Звіт",
  "writing.t.compte_rendu": "Короткий зміст",
  "writing.t.devoir": "Домашнє завдання",
  "writing.d.structure": "Структура",
  "writing.d.logic": "Логіка",
  "writing.d.clarity": "Чіткість",
  "writing.d.spelling": "Орфографія",
  "writing.d.grammar": "Граматика",
  "writing.d.argumentation": "Аргументація",
  "writing.d.academic_quality": "Академічна якість",
  "reading.title": "📖 Тренер з читання",
  "reading.intro": "Отримайте уривок відповідно до вашого рівня із запитаннями на розуміння. Тренер перевіряє ваші відповіді та автоматично адаптує складність.",
  "reading.yourLevel": "Ваш рівень читання",
  "reading.topicPlaceholder": "Тема (необов'язково) — напр., вулкани, економіка…",
  "reading.generate": "Згенерувати уривок",
  "reading.emptyTitle": "Ще немає уривків",
  "reading.emptyDetail": "Згенеруйте свій перший уривок вище — рівень адаптуватиметься під час навчання.",
  "reading.scored": "оцінка {n}/100",
  "reading.notTaken": "не складено",
  "reading.review": "Огляд",
  "reading.read": "Читати",
  "reading.levelWord": "рівень",
  "reading.question": "Запитання",
  "reading.yourAnswer": "Ваша відповідь…",
  "reading.mistake": "Помилка: ",
  "reading.avoid": "Уникайте цього: ",
  "reading.submit": "Надіслати відповіді",
  "reading.back": "Назад до читання",
  "reading.levelUp": "⬆ Підвищення рівня: {from} → {to}",
  "reading.levelDown": "⬇ Легше наступного разу: {from} → {to}",
  "reading.levelHeld": "Рівень збережено на позначці {to}",
  "reading.lvl.beginner": "початковий",
  "reading.lvl.intermediate": "середній",
  "reading.lvl.advanced": "високий",
  "reading.lvl.expert": "експертний",
  "lang.learnTitle": "Вивчити мову",
  "lang.langPlaceholder": "Мова (напр., іспанська)",
  "lang.nativePlaceholder": "Ваша рідна мова (для перекладу)",
  "lang.teachingMode": "Режим навчання",
  "lang.start": "Почати",
  "lang.noLangsTitle": "Щe немає мов",
  "lang.noLangsDetail": "Ваш викладач інтегрує лексику у вашу звичайну чергу повторення, проводить заняття з повним зануренням і оцінює, наскільки добре вас розуміють під час читання вголос.",
  "lang.fromNative": "з мови: {native}",
  "lang.open": "Відкрити",
  "lang.metaWords": "слів",
  "lang.metaDue": "треба повторити",
  "lang.metaLessons": "уроки",
  "lang.immersionBadge": "🌊 Занурення · ~{pct}% {lang}",
  "lang.immersionHelp": "Ваш викладач спілкується мовою {lang}, перефразує та коротко пояснює, якщо ви загубилися, а потім знову переходить на {lang} — і говорить мовою {lang} все більше, оскільки ваш рівень CEFR зростає.",
  "lang.skills": "Граматика, дієвідмінювання та розуміння",
  "lang.skillsHelp": "Підлаштовано під ваш рівень CEFR ({level}). Залиште поле порожнім, щоб викладач сам обрав тему чи дієслово.",
  "lang.skillPlaceholder": "Тема або дієслово (необов'язково) — наприклад, минулий час, être",
  "lang.grammar": "📖 Граматика",
  "lang.conjugation": "🔤 Дієвідмінювання",
  "lang.comprehension": "📝 Розуміння",
  "lang.listen": "🔊 Слухати (розуміння на слух)",
  "lang.conversation": "Розмова",
  "lang.conversationHelp": "Практика відбувається у вашому звичайному вікні обговорення — викладач дотримується ролі, а в режимі занурення ніколи не переходить на іншу мову.",
  "lang.scenarioConvo": "Сценарій (необов'язково) — наприклад, в аптеці",
  "lang.startTalking": "Почати розмову",
  "lang.vocabulary": "Словник",
  "lang.vocabularyHelp": "Вставте будь-який текст, який ви читаєте. Слова стають звичайними картками FSRS, тому вони з'являються у вашій черзі повторення разом з усім іншим.",
  "lang.vocabPlaceholder": "Вставте текст цільовою мовою…",
  "lang.mineVocab": "Видобути лексику",
  "lang.vocabResult": "Додано нових слів до черги повторення: {n}{had}.",
  "lang.vocabHad": " ({n} у вас уже були)",
  "lang.lesson": "Урок",
  "lang.lessonPlaceholder": "Що будемо розглядати? Наприклад, замовлення їжі",
  "lang.writeLesson": "Скласти мені урок",
  "lang.sayOutLoud": "Вимовте це вголос",
  "lang.sayHelp": "Це вимірює, чи було ваше мовлення РОЗПІЗНАНЕ як фраза — справжня перевірка того, чи вас розуміють, а не оцінка акценту.",
  "lang.phrasePlaceholder": "Фраза для читання вголос",
  "lang.needsMic": "Потрібен мікрофон — поки що лише у вебверсії.",
  "lang.stopScore": "Зупинити та оцінити",
  "lang.record": "🎤 Записати",
  "lang.understoodPct": "Зрозуміло {pct}% слів",
  "lang.heard": "Почуто: “{text}”",
  "lang.pronCoach": "Тренер вимови",
  "lang.pronCoachHelp": "Говоріть вільно — викладач слухає та тренує вашу вимову, акцент, ритм, плавність та інтонацію. Мета полягає в тому, щоб вас розуміли, а не в досконалості.",
  "lang.coachContextPlaceholder": "Про що ви говорите? (необов'язково) — наприклад, розкажіть про себе",
  "lang.stopCoaching": "⏹ Зупинити та отримати пораду",
  "lang.speakFreely": "🎙️ Говорити вільно",
  "lang.whyMatters": "Чому це важливо",
  "lang.howImprove": "Як покращити",
  "lang.coachExercises": "Вправи",
  "lang.d.pronunciation": "вимова",
  "lang.d.accent": "акцент",
  "lang.d.rhythm": "ритм",
  "lang.d.fluency": "плавність",
  "lang.d.intonation": "інтонація",
  "langmode.beginner": "початківець",
  "langmode.intermediate": "середній",
  "langmode.advanced": "просунутий",
  "langmode.academic": "академічний",
  "langmode.professional": "професійний",
  "langmode.exam_prep": "підготовка до іспитів",
  "langmode.immersion": "занурення",
  "strategy.socratic": "Сократівський метод",
  "strategy.project_based": "На основі проєктів",
  "strategy.problem_solving": "Вирішення проблем",
  "strategy.case_study": "Практичний приклад",
  "strategy.task_based": "На основі завдань",
  "strategy.guided_demonstration": "Керована демонстрація",
  "strategy.active_learning": "Активне навчання",
  "strategy.experiential": "Досвідне",
  "common.backToday": "Повернутися до сьогодні",
  "health.title": "Стан системи",
  "health.unreachable": "Недоступно",
  "health.allOk": "Усі системи працюють",
  "health.degraded": "Уповільнено",
  "health.up": "працює",
  "health.down": "не працює",
  "health.refresh": "Оновити",
  "revision.loading": "Завантаження черги…",
  "revision.queueCleared": "Чергу очищено",
  "revision.nothingDue": "Зараз немає нічого на черзі",
  "revision.clearedDetail": "Ви переглянули карток: {n}. Наступне повторення заплановане саме на той момент, коли ви з найбільшою ймовірністю це забудете.",
  "revision.nothingDetail": "FSRS планує кожну картку на момент якраз перед тим, як ви її забудете. Повертайтеся, коли щось буде потрібне до повторення.",
  "revision.counter": "{i} з {total} · {done} виконано",
  "revision.tapReveal": "Торкніться, щоб показати",
  "revision.reveal": "Показати відповідь",
  "revision.again": "Знову",
  "revision.hard": "Складно",
  "revision.good": "Добре",
  "revision.easy": "Легко",
  "lessonNew.writing": "Створення уроку",
  "lessonNew.detail": "Ваш викладач пише повний урок, генерує вправи та картки й заносить їх у вашу довготривалу пам'ять. Це займе хвилину.",
  "scan.title": "Сфотографуйте курс",
  "scan.help": "Сфотографуйте сторінку, дошку чи свої рукописні нотки. Викладач прочитає їх, збереже оригінальну мову та занесе до вашої довготривалої пам'яті — до {max} сторінок за раз.",
  "scan.takePhoto": "📷 Зробити фото",
  "scan.chooseImages": "Вибрати зображення",
  "scan.pagesReady": "Сторінок готово: {n}",
  "scan.remove": "Видалити",
  "scan.titlePlaceholder": "Назва (необов'язково — інакше буде взято зі сторінки)",
  "scan.readPages": "Читати ці сторінки",
  "scan.reading": "Читання сторінок… це займе хвилину.",
  "scan.scanAnother": "Сканувати іншу",
  "scan.filed": "Збережено в пам'яті",
  "scan.filedDetail": "Прочитано символів: {n}. Триває індексування — щойно все буде готово, з'явиться можливість пошуку, а викладач зможе створювати на їх основі уроки.",
  "scan.cameraRefused": "Доступ до камери заборонено. Надайте дозвіл на використання камери та спробуйте знову.",
  "progress.currentStreak": "Поточна серія днів",
  "progress.longest": "Найдовша",
  "progress.activeDays": "Активні дні",
  "progress.days": "дні",
  "progress.yourNumbers": "Ваші цифри",
  "progress.cardsReviewed": "Переглянуто карток",
  "progress.retention": "Запам'ятовування",
  "progress.noReviews": "поки немає переглядів",
  "progress.dueNow": "Треба повторити зараз",
  "progress.conceptsMastered": "Освоєні концепції",
  "progress.atRisk": "Концепції під загрозою",
  "progress.lessonsCompleted": "Завершені уроки",
  "progress.exercisesCorrect": "Правильні вправи",
  "progress.milestones": "Етапи",
  "progress.askMentor": "Запитати наставника",
  "sub.tileDetail": "Ваш план та доступні плани.",
  "sub.title": "Підписка",
  "sub.intro": "Ваш поточний план і всі доступні пропозиції. Ліміти та переваги кожного плану уточнюються — ціни та оплата з'являться незабаром.",
  "sub.current": "Поточний план",
  "sub.currentPlan": "Поточний план",
  "sub.choose": "Вибрати",
  "sub.pricingSoon": "Ціни з'являться незабаром",
  "sub.note": "Наразі плани можна вільно змінювати — платне оформлення та ліміти для кожного плану з'являться в наступному оновленні.",
  "sub.status.active": "Активний",
  "sub.status.trialing": "Пробний",
  "sub.status.past_due": "Прострочено",
  "sub.status.canceled": "Скасовано",
  "sub.status.incomplete": "Неповний",
  "sub.audience.individual": "Індивідуальний",
  "sub.audience.organization": "Організація",
  "sub.cancel": "Скасувати план",
  "sub.willCancel": "скасовується в кінці періоду",
  "sub.invoices": "Рахунки",
  "sub.noInvoices": "Рахунків поки немає.",
  "profile.usage": "Використання та квоти",
  "usage.tileDetail": "Скільки лімітів вашого плану ви використали.",
  "usage.title": "Використання та квоти",
  "usage.intro": "Використано за цей період порівняно з лімітами вашого плану.",
  "usage.note": "Ліміти залежать від вашого плану та оновлюються щороку.",
  "usage.unlimited": "Необмежено",
  "usage.gb": "ГБ",
  "usage.min": "хв",
  "usage.metric.documents": "Документи",
  "usage.metric.storage": "Сховище",
  "usage.metric.ai_questions": "Запитання до штучного інтелекту",
  "usage.metric.voice_minutes": "Хвилини голосу",
  "profile.orgs": "Організації",
  "org.tileDetail": "Школи, університети та команди, до яких ви належите.",
  "org.title": "Організації",
  "org.intro": "Школи, університети, навчальні центри та компанії, до яких ви належите.",
  "org.create": "Створити організацію",
  "org.createBtn": "Створити",
  "org.namePlaceholder": "Назва — наприклад, Lincoln High School",
  "org.type.school": "Школа",
  "org.type.university": "Університет",
  "org.type.training_center": "Навчальний центр",
  "org.type.enterprise": "Компанія",
  "org.role.admin": "Адмін",
  "org.role.teacher": "Викладач",
  "org.role.student": "Учень",
  "org.memberCount": "{n} учасників",
  "org.open": "Відкрити",
  "org.emptyTitle": "Поки немає організацій",
  "org.emptyDetail": "Створіть її вище або попросіть адміністратора додати вас до своєї.",
  "org.members": "Учасники",
  "org.addMember": "Додати учасника",
  "org.addMemberBtn": "Додати учасника",
  "org.emailPlaceholder": "Електронна пошта учасника",
  "org.groups": "Класи та групи",
  "org.noGroups": "Класів чи груп поки немає.",
  "org.createGroup": "Створити клас",
  "org.createGroupBtn": "Створити клас",
  "org.groupNamePlaceholder": "Назва класу — наприклад, 12 клас – Природничі науки",
  "org.kind.class": "Клас",
  "org.kind.group": "Група",
  "org.back": "Назад до організацій",
  "org.insights": "🌐 Аналітика тенанта",
  "org.insightsMembers": "{s} учнів · {t} викладачів",
  "org.insightsActive": "{n} активних цього тижня",
  "org.difficultSubjects": "Найскладніші предмети",
  "org.recommendations": "Рекомендації",
  "profile.admin": "Панель адміністратора",
  "admin.tileDetail": "Бек-офіс платформи (тільки для адміністраторів).",
  "admin.title": "Панель адміністратора",
  "admin.intro": "Огляд платформи для всіх користувачів та організацій.",
  "admin.stat.users": "Користувачі",
  "admin.stat.orgs": "Організації",
  "admin.stat.docs": "Документи",
  "admin.stat.revenue": "Дохід",
  "admin.stat.incidents": "Відкриті інциденти",
  "admin.stat.reports": "Відкриті скарги",
  "admin.aiUsage": "Використання ШІ",
  "admin.aiQuestions": "Запитання до ШІ",
  "admin.voiceMinutes": "Хвилини голосу",
  "admin.users": "Користувачі",
  "admin.suspend": "Заблокувати",
  "admin.reactivate": "Активувати знову",
  "admin.suspended": "заблоковано",
  "admin.incidents": "Інциденти",
  "admin.incidentPlaceholder": "Назва інциденту",
  "admin.createIncident": "Створити інцидент",
  "admin.resolve": "Вирішити",
  "admin.sev.low": "Низький",
  "admin.sev.medium": "Середній",
  "admin.sev.high": "Високий",
  "admin.sev.critical": "Критичний",
  "admin.istatus.open": "Відкрито",
  "admin.istatus.investigating": "Розслідується",
  "admin.istatus.resolved": "Вирішено",
  "admin.reports": "Скарги",
  "admin.noReports": "Немає скарг.",
  "admin.review": "Позначити як переглянуте",
  "admin.rstatus.open": "Відкрито",
  "admin.rstatus.reviewed": "Переглянуто",
  "admin.rstatus.dismissed": "Відхилено",
  "admin.logs": "Журнал аудиту",
  "profile.analytics": "Аналітика",
  "an.tileDetail": "Бізнес-аналітика платформи (тільки для адміністраторів).",
  "an.title": "Аналітика",
  "an.intro": "Показники платформи для забезпечення постійного вдосконалення.",
  "an.active": "Активні користувачі",
  "an.stickiness": "Залученість",
  "an.retention": "Утримання (7 днів)",
  "an.newUsers": "Нові (7д)",
  "an.business": "Бізнес",
  "an.revenue": "Дохід",
  "an.conversion": "Конверсія",
  "an.paid": "Платні користувачі",
  "an.learning": "Навчання та ШІ",
  "an.studyTime": "Час навчання",
  "an.mastery": "Сер. рівень засвоєння",
  "an.lessons": "Уроки",
  "an.aiQuestions": "Запитання до ШІ",
  "an.voiceMinutes": "Хвилини голосу",
  "an.topFeatures": "Найпопулярніші функції",
  "an.feature.tutor": "ШІ-викладач",
  "an.feature.lessons": "Уроки",
  "an.feature.assessments": "Оцінювання",
  "an.feature.writing": "Письмо",
  "an.feature.reading": "Читання",
  "an.feature.documents": "Документи",
  "an.feature.languages": "Мови",
  "profile.privacy": "Конфіденційність і дані",
  "priv.tileDetail": "Згоди, експорт даних та видалення облікового запису.",
  "priv.title": "Конфіденційність і дані",
  "priv.intro": "Керуйте згодами, експортуйте свої дані або видаліть обліковий запис.",
  "priv.consents": "Згоди",
  "priv.consent.analytics": "Аналітика продукту",
  "priv.consent.marketing": "Маркетингові повідомлення",
  "priv.consent.product_emails": "Листи про оновлення продукту",
  "priv.granted": "Надано",
  "priv.notGranted": "Не надано",
  "priv.grant": "Надати",
  "priv.withdraw": "Відкликати",
  "priv.export": "Експортувати дані",
  "priv.exportHelp": "Завантажити всю інформацію про вас у форматі JSON.",
  "priv.exportBtn": "Експортувати мої дані",
  "priv.exportDone": "Експорт ваших даних завантажено.",
  "priv.exportReady": "Експорт ваших даних готовий.",
  "priv.danger": "Небезпечна зона",
  "priv.deleteHelp": "Назавжди видалити ваш обліковий запис і всі дані. Цю дію неможливо скасувати.",
  "priv.deleteBtn": "Видалити мій обліковий запис",
  "priv.passwordPlaceholder": "Підтвердьте паролем",
  "priv.cancel": "Скасувати",
  "priv.confirmDelete": "Видалити назавжди",
  "h.hero.analyzed": "Я проаналізував ваш прогрес і підготував день.",
  "h.ctx.new": "Вітаємо. Створимо ваш перший навчальний план.",
  "h.ctx.active": "Я підготував сьогоднішню сесію.",
  "h.ctx.exam": "Наближається іспит — я скоригував вашу програму.",
  "h.ctx.revision": "Сьогодні є ризик забути кілька понять.",
  "h.ctx.success": "Ви щойно закріпили важливе поняття.",
  "h.ctx.inactive": "Минуло кілька днів — давайте плавно повернемося до навчання.",
  "h.hero.start": "Розпочати сесію",
  "h.hero.detail": "Докладніше",
  "h.hero.activities": "вправи",
  "h.hero.min": "хв",
  "h.hero.priorityHigh": "високий пріоритет",
  "h.nba.title": "Ваша наступна дія",
  "h.nba.priority": "ПРІОРИТЕТ",
  "h.nba.why": "Чому?",
  "h.nba.start": "Почати",
  "h.nba.review": "Повторити",
  "h.nba.learn": "Вивчити",
  "h.nba.r.at_risk": "Ваше засвоєння знижується — коротке повторення сьогодні матиме великий ефект.",
  "h.nba.r.ready": "Передумови засвоєно — це ідеальний наступний крок.",
  "h.nba.r.in_progress": "Ви вже це вивчаєте — збережіть темп.",
  "h.nba.r.review": "Сьогодні є картки для повторення.",
  "h.nba.none": "Нічого термінового — ви все встигаєте. Коротке повторення все одно допоможе.",
  "h.capture.title": "Чого ви хочете навчитися?",
  "h.capture.placeholder": "Пояснити похідні… / поставити запитання",
  "h.capture.write": "Писати",
  "h.capture.speak": "Говорити",
  "h.capture.drop": "Скинути",
  "h.capture.scan": "Сканувати",
  "h.capture.import": "Імпортувати",
  "h.proactive.badge": "АДАПТОВАНИЙ ПЛАН",
  "h.today.title": "Сьогодні",
  "h.today.none": "На сьогодні нічого не заплановано.",
  "h.today.summary": "{min} хв · {n} вправ",
  "h.st.done": "готово",
  "h.st.in_progress": "у процесі",
  "h.st.pending": "треба зробити",
  "h.st.skipped": "відкладено",
  "h.continue.title": "Продовжити",
  "h.continue.reached": "Ви дійшли до:",
  "h.continue.btn": "Продовжити",
  "h.progress.week": "Цей тиждень",
  "h.progress.reviews": "Повторення",
  "h.progress.streak": "днів поспіль",
  "h.mastery.title": "Майстерність",
  "h.mastery.none": "Концепти ще не відстежуються.",
  "h.exams.title": "Майбутні іспити",
  "h.exams.prep": "Підготовка",
  "h.exams.none": "Немає майбутніх іспитів.",
  "h.exams.hint": "Ви можете додати іспит будь-коли.",
  "h.exams.plan": "Переглянути розклад",
  "h.exams.inDays": "через {n} днів",
  "h.exams.today": "сьогодні",
  "h.exams.tomorrow": "завтра",
  "h.recs.title": "Порада від викладача",
  "h.recs.none": "Наразі немає порад.",
  "h.recs.act": "Почати",
  "h.capacity.title": "Сьогоднішнє навантаження",
  "h.capacity.recommended": "Рекомендовано {n} хвилин",
  "h.streak.title": "Регулярність",
  "h.streak.days": "днів",
  "h.block.error": "Не вдалося завантажити цей блок.",
  "h.block.retry": "Повторити",
  "h.open": "Відкрити",
  "learn.section.modes": "Як ви хочете працювати?",
  "study.section.cards": "Розумні картки",
  "onboarding.preparing": "Підготовка простору…",
  "onboarding.gen.title": "Створення цифрового мозку…",
  "onboarding.gen.analyzing": "Аналіз профілю…",
  "onboarding.gen.graph": "Побудова карти знань…",
  "onboarding.gen.teacher": "Персоналізація вашого AI-професора…",
  "onboarding.gen.forming": "Ваш цифровий мозг набуває форми…",
  "profile.manageSubscription": "Керувати підпискою",
  "onb.progress": "Ваш простір набуває форми…",
  "onb.why": "Чому я це запитую?",
  "onb.continue": "Продовжити",
  "onb.back": "Назад",
  "onb.skip": "Пропустити",
  "onb.cat.kindergarten": "Дитячий садок",
  "onb.cat.primary": "Початкова школа",
  "onb.cat.secondary": "Середня школа",
  "onb.cat.highschool": "Старша школа",
  "onb.cat.university": "Університет",
  "onb.cat.research": "Дослідження / аспірантура",
  "onb.cat.professional": "Професійне навчання",
  "onb.cat.language": "Вивчення мови",
  "onb.cat.personal": "Особисте навчання",
  "onb.age.under12": "До 12 років",
  "onb.age.12to15": "12–15",
  "onb.age.16to18": "16–18",
  "onb.age.18to25": "18–25",
  "onb.age.25to40": "25–40",
  "onb.age.over40": "40 і старше",
  "onb.goal.understand": "Зрозуміти мої курси",
  "onb.goal.exams": "Здати іспити",
  "onb.goal.grades": "Покращити оцінки",
  "onb.goal.language": "Вивчити мову",
  "onb.goal.contest": "Підготуватися до конкурсного іспиту",
  "onb.goal.homework": "Зробити домашнє завдання",
  "onb.goal.labs": "Виконати лабораторну роботу",
  "onb.goal.reports": "Написати звіти",
  "onb.goal.projects": "Працювати над проєктами",
  "onb.goal.research": "Проводити дослідження",
  "onb.goal.skills": "Розвивати навички",
  "onb.goal.curiosity": "Вчитися з цікавості",
  "onb.subj.math": "Математика",
  "onb.subj.physics": "Фізика",
  "onb.subj.chemistry": "Хімія",
  "onb.subj.biology": "Біологія",
  "onb.subj.cs": "Комп'ютерні науки",
  "onb.subj.law": "Право",
  "onb.subj.economics": "Економіка",
  "onb.subj.history": "Історія",
  "onb.subj.geography": "Географія",
  "onb.subj.languages": "Мови",
  "onb.subj.medicine": "Медицина",
  "onb.subj.philosophy": "Філософія",
  "onb.pref.visual": "Візуальні пояснення",
  "onb.pref.examples": "Приклади",
  "onb.pref.practice": "Практика",
  "onb.pref.exercises": "Вправи",
  "onb.pref.conversation": "Розмова",
  "onb.pref.reading": "Читання",
  "onb.pref.listening": "Слухання",
  "onb.pref.repetition": "Повторення",
  "onb.pref.problems": "Вирішення проблем",
  "onb.tone.supportive": "Підтримуючий",
  "onb.tone.balanced": "Збалансований",
  "onb.tone.demanding": "Вимогливий",
  "onb.expl.short": "Короткий",
  "onb.expl.balanced": "Збалансований",
  "onb.expl.detailed": "Детальний",
  "onb.interv.let_me_think": "Дайте мені подумати",
  "onb.interv.guide_me": "Спрямовуй мене крок за кроком",
  "onb.interv.interactive": "Активно взаємодій зі мною",
  "onb.corr.immediate": "Виправляй одразу",
  "onb.corr.let_me_finish": "Дай мені завершити",
  "onb.corr.adaptive": "Адаптуйся до ситуації",
  "onb.sup.guide": "Спрямовуй мене",
  "onb.sup.understand": "Допоможи мені зрозуміти",
  "onb.sup.step_by_step": "Проведи мене крок за кроком",
  "onb.sup.verify": "Перевір мої міркування",
  "onb.sup.solution": "Покажи розв’язання з поясненням",
  "onb.skill.comprehension": "Розуміння",
  "onb.skill.speaking": "Говоріння",
  "onb.skill.pronunciation": "Вимова",
  "onb.skill.writing": "Письмо",
  "onb.skill.grammar": "Граматика",
  "onb.skill.vocabulary": "Словниковий запас",
  "onb.rate.high": "У мене виходить",
  "onb.rate.medium": "Посередньо",
  "onb.rate.low": "Потрібно попрацювати",
  "onb.welcome.title": "Ласкаво просимо до Second Brain.",
  "onb.welcome.start": "Почати",
  "onb.welcome.body": "Створимо ваш навчальний простір відповідно до вашого стилю навчання.",
  "onb.welcome.teacher": "Я дізнаюся про вас більше, щоб налаштувати вашого AI-професора під ваш рівень, цілі та стиль навчання.",
  "onb.identity.teacher": "Давайте познайомимося — лише найнеобхідніше, нічого зайвого.",
  "onb.identity.title": "Хто ви?",
  "onb.identity.firstName": "Ім'я",
  "onb.identity.firstNamePh": "Ваше ім'я",
  "onb.identity.lastName": "Прізвище (необов'язково)",
  "onb.identity.lastNamePh": "Ваше прізвище",
  "onb.identity.avatar": "Аватар (необов'язково)",
  "onb.identity.age": "Віковий діапазон",
  "onb.identity.ageWhy": "Віковий діапазон використовується лише для адаптації тону та подачі матеріалу. Дата народження не запитується, а безпека для молодших учнів гарантована.",
  "onb.identity.country": "Країна / регіон (необов'язково)",
  "onb.identity.countryPh": "напр. Франція",
  "onb.category.teacher": "Це допоможе мені зрозуміти ваш поточний етап.",
  "onb.category.title": "На якому ви етапі?",
  "onb.category.subtitle": "Виберіть те, що підходить вам найкраще.",
  "onb.academic.teacher": "Опишіть своє навчання — виберіть, знайдіть або введіть довільно.",
  "onb.academic.title": "Ваше навчання",
  "onb.academic.subtitle": "Нічого не є обов'язковим: заповніть те, що до вас стосується.",
  "onb.academic.level": "Рівень",
  "onb.academic.levelPh": "напр. Університет",
  "onb.academic.system": "Країна / система освіти",
  "onb.academic.systemPh": "напр. Франція — LMD",
  "onb.academic.field": "Галузь",
  "onb.academic.fieldPh": "напр. Комп'ютерні науки",
  "onb.academic.domain": "Домен",
  "onb.academic.domainPh": "напр. Інженерія програмного забезпечення",
  "onb.academic.specialty": "Спеціальність (необов'язково)",
  "onb.academic.specialtyPh": "напр. Розподілені системи",
  "onb.academic.year": "Рік / курс",
  "onb.academic.yearPh": "напр. 3-й курс",
  "onb.goals.teacher": "Розкажіть, навіщо ви тут — можна вибрати кілька варіантів.",
  "onb.goals.title": "Чому ви використовуєте Second Brain?",
  "onb.subjects.teacher": "Ці предмети живитимуть вашу пам'ять, граф знань та розклад.",
  "onb.subjects.title": "Ваші предмети",
  "onb.subjects.add": "Додати предмет",
  "onb.subjects.addPh": "напр. Астрофізика",
  "onb.subjects.addBtn": "Додати",
  "onb.languages.teacher": "Мова визначає мої пояснення та підтримку, яку я можу вам надати.",
  "onb.languages.title": "Ваші мови",
  "onb.languages.native": "Рідна мова",
  "onb.languages.interface": "Мова інтерфейсу",
  "onb.languages.interfaceWhy": "Мова інтерфейсу змінює оформлення та мову, якою викладає AI-професор.",
  "onb.languages.study": "Мова навчання (необов'язково)",
  "onb.languages.studyWhy": "Якщо ви навчаєтеся не рідною мовою, я вмикаю двомовну підтримку та академічну лексику.",
  "onb.mobility.title": "Міжнародна мобільність",
  "onb.mobility.subtitle": "Чи навчаєтеся ви зараз мовою, відмінною від вашої рідної?",
  "onb.mobility.yes": "Так",
  "onb.mobility.no": "Ні",
  "onb.mobility.alertTitle": "Мовну підтримку ввімкнено",
  "onb.mobility.alertDetail": "Контекстний переклад, академічна лексика, двомовні пояснення та поступове занурення.",
  "onb.ll.teacher": "Створимо вашу мовну подорож, адаптовану спеціально для вас.",
  "onb.ll.title": "Вивчення мови",
  "onb.ll.target": "Я хочу вивчити",
  "onb.ll.currentLevel": "Поточний рівень",
  "onb.ll.goalLevel": "Ціль",
  "onb.ll.mainGoal": "Головна ціль",
  "onb.ll.mainGoalPh": "напр. Розмова",
  "onb.ll.skills": "На чому ви хочете зосередитися?",
  "onb.prefs.teacher": "Це вподобання, а не діагноз. Ви можете змінити їх будь-коли.",
  "onb.prefs.title": "Як вам зручніше навчатися?",
  "onb.teacher.teacher": "Налаштуйте мене. Далі я буду адаптуватися на основі ваших результатів.",
  "onb.teacher.title": "Ваш професор зі штучного інтелекту",
  "onb.teacher.tone": "Тон",
  "onb.teacher.explanations": "Пояснення",
  "onb.teacher.intervention": "Втручання",
  "onb.teacher.correction": "Виправлення",
  "onb.support.teacher": "Лабораторні, домашні завдання, звіти, проєкти, дисертації — чим вам допомогти?",
  "onb.support.title": "Академічна допомога",
  "onb.assess.teacher": "Давайте швидко перевіримо, що ви вже знаєте — кілька запитань, це не іспит.",
  "onb.assess.title": "Швидка перевірка",
  "onb.assess.save": "Зберегти",
  "onb.assess.noSubjectTitle": "Предмет не вибрано",
  "onb.assess.noSubjectDetail": "Додайте предмет на попередньому кроці, щоб пройти перевірку, або пропустіть цей крок.",
  "onb.assess.whichSubject": "З якого предмета?",
  "onb.assess.preparing": "Підготовка...",
  "onb.assess.run": "Розпочати перевірку",
  "onb.assess.unavailableTitle": "Перевірка недоступна",
  "onb.assess.unavailableDetail": "Ви можете самостійно оцінити свій рівень нижче.",
  "onb.assess.selfRate": "Оцініть свій рівень з",
  "onb.assess.answerPh": "Ваша відповідь (необов'язково)",
  "onb.twin.title": "Ось що я зрозумів про вас",
  "onb.twin.subtitle": "Ви можете одразу виправити те, що зрозумів Second Brain.",
  "onb.twin.confirm": "Все вірно",
  "onb.twin.profile": "Профіль",
  "onb.twin.langs": "Мови",
  "onb.twin.goals": "Цілі",
  "onb.twin.subjects": "Предмети",
  "onb.twin.prof": "Професор",
  "onb.twin.target": "Ціль",
  "onb.twin.native": "рідна мова",
  "onb.twin.study": "навчатися",
  "onb.twin.hi": "Привіт",
  "onb.twin.almost": "ми майже закінчили.",
  "onb.twin.toAdapt": "Щоб адаптуватися",
  "onb.adapt.title": "Ось як працюватиме ваш професор зі штучного інтелекту",
  "onb.adapt.enter": "Увійти в Second Brain",
  "onb.adapt.preparing": "Підготовка...",
  "onb.adapt.willBody": "Я буду:",
  "onb.adapt.p1": "адаптувати свої пояснення до вашого рівня",
  "onb.adapt.p2": "знаходити ваші слабкі місця",
  "onb.adapt.p3": "залучати вас до практики",
  "onb.adapt.p4": "планувати ваші повторення",
  "onb.adapt.p5": "використовувати ваші документи",
  "onb.adapt.p6": "допомагати з виконанням завдань",
  "onb.edit": "Редагувати",
  "error.serverBusy": "Сервіс зараз перевантажений. Будь ласка, спробуйте знову за хвилину.",
  "error.network": "Проблема з підключенням. Перевірте мережу та спробуйте знову.",
  "onb.cfg.title": "Конфігурацію застосовано",
  "onb.cfg.profileUpdated": "Профіль оновлено",
  "onb.cfg.langCreated": "Мовний профіль створено",
  "onb.cfg.concepts": "початкові поняття",
  "auth.brandTitle": "Ваш штучний інтелект для розширення можливостей мозку",
  "auth.brandSubtitle": "Вивчайте. Розумійте. Запам'ятовуйте. Ваш AI-професор розвивається разом із вами.",
  "auth.badgeLangs": "34 мови",
  "auth.badgeModels": "Мультимодельний штучний інтелект",
  "auth.badgeGraph": "Граф знань",
  "auth.sceneQuestion": "Поясніть мені цю концепцію простими словами.",
  "auth.sceneAnswer": "Звісно — ось пояснення крок за кроком, адаптване до вашого рівня.",
  "auth.sceneConcept": "Концепція",
  "auth.sceneRelation": "Зв'язок",
  "auth.sceneMastery": "Засвоєння",
  "auth.welcomeBack": "З поверненням",
  "auth.signUpSubtitle": "Кілька секунд для створення вашого навчального простору.",
  "auth.signInSubtitle": "Продовжуйте саме там, де зупинилися.",
  "auth.showPassword": "Показати пароль",
  "auth.hidePassword": "Приховати пароль",
  "auth.themeToggle": "Змінити тему",
  "auth.strengthLabel": "Складність пароля",
  "auth.strengthWeak": "Слабкий",
  "auth.strengthMedium": "Середній",
  "auth.strengthStrong": "Сильний",
  "auth.emailFieldHint": "наприклад, you@example.com",
  "auth.retry": "Повторити",
  "nav.expand": "Розгорнути меню",
  "nav.collapse": "Згорнути меню",
  "profile.kyc.title": "Мій профіль",
  "profile.kyc.complete": "Завершено",
  "profile.kyc.incomplete": "Завершити",
  "profile.kyc.detail": "Інформація, яка адаптує вашого AI-професора та цифрового двійника.",
  "profile.kyc.verify": "Переглянути мій профіль",
  "profile.kyc.name": "Імя",
  "profile.kyc.path": "Шлях",
  "profile.kyc.languagesRow": "Мови",
  "profile.kyc.goalsRow": "Цілі",
  "profile.kyc.goalsN": "ціль(і)",
  "profile.footer": "Ваші зміни миттєво оновлюють AI-професора та цифрового двійника в усьому додатку.",
  "lib.learnWithTeacher": "Навчайтеся з викладачем",
  "sub.popular": "Популярні",
  "sub.perMonth": "/міс",
  "sub.free": "Безкоштовно",
  "landing.brand": "Second Brain",
  "landing.signature": "Активуйте свого цифрового двійника",
  "landing.nav.features": "Можливості",
  "landing.nav.how": "Як це працює",
  "landing.nav.professor": "AI-професор",
  "landing.nav.academic": "Академічний робочий простір",
  "landing.nav.languages": "Мови",
  "landing.nav.faq": "Часті запитання",
  "landing.cta.signin": "Увійти",
  "landing.cta.start": "Почати безкоштовно",
  "landing.cta.startShort": "Почати",
  "landing.cta.discover": "Подивитися, як це працює",
  "landing.hero.title": "Ваш цифровий двійник для навчання",
  "landing.hero.subtitle": "AI-професор, який розуміє ваш шлях, запам'ятовує те, що вивчаєте, і навчає вас — індивідуально.",
  "landing.hero.promise1": "Вивчати",
  "landing.hero.promise2": "Зрозуміти",
  "landing.hero.promise3": "Запам'ятати",
  "landing.hero.promise4": "Прогрес",
  "landing.hero.reassure1": "Адаптивний професор ШІ",
  "landing.hero.reassure2": "Постійна пам'ять",
  "landing.hero.reassure3": "34 мови",
  "landing.hero.reassure4": "Розумні документи",
  "landing.mock.os": "SECOND BRAIN OS",
  "landing.mock.brain": "Мій мозок",
  "landing.mock.professor": "Професор ШІ",
  "landing.mock.msg": "“Поясни мені цю концепцію…”",
  "landing.mock.memory": "Пам'ять",
  "landing.mock.progress": "Прогрес",
  "landing.mock.mastery": "Майстерність",
  "landing.signals.multipdf": "Мульти-PDF",
  "landing.signals.fsrs": "FSRS",
  "landing.flow.documents": "Документи",
  "landing.flow.intelligence": "Інтелект",
  "landing.flow.graph": "Граф знань",
  "landing.flow.professor": "Професор ШІ",
  "landing.flow.twin": "Цифровий двійник",
  "landing.flow.revision": "Огляд і прогрес",
  "landing.compare.title": "Що змінюється",
  "landing.compare.message": "Second Brain не просто зберігає ваші знання. Він навчається тому, як навчаєтеся ви.",
  "landing.compare.classicTitle": "Класичний застосунок",
  "landing.compare.sbTitle": "Second Brain OS",
  "landing.compare.classic1": "Ізольовані документи",
  "landing.compare.classic2": "Статичні нотатки",
  "landing.compare.classic3": "Базовий пошук",
  "landing.compare.classic4": "Підсумки",
  "landing.compare.classic5": "Розсіяна історія",
  "landing.compare.sb1": "Особиста пам'ять",
  "landing.compare.sb2": "Професор ШІ",
  "landing.compare.sb3": "Граф знань",
  "landing.compare.sb4": "Адаптивне навчання",
  "landing.compare.sb5": "Розумний огляд",
  "landing.compare.sb6": "Безперервний прогрес",
  "landing.compare.classicFlow": "Зберігання → Пошук → Читання",
  "landing.compare.sbFlow": "Захоплення → Розуміння → Викладання → Запам'ятовування → Прогрес",
  "landing.how.title": "Як це працює",
  "landing.how.s1.title": "Захоплення",
  "landing.how.s1.desc": "PDF, фото, скани, нотатки та будь-який навчальний контент.",
  "landing.how.s2.title": "Розуміння",
  "landing.how.s2.desc": "Система структурує інформацію та визначає концепції.",
  "landing.how.s3.title": "Викладання",
  "landing.how.s3.desc": "Професор ШІ перетворює знання на навчальний досвід.",
  "landing.how.s4.title": "Запам'ятовування",
  "landing.how.s4.desc": "Ваш Цифровий двійник і система огляду відстежують те, що ви засвоюєте.",
  "landing.how.s5.title": "Прогрес",
  "landing.how.s5.desc": "FSRS, оцінювання та рекомендації закріплюють ваші знання.",
  "landing.exp.title": "Одиниця контенту → навчальний досвід",
  "landing.exp.lead": "Нічого ніколи не імпортується просто так, щоб бути забутим. Кожен документ стає чимось, що ви можете вивчити, практично застосувати та запам'ятати.",
  "landing.exp.s1": "PDF",
  "landing.exp.s2": "Аналізувати",
  "landing.exp.s3": "Зрозуміти",
  "landing.exp.s4": "Навчайтеся з Професором",
  "landing.exp.s5": "Запитання",
  "landing.exp.s6": "Вправи",
  "landing.exp.s7": "Огляд",
  "landing.exp.s8": "Пам'ять",
  "landing.exp.actionLearn": "Навчайтеся з Професором",
  "landing.exp.actionSolve": "Вирішіть це зі мною",
  "landing.showcase.title": "Один продукт, один досвід",
  "landing.showcase.brain.tab": "🧠 Мій Мозок",
  "landing.showcase.brain.title": "Мій Мозок",
  "landing.showcase.brain.desc": "Ваш візуальний Цифровий Близнюк: Граф Знань, Навчальна ДНК, сильні сторони та вразливості на одній живій карті.",
  "landing.showcase.professor.tab": "👨‍🏫 ШІ-Професор",
  "landing.showcase.professor.title": "ШІ-Професор",
  "landing.showcase.professor.desc": "Письмова розмова, викладання та педадогіка, що адаптуються до вашого точного рівня та цілей.",
  "landing.showcase.search.tab": "🔎 Вільний Пошук",
  "landing.showcase.search.title": "Вільний ШІ-Пошук",
  "landing.showcase.search.desc": "Запитуйте про що завгодно — спонтанне, технічне, академічне питання чи загальні знання — у середовищі Learn.",
  "landing.showcase.documents.tab": "📚 Масивні Документи",
  "landing.showcase.documents.title": "Масивні Документи",
  "landing.showcase.documents.desc": "PDF, фотографії, скани та цілі предмети, об'єднані разом — працюйте з повним курсом, а не з одним файлом.",
  "landing.showcase.voice.tab": "🎙️ Голос і Усна форма",
  "landing.showcase.voice.title": "Голос і Усна форма",
  "landing.showcase.voice.desc": "Розмова вголос, усні вправи та усні іспити для практики вголос.",
  "landing.showcase.academic.tab": "🎓 Академічний Простір",
  "landing.showcase.academic.title": "Академічний Простір",
  "landing.showcase.academic.desc": "Лабораторні, домашні завдання, звіти, проєкти, дипломні, есе та теми іспитів — крок за кроком.",
  "landing.showcase.revise.tab": "📅 Повторення",
  "landing.showcase.revise.title": "Повторення",
  "landing.showcase.revise.desc": "FSRS, картки, квизи та прогрес, що закріплюють те, чого ви навчилися.",
  "landing.professor.title": "Професор, який дізнається, хто ви",
  "landing.professor.lead": "Не просто типовий чат-бот, а викладач, який адаптується до вашого рівня, цілей та стилю навчання.",
  "landing.professor.a1": "Рівень",
  "landing.professor.a2": "Цілі",
  "landing.professor.a3": "Складнощі",
  "landing.professor.a4": "Історія навчання",
  "landing.professor.a5": "Мова",
  "landing.professor.a6": "Навчальна програма",
  "landing.professor.a7": "Темп",
  "landing.professor.a8": "Прогрес",
  "landing.professor.modesTitle": "Режими навчання",
  "landing.professor.m1": "Навчати",
  "landing.professor.m2": "Пояснити",
  "landing.professor.m3": "Обговорити",
  "landing.professor.m4": "Керована сесія",
  "landing.professor.m5": "Усна вправа",
  "landing.professor.m6": "Усний іспит",
  "landing.professor.flow": "Зрозуміти → попрактикуватись → пройти оцінювання → виправити → запам'ятати",
  "landing.academic.title": "Академічний Простір",
  "landing.academic.badge": "Можливість простору Learn",
  "landing.academic.lead": "Мета полягає не просто в тому, щоб дати вам відповідь, а в тому, щоб навчити вас методу.",
  "landing.academic.w1": "Лабораторна",
  "landing.academic.w2": "Домашнє завдання",
  "landing.academic.w3": "Звіт",
  "landing.academic.w4": "Проєкт",
  "landing.academic.w5": "Дипломна",
  "landing.academic.w6": "Есе",
  "landing.academic.w7": "Кейс",
  "landing.academic.w8": "Вправа",
  "landing.academic.w9": "Тема іспиту",
  "landing.academic.mode1.title": "Педагогічний супровід",
  "landing.academic.mode1.desc": "ШІ керує вами крок за кроком.",
  "landing.academic.mode2.title": "Допомога у вирішенні",
  "landing.academic.mode2.desc": "Ви працюєте над цим разом із ШІ.",
  "landing.academic.mode3.title": "Повне пояснене рішення",
  "landing.academic.mode3.desc": "Рішення пояснюється педагогічно, а не просто надається.",
  "landing.languages.title": "Мови та зануρέння",
  "landing.languages.lead": "Вивчайте мову та розумійте мову власних навчальних матеріалів.",
  "landing.languages.l1": "Занурення",
  "landing.languages.l2": "Розмова",
  "landing.languages.l3": "Усне",
  "landing.languages.l4": "Тіньовий повтор",
  "landing.languages.l5": "Прогрес",
  "landing.languages.l6": "Словник",
  "landing.languages.l7": "Граматика",
  "landing.languages.mobilityTitle": "Академічна мобільність",
  "landing.languages.mob1": "Франкомовний студент",
  "landing.languages.mob2": "Англомовний університет",
  "landing.languages.mob3": "Контекстуальний переклад",
  "landing.languages.mob4": "Академічна лексика",
  "landing.languages.mob5": "Поступове занурення",
  "landing.kyc.title": "Система адаптується до учня",
  "landing.kyc.lead": "Це не адміністративна форма — це механізм адаптації. Він налаштовує під вас рівень, лексику, тон, педагогіку та складність.",
  "landing.kyc.p1.title": "Початковий",
  "landing.kyc.p1.desc": "Візуальний підхід до навчання, адаптований за віком.",
  "landing.kyc.p2.title": "Старша школа / Університет",
  "landing.kyc.p2.desc": "Структурований метод, іспити та закріплення.",
  "landing.kyc.p3.title": "Спеціалізована галузь",
  "landing.kyc.p3.desc": "Медицина, право, інформатика, інженерія, архітектура…",
  "landing.kyc.p4.title": "Дослідник",
  "landing.kyc.p4.desc": "Наукова суворість та глибше дослідження.",
  "landing.kyc.p5.title": "Вивчаючий мову",
  "landing.kyc.p5.desc": "Занурення та мовний прогрес.",
  "landing.twin.title": "Ваше навчання стає живою пам'яттю",
  "landing.twin.lead": "Що більше ви навчаєтесь із Second Brain, то особистішою стає ваша система.",
  "landing.twin.i1": "Те, що вивчаєте",
  "landing.twin.i2": "Те, що розумієте",
  "landing.twin.i3": "Те, що забуваєте",
  "landing.twin.i4": "Те, що опановуєте",
  "landing.twin.i5": "Ваші цілі",
  "landing.twin.result": "Цифровий двійник",
  "landing.graph.title": "Граф знань",
  "landing.graph.lead": "Жива карта взаємозв'язків між усім, що вивчаєте.",
  "landing.revision.title": "Розумний повтор",
  "landing.revision.message": "Повторюйте не більше. Повторюйте в правильний момент.",
  "landing.revision.lead": "FSRS — це шар збереження для всієї вашої системи, а не просто стопка карток.",
  "landing.revision.c1": "FSRS",
  "landing.revision.c2": "Інтервальне повторення",
  "landing.revision.c3": "Картки",
  "landing.revision.c4": "Квізи",
  "landing.revision.c5": "Оцінювання",
  "landing.revision.c6": "Прогрес",
  "landing.one.title": "Єдиний досвід",
  "landing.one.s1": "Захоплення",
  "landing.one.s2": "Розуміння",
  "landing.one.s3": "Навчання",
  "landing.one.s4": "Практика",
  "landing.one.s5": "Запам'ятовування",
  "landing.one.s6": "Повторення",
  "landing.one.s7": "Прогрес",
  "landing.faq.title": "Часті запитання",
  "landing.faq.q1": "Чи є Second Brain просто чат-ботом?",
  "landing.faq.a1": "Ні. Це персональне освітнє середовище: воно розуміє ваш контент, навчає йому та запам'ятовує ваш прогрес з часом.",
  "landing.faq.q2": "Чи можу я працювати з кількома PDF-файлами та документами?",
  "landing.faq.a2": "Так. Ви можете групувати PDF-файли, фотографії, скани та нотатки в єдиний предмет і навчатися за повним набором, а не за окремим файлом.",
  "landing.faq.q3": "Що я можу робити з AI Professor?",
  "landing.faq.a3": "Навчайтеся, просіть пояснень, обговорюйте, проводьте керовані сесії та тренуйтеся за допомогою вправ — адаптованих під ваш рівень.",
  "landing.faq.q4": "Чи можу я спілкуватися з AI-професором вголос?",
  "landing.faq.a4": "Так. Голосові розмови, усні вправи та усні іспити дозволяють практикуватися вголос.",
  "landing.faq.q5": "Що таке Цифровий двійник?",
  "landing.faq.a5": "Персоналізована пам'ять про ваше навчання: що ви розумієте, опановуєте, забуваєте та до чого прагнете.",
  "landing.faq.q6": "Як працюють пам'ять і повторення?",
  "landing.faq.a6": "Рушій інтервального повторення (FSRS) планує повторення в потрітний момент, щоб ви запам'ятовували більше з меншими зусиллями.",
  "landing.faq.q7": "Чи можу я використовувати Second Brain для навчання?",
  "landing.faq.a7": "Так. Академічний робочий простір допомагає у лабораторних, домашніх завданнях, звітах тощо, навчаючи методу, а не лише відповіді.",
  "landing.faq.q8": "Як працює вивчення мов?",
  "landing.faq.a8": "Занурення, розмова, усна практика та шейдовінг, а також допомога у розумінні мови вашої власної навчальної програми.",
  "landing.faq.q9": "Як захищені мої дані?",
  "landing.faq.a9": "Ваші навчальні дані покращують ваш досвід. Ви контролюєте свій обліковий запис і можете керувати даними у своєму профілі.",
  "landing.pricing.title": "Виберіть свій рівень навчання",
  "landing.pricing.subtitle": "Досліджуйте → Навчайтеся серйозно → Йдіть до кінця",
  "landing.pricing.billing.monthly": "Щомісяця",
  "landing.pricing.billing.annual": "Щорічно",
  "landing.pricing.billing.saving": "Економія",
  "landing.pricing.free.name": "Безкоштовно",
  "landing.pricing.free.description": "Для дослідження екосистеми Second Brain.",
  "landing.pricing.free.cta": "Почніть безкоштовно",
  "landing.pricing.pro.name": "Pro",
  "landing.pricing.pro.description": "Для серйозного повсякденного навчання.",
  "landing.pricing.pro.badge": "Рекомендовано",
  "landing.pricing.pro.cta": "Перейти на Pro",
  "landing.pricing.max.name": "Max",
  "landing.pricing.max.description": "Для дослідників, інтенсивних студентів і професіоналів.",
  "landing.pricing.max.cta": "Розблокувати Max",
  "landing.final.title": "Ваше навчання заслуговує на більше, ніж просто бібліотека",
  "landing.final.subtitle": "Активуйте свого Цифрового двійника.",
  "landing.footer.tagline": "Ваше персональне навчальне середовище на базі штучного інтелекту.",
  "landing.footer.product": "Продукт",
  "landing.footer.product1": "Функції",
  "landing.footer.product2": "AI-професор",
  "landing.footer.product3": "Бібліотека",
  "landing.footer.product4": "Мій Мозок",
  "landing.footer.product5": "Повторення",
  "landing.footer.learn": "Навчання",
  "landing.footer.learn1": "Мови",
  "landing.footer.learn2": "Академічний простір",
  "landing.footer.learn3": "Розмова",
  "landing.footer.learn4": "Документи",
  "landing.footer.resources": "Ресурси",
  "landing.footer.resources1": "Поширені запитання",
  "landing.footer.resources2": "Допомога",
  "landing.footer.resources3": "Документація",
  "landing.footer.company": "Компанія",
  "landing.footer.company1": "Про нас",
  "landing.footer.company2": "Контакти",
  "landing.footer.legal": "Юридична інформація",
  "landing.footer.legal1": "Конфіденційність",
  "landing.footer.legal2": "Умови",
  "landing.footer.legal3": "Безпека",
  "landing.footer.copy": "© 2026 Second Brain — Ваше персональне навчальне середовище зі штучним інтелектом."
  ,"languageSelector.recent": "Нещодавні"
  ,"languageSelector.nativeLabel": "Рідна мова"
  ,"voice11.state.ready": "Готово"
  ,"voice11.state.listening": "Слухаю"
  ,"voice11.state.transcription": "Транскрибування"
  ,"voice11.state.thinking": "Професор обмірковує"
  ,"voice11.state.response": "Відповідь готова"
  ,"voice11.state.paused": "Запис призупинено"
  ,"voice11.state.error": "Помилка голосового режиму"
  ,"voice11.transcribe": "Зупинити й транскрибувати"
  ,"voice11.pause": "Призупинити"
  ,"voice11.resume": "Продовжити"
  ,"voice11.transcript.edit": "Транскрипція готова — перегляньте або відредагуйте її перед надсиланням."
  ,"state.processing": "Обробка…"
  ,"state.partial": "Деякі результати ще недоступні"
  ,"state.success": "Завершено"
  ,"state.stale": "Показано раніше завантажені дані"
  ,"state.offline": "Ви офлайн"
  ,"state.quota-limited": "Ліміт використання вичерпано"
  ,"learning.notTracked": "Не відстежується"
  ,"profile.kyc.goalsImpact": "Ці цілі спрямовують Повторення, ШІ-професора та вашого Цифрового двійника."
  ,"profile.kyc.languagesEmpty": "Поки немає."
  ,"learn.component.dropTitle": "Перетягніть документ сюди"
  ,"learn.component.dropDetail": "PDF, фото, скан, книга, зошит…"
  ,"learn.component.documentQuestion": "Що це за документ?"
  ,"learn.component.yourTurn": "Ваша черга."
  ,"ai.professor": "ШІ-професор"
  ,"ai.recommendation": "Рекомендація ШІ"
  ,"ai.insight": "Висновок ШІ"
  ,"ai.explanation": "Пояснення"
  ,"ai.warning": "Виявлено складність"
  ,"ai.progress": "Прогрес"
  ,"ai.posture.supportive": "Підтримувальний"
  ,"ai.posture.challenging": "Вимогливий"
  ,"ai.posture.examiner": "Екзаменатор"
  ,"review.due": "на часі"
  ,"profile.card.photo": "Фото профілю"
  ,"profile.card.editPhoto": "Змінити фото профілю"
  ,"profile.card.takePhoto": "Зробити фото"
  ,"profile.card.gallery": "Вибрати з галереї"
  ,"profile.card.avatar": "Або виберіть аватар"
  ,"profile.card.removePhoto": "Видалити фото"
  ,"profile.card.identity": "Особистість і шлях"
  ,"profile.card.name": "Ім’я"
  ,"profile.card.namePh": "Ваше ім’я"
  ,"profile.card.category": "Категорія учня"
  ,"profile.card.curriculum": "Курс / галузь"
  ,"profile.card.level": "Рівень"
  ,"profile.card.institution": "Заклад"
  ,"profile.card.nativeLanguage": "Рідна мова"
  ,"profile.card.studyLanguage": "Мова навчання"
  ,"profile.card.mobility": "Міжнародна мобільність"
  ,"profile.card.mobilityOn": "Ви навчаєтеся мовою, відмінною від рідної: увімкнено автоматичну мовну підтримку й контекстне занурення."
  ,"profile.card.mobilityOff": "Увімкніть це, якщо навчаєтеся мовою, відмінною від рідної."
  ,"profile.card.languageSupport": "🌍 Мовну підтримку ввімкнено"
  ,"profile.card.aiTeacher": "ШІ-професор"
  ,"profile.card.posture": "Стиль викладання"
  ,"profile.card.toneSupportive": "🟢 Підтримувальний"
  ,"profile.card.toneBalanced": "🟡 Вимогливий"
  ,"profile.card.toneDemanding": "🔴 Суворий / Екзаменатор"
  ,"profile.card.explanations": "Пояснення"
  ,"profile.card.explShort": "Короткі"
  ,"profile.card.explBalanced": "Збалансовані"
  ,"profile.card.explDetailed": "Докладні"
  ,"profile.card.cognitive": "Когнітивний профіль (Цифровий двійник)"
  ,"profile.card.strengths": "Ваші сильні сторони"
  ,"profile.card.strengthsEmpty": "Вони з’являтимуться в процесі навчання."
  ,"profile.card.targetRetention": "Цільове запам’ятовування"
  ,"profile.card.target90": "Ціль — 90%"
  ,"profile.card.retentionCurrent": "поточне · ціль 90%"
  ,"profile.card.dailyPace": "Щоденний темп"
  ,"profile.card.minDay": "хв / день"
  ,"profile.card.systemData": "Система й дані"
  ,"profile.card.theme": "Тема"
  ,"profile.card.light": "☀︎ Світла"
  ,"profile.card.dark": "☾ Темна"
  ,"profile.card.system": "⚙︎ Системна"
  ,"profile.card.statistics": "Статистика"
  ,"profile.card.concepts": "понять"
  ,"profile.card.reviews": "повторень"
  ,"profile.card.privacyMemory": "Конфіденційність і пам’ять"
  ,"profile.card.privacyData": "🔒 Конфіденційність і дані"
  ,"profile.card.vectorMemory": "🧠 Керувати векторною пам’яттю"
  ,"profile.card.cat.child": "Дитина"
  ,"profile.card.cat.student": "Студент"
  ,"profile.card.cat.researcher": "Дослідник"
  ,"profile.card.cat.adult": "Дорослий"
  ,"profile.card.cat.language": "Той, хто вивчає мову"
  ,"brain.panel.overview": "Огляд"
  ,"brain.panel.mastered": "опановано"
  ,"brain.panel.fragile": "нестійке"
  ,"brain.panel.average": "середній рівень опанування"
  ,"brain.panel.cognitive": "Когнітивний профіль"
  ,"brain.panel.cognitiveEmpty": "Даних для побудови вашого профілю поки недостатньо."
  ,"brain.panel.indicators": "Внутрішні показники опанування, а не шкільні оцінки."
  ,"brain.panel.maturity": "зрілість"
  ,"brain.panel.dnaEmpty": "Ваше Навчальне ДНК формується в міру завершення сесій."
  ,"brain.panel.dnaNote": "Спостереження, що розвиваються, а не діагноз."
  ,"brain.panel.studied": "вивчено"
  ,"brain.panel.toReview": "до повторення"
  ,"brain.panel.memoryNote": "Second Brain автоматично відстежує, як змінюються ваші знання."
  ,"brain.panel.attention": "Що потребує вашої уваги"
  ,"brain.panel.reviewNow": "Повторити зараз"
  ,"brain8.intro": "Живе представлення того, що ви знаєте, як навчаєтеся, що стає нестійким і що робити далі."
  ,"brain8.nav.overview": "Огляд"
  ,"brain8.nav.knowledge": "Знання"
  ,"brain8.nav.learning": "Як я навчаюся"
  ,"brain8.nav.memory": "Пам’ять"
  ,"brain8.nav.history": "Історія"
  ,"brain8.map.title": "Ваша жива мапа знань"
  ,"brain8.maturity.sparse": "Формується"
  ,"brain8.maturity.medium": "Пов’язана"
  ,"brain8.maturity.dense": "Готова до дослідження"
  ,"brain8.maturity.sparse.detail": "Second Brain починає з ваших перших реальних джерел і дій."
  ,"brain8.maturity.medium.detail": "Ваші поняття, практика й джерела вже виявляють корисні закономірності."
  ,"brain8.maturity.dense.detail": "Ваша мапа має достатньо доказів для цілеспрямованого дослідження та фільтрації."
  ,"brain8.metrics.concepts": "понять"
  ,"brain8.metrics.connections": "зв’язків"
  ,"brain8.metrics.events": "навчальних подій"
  ,"brain8.sparse.title": "Ваш мозок формується"
  ,"brain8.sparse.detail": "Навчайтеся, імпортуйте джерело або поставте ціль. Кожна реальна взаємодія збагачуватиме це представлення."
  ,"brain8.action.learn": "Почати навчання"
  ,"brain8.action.import": "Імпортувати джерело"
  ,"brain8.action.goal": "Поставити ціль"
  ,"brain8.recent.documents": "Нещодавні джерела"
  ,"brain8.recent.knowledge": "Нещодавно активні знання"
  ,"brain8.openKnowledge": "Дослідити"
  ,"brain8.knowledge.empty": "Відповідного поняття поки немає."
  ,"brain8.knowledge.list": "Доступний список"
  ,"brain8.knowledge.graph": "Візуальна мапа"
  ,"brain8.graph.bounded": "Завантажено {shown} із {total} понять. Скористайтеся пошуком або завантажте більше, щоб звузити мапу."
  ,"brain8.loadMore": "Завантажити більше"
  ,"brain8.mastery.unknown": "Не виміряно"
  ,"brain8.mastery.unknown.detail": "Опанування не вимірюється, доки немає достатніх доказів із повторень."
  ,"brain8.mastery.value": "Орієнтовне опанування: {value}%"
  ,"brain8.strength.title": "Сильні сторони й нестійкі знання"
  ,"brain8.strength.note": "Ці показники походять із повторених знань, а не зі шкільних оцінок."
  ,"brain8.nba.badge": "Найкраща наступна дія"
  ,"brain8.nba.learn.title": "Зрозуміти {concept}"
  ,"brain8.nba.learn.reason": "Це поняття готове або вже опрацьовується на вашому поточному шляху знань."
  ,"brain8.nba.learn.action": "Запитати Професора"
  ,"brain8.nba.review.title": "Закріпити {concept}"
  ,"brain8.nba.review.reason": "Ваші наявні сигнали повторення й пам’яті вказують, що це поняття потребує уваги."
  ,"brain8.nba.review.action": "Повторити зараз"
  ,"brain8.nba.why": "Чому саме це?"
  ,"brain8.nba.hideWhy": "Сховати пояснення"
  ,"brain8.nba.due": "На часі {count} пов’язаних повторень."
  ,"brain8.memory.title": "Навчальна пам’ять"
  ,"brain8.memory.reviews": "повторень завершено"
  ,"brain8.memory.due": "повторень на часі"
  ,"brain8.memory.sources": "джерел вивчено"
  ,"brain8.memory.note": "Тут враховуються лише збережені уроки, джерела й повторення."
  ,"brain8.memory.open": "Відкрити пам’ять"
  ,"brain8.memory.fragile": "Знання для закріплення"
  ,"brain8.memory.review": "Відкрити Повторення"
  ,"brain8.declared.title": "Що я повідомив Second Brain"
  ,"brain8.declared.detail": "Ваші явні налаштування навчання й Професора."
  ,"brain8.declared.empty": "Заявлених уподобань поки немає. Ви можете заповнити їх у профілі."
  ,"brain8.observed.title": "Що спостерігає Second Brain"
  ,"brain8.observed.detail": "Закономірності з реальних взаємодій, які показуються лише за достатніх доказів."
  ,"brain8.observed.empty": "Активності поки недостатньо, щоб визначити надійну закономірність."
  ,"brain8.observed.evidence": "На основі {count} зафіксованих взаємодій."
  ,"brain8.observed.style.voice": "Часто використовує голос"
  ,"brain8.observed.style.handsOn": "Навчається через практику"
  ,"brain8.observed.style.reading": "Навчається через читання"
  ,"brain8.observed.depth.simple": "Віддає перевагу стислим поясненням"
  ,"brain8.observed.depth.balanced": "Використовує збалансовані пояснення"
  ,"brain8.observed.depth.deep": "Працює з докладними поясненнями"
  ,"brain8.observed.rhythm.occasional": "Нерегулярний ритм"
  ,"brain8.observed.rhythm.regular": "Регулярний ритм"
  ,"brain8.observed.rhythm.intensive": "Інтенсивний ритм"
  ,"brain8.observed.focus.morning": "Активніший уранці"
  ,"brain8.observed.focus.afternoon": "Активніший удень"
  ,"brain8.observed.focus.evening": "Активніший увечері"
  ,"brain8.observed.focus.night": "Активніший уночі"
  ,"brain8.dna.title": "Навчальне ДНК"
  ,"brain8.dna.note": "Спостереження, що розвиваються, а не діагноз чи незмінна ідентичність."
  ,"brain8.dna.empty": "Навчальне ДНК з’явиться, коли повторні взаємодії нададуть достатньо доказів."
  ,"brain8.history.title": "Когнітивна історія"
  ,"brain8.history.empty": "Навчальних подій поки не зафіксовано."
  ,"brain8.history.kind.lesson": "Урок"
  ,"brain8.history.kind.success": "Правильна відповідь"
  ,"brain8.history.kind.error": "Виправлена помилка"
  ,"brain8.history.kind.revision": "Повторення"
  ,"brain8.history.kind.conversation": "Розмова з Професором"
  ,"brain8.history.kind.homework": "Домашнє завдання"
  ,"brain8.history.kind.report": "Завершена сесія"
  ,"brain8.history.kind.document": "Джерело додано"
  ,"brain8.history.kind.concept": "Поняття додано"
  ,"brain8.history.kind.connection": "Зв’язок створено"
  ,"brain8.foresight.title": "Прогноз траєкторії"
  ,"brain8.foresight.forecast": "Прогноз"
  ,"brain8.foresight.note": "Це оцінка на основі поточних сигналів, а не факт."
  ,"brain8.foresight.action": "Переглянути запропоновану дію"
  ,"brain8.foresight.kind.dropout": "Ризик втрати безперервності"
  ,"brain8.foresight.kind.difficulty": "Ризик складності"
  ,"brain8.foresight.kind.overload": "Ризик перевантаження"
  ,"brain8.foresight.kind.motivation": "Ризик втрати мотивації"
  ,"brain8.foresight.kind.forgetting": "Ризик забування"
  ,"brain8.foresight.reason.dropout": "Ваші нещодавні сигнали безперервності вказують на можливе переривання поточного ритму."
  ,"brain8.foresight.reason.difficulty": "Ваш поточний шлях опанування вказує на можливу складність попереду."
  ,"brain8.foresight.reason.overload": "Ваші поточні сигнали навантаження вказують на можливе перевантаження."
  ,"brain8.foresight.reason.motivation": "Ваші нещодавні сигнали активності вказують на можливу втрату темпу."
  ,"brain8.foresight.reason.forgetting": "Прогноз повторень вказує, що деякі знання може стати складніше пригадати."
  ,"brain8.search.label": "Пошук у вашому мозку"
  ,"brain8.search.placeholder": "Поняття, джерело або ціль…"
  ,"brain8.search.action": "Шукати"
  ,"brain8.search.kind.concept": "Поняття"
  ,"brain8.search.kind.document": "Джерело"
  ,"brain8.search.kind.goal": "Ціль"
  ,"brain8.ask.title": "Запитайте свій мозок…"
  ,"brain8.ask.detail": "Second Brain відповідає лише на основі ваших понять і джерел."
  ,"brain8.ask.placeholder": "Що я знаю про мережі?"
  ,"brain8.ask.action": "Запитати"
  ,"brain8.ask.answer.weakest": "За сигналами опанування знайдено {count} нестійких понять."
  ,"brain8.ask.answer.neglected": "Знайдено {count} понять із повтореннями на часі."
  ,"brain8.ask.answer.documents": "Знайдено {count} відповідних джерел або понять."
  ,"brain8.ask.answer.knowledge": "У вашому мозку знайдено {count} відповідних елементів."
  ,"brain8.ask.answer.no-results": "Ваші поточні дані не дають підстав для відповіді на це запитання."
  ,"brain8.ask.grounded": "Відповідь обмежена вашими збереженими даними Second Brain."
  ,"brain8.concept.pick": "Виберіть поняття, щоб переглянути його докази й зв’язки."
  ,"brain8.concept.cards": "{count} карток"
  ,"brain8.concept.due": "{count} на часі"
  ,"brain8.concept.stability": "{days} днів стабільності пам’яті"
  ,"brain8.concept.nextReview": "Наступне заплановане повторення: {date}"
  ,"brain8.concept.tutor": "Запитати Професора"
  ,"brain8.concept.practice": "Практикуватися"
  ,"brain8.concept.review": "Повторити"
  ,"brain8.concept.sources": "Джерела"
  ,"brain8.concept.relations": "Зв’язки"
  ,"brain8.concept.activity": "Нещодавні взаємодії"
  ,"brain8.concept.truncated": "Показано лише перші доступні джерела."
  ,"brain8.relation.prerequisite": "передумова"
  ,"brain8.relation.related": "пов’язане"
  ,"brain8.context.document": "Активний документ"
  ,"brain8.context.session": "Сесія з Професором"
  ,"brain8.context.goal": "Навчальна ціль"
  ,"brain8.partial": "Деякі розділи тимчасово недоступні; доступні дані залишаються придатними до використання."
  ,"brain8.error.load": "Зараз не вдалося завантажити ваш мозок."
  ,"tutor6.result.brain": "Переглянути вплив на мій Мозок"
  ,"voice.error.playback": "Не вдалося відтворити голос вашого викладача."
  ,"voice.error.blocked": "Відтворення аудіо заблоковано."
  ,"voice.error.recordUnsupported": "Запис аудіо недоступний на цьому пристрої."
  ,"voice.error.micDenied": "Доступ до мікрофона відхилено. Дозвольте доступ і спробуйте ще раз."
  ,"voice.error.notRecording": "Запис не триває."
  ,"voice.error.empty": "Нічого не записано. Перевірте мікрофон і спробуйте ще раз."
  ,"error.timeout": "Запит тривав надто довго. Спробуйте ще раз."
  ,"error.unauthorized": "Ваша сесія завершилася або облікові дані недійсні."
  ,"error.forbidden": "Ця дія недоступна для цього облікового запису."
  ,"error.notFound": "Запитаний елемент більше недоступний."
  ,"error.conflict": "Ця зміна конфліктує з поточним станом. Оновіть і спробуйте ще раз."
  ,"error.rateLimit": "Забагато спроб. Зачекайте мить і спробуйте ще раз."
  ,"error.validation": "Деякі дані недійсні. Перевірте поля й спробуйте ще раз."
  ,"error.upload": "Завантаження не вдалося. Наявну роботу збережено."
  ,"error.download": "Не вдалося завантажити файл. Спробуйте ще раз."
  ,"onb.languages.explanation": "Мова пояснень"
  ,"onb.languages.explanationWhy": "ШІ-професор використовує цю мову для загальних пояснень і настанов."
  ,"mfa.title": "Двоетапна перевірка"
  ,"mfa.intro": "Захистіть обліковий запис кодом із застосунку-автентифікатора."
  ,"mfa.profileTitle": "Безпека облікового запису"
  ,"mfa.profileDetail": "Налаштуйте двоетапну перевірку на захищеному вебекрані підключення."
  ,"mfa.open": "Налаштувати двоетапну перевірку"
  ,"mfa.idleTitle": "Додати застосунок-автентифікатор"
  ,"mfa.idleDetail": "Починайте лише тоді, коли автентифікатор готовий. Буде створено новий приватний ключ налаштування."
  ,"mfa.start": "Почати захищене налаштування"
  ,"mfa.setupTitle": "Підключіть автентифікатор"
  ,"mfa.setupDetail": "Додайте обліковий запис вручну за допомогою ключа нижче або імпортуйте URI otpauth у сумісний автентифікатор."
  ,"mfa.secretLabel": "Ручний ключ Base32"
  ,"mfa.secretWarning": "Поводьтеся з цим ключем як із паролем. Не передавайте його й не зберігайте в незахищеній нотатці."
  ,"mfa.uriLabel": "URI автентифікатора"
  ,"mfa.uriDetail": "Використовуйте це лише в автентифікаторі, якому довіряєте."
  ,"mfa.codeLabel": "6-значний код автентифікації"
  ,"mfa.codeHint": "Введіть поточний 6-значний код з автентифікатора."
  ,"mfa.enable": "Перевірити й увімкнути"
  ,"mfa.alreadyEnabled": "Двоетапну перевірку, можливо, уже ввімкнено. Вийдіть і ввійдіть знову, щоб перевірити."
  ,"mfa.setupError": "Не вдалося почати захищене налаштування. Нічого не ввімкнено. Спробуйте ще раз."
  ,"mfa.enableError": "Не вдалося перевірити код. Перевірте поточний код і спробуйте ще раз."
  ,"mfa.recoveryTitle": "Збережіть коди відновлення зараз"
  ,"mfa.recoveryWarning": "Ці коди показуються лише один раз."
  ,"mfa.recoveryDetail": "Збережіть їх у надійному менеджері паролів або іншому безпечному місці, перш ніж залишити цей екран."
  ,"mfa.saved": "Я зберіг коди відновлення"
  ,"mfa.doneTitle": "Двоетапну перевірку ввімкнено"
  ,"mfa.doneDetail": "Під час наступного входу знадобиться автентифікатор або один невикористаний код відновлення."
  ,"mfa.backProfile": "Назад до Профілю"
  ,"nav.back": "Назад"
  ,"shell.backToApp": "Назад до застосунку"
  ,"shell.adminArea": "Адміністрування"
  ,"shell.technicalArea": "Технічна зона"
  ,"shell.demoArea": "Демонстраційна зона"
  ,"shell.legacyArea": "Застарілий інтерфейс"
  ,"shell.designSystem": "Дизайн-система"
  ,"learn.backToLearn": "Назад до Навчання"
  ,"learn.free.kicker": "Вільний пошук"
  ,"learn.free.title": "Запитайте будь-що"
  ,"learn.free.subtitle": "Спонтанне запитання — академічне, технічне або загальне. Це не те саме, що ваш педагогічний ШІ-професор."
  ,"learn.free.placeholder": "Введіть запитання…"
  ,"learn.free.submit": "Запитати"
  ,"learn.deep.kicker": "Поглиблене дослідження"
  ,"learn.deep.title": "Дослідіть тему глибоко"
  ,"learn.deep.subtitle": "Професор ґрунтовно досліджує вашу тему й надає структурований аналіз."
  ,"learn.deep.placeholder": "Що ви хочете дослідити поглиблено?"
  ,"learn.deep.submit": "Дослідити"
  ,"learn.deep.frame": "Надай ґрунтовний структурований аналіз (контекст, ключові тези, нюанси, висновок) щодо:"
  ,"learn.deep.note": "Актуальні джерела й покроковий план дослідження з’являться в міру розвитку бекенду."
  ,"learn.oral.kicker": "Усна вправа"
  ,"learn.oral.title": "Відповідайте вголос"
  ,"learn.oral.subtitle": "Професор ставить запитання; відповідайте голосом, і він вас оцінить."
  ,"learn.oral.frame": "Проведи коротку усну вправу відповідно до мого профілю. Став по одному запитанню; я відповідатиму голосом."
  ,"learn.oral.record": "Відповісти голосом"
  ,"learn.oral.stop": "Зупинити"
  ,"learn.oral.ready": "Готово"
  ,"learn.oral.recording": "Слухаю…"
  ,"learn.oral.analyzing": "Аналіз…"
  ,"learn.oral.you": "Ви"
  ,"learn.oral.teacher": "Професор"
  ,"learn.oral.noVoice": "Запис голосу недоступний на цьому пристрої."
  ,"learn.oral.starting": "Підготовка вправи…"
  ,"learn.explain.kicker": "Пояснити"
  ,"learn.explain.title": "Отримайте пояснення поняття"
  ,"learn.explain.subtitle": "Зрозуміле пояснення з прикладами й аналогіями на вибраному вами рівні."
  ,"learn.explain.levelLabel": "Рівень"
  ,"learn.explain.lvlBeginner": "Початковий"
  ,"learn.explain.lvlIntermediate": "Середній"
  ,"learn.explain.lvlAdvanced": "Просунутий"
  ,"learn.explain.placeholder": "Яке поняття ви хочете зрозуміти?"
  ,"learn.explain.submit": "Пояснити"
  ,"learn.explain.frame": "Поясни це поняття зрозуміло, з прикладами й аналогіями. Рівень:"
  ,"learn.discuss.kicker": "Розмова"
  ,"learn.discuss.title": "Поговоріть із Професором"
  ,"learn.discuss.subtitle": "Вільна педагогічна розмова — Професор знає ваш рівень і цілі."
  ,"learn.discuss.placeholder": "Про що ви хотіли б поговорити?"
  ,"learn.discuss.submit": "Почати"
  ,"learn.exam.kicker": "Усний іспит"
  ,"learn.exam.title": "Симуляція усного іспиту"
  ,"learn.exam.subtitle": "Професор стає екзаменатором: ставить запитання, ви відповідаєте вголос, а потім він вас оцінює."
  ,"learn.exam.consignes": "Відповідайте вголос, по одному запитанню. Не поспішайте."
  ,"learn.exam.start": "Почати іспит"
  ,"learn.exam.starting": "Початок іспиту…"
  ,"learn.exam.elapsed": "Час"
  ,"learn.exam.examiner": "Екзаменатор"
  ,"learn.exam.end": "Завершити іспит"
  ,"learn.exam.evaluating": "Оцінювання…"
  ,"learn.exam.startFrame": "Проведи для мене усний іспит. Коротко оголоси тему, а потім постав перше запитання. По одному запитанню; я відповідатиму вголос."
  ,"learn.exam.endFrame": "Заверши іспит зараз. Надай оцінку: сильні сторони, що покращити й рекомендації. Будь педагогічним."
  ,"teach.kicker": "Навчити"
  ,"teach.title": "Чого вас навчити?"
  ,"teach.subtitle": "Назвіть тему, і Професор побудує для вас покроковий урок."
  ,"teach.placeholder": "Наприклад: фотосинтез, Французька революція, похідні…"
  ,"teach.submit": "Створити урок"
  ,"learn.mode.errTitle": "Невідомий формат навчання"
  ,"learn.mode.errDetail": "Такого режиму навчання не існує або він ще недоступний."
  ,"home4.loading": "Підготовка наступної корисної дії…"
  ,"home4.context.new": "Побудуймо ваш Second Brain."
  ,"home4.context.active": "Ось найкорисніший наступний крок з огляду на ваш поточний прогрес."
  ,"home4.context.exam": "Ваш іспит із теми «{focus}» наближається."
  ,"home4.context.revision": "У вашій пам’яті є справді актуальна робота."
  ,"home4.context.resume": "Ви можете продовжити «{focus}», не втрачаючи контексту."
  ,"home4.context.caught-up": "Ви все надолужили. Штучної терміновості немає."
  ,"home4.recommended": "Рекомендовано зараз"
  ,"home4.whyClose": "Сховати причини"
  ,"home4.whyIntro": "На основі цих перевірних сигналів:"
  ,"home4.confidence": "Орієнтовна впевненість: {value}%"
  ,"home4.resume": "Продовжити з місця зупинки"
  ,"home4.resumeDetail": "Останні сесії зберігають свій контекст і вашу роботу."
  ,"home4.resumeAction": "Продовжити"
  ,"home4.session.type.learning": "Навчання"
  ,"home4.session.type.tutor": "Репетитор"
  ,"home4.session.type.research": "Дослідження"
  ,"home4.session.type.review": "Повторення"
  ,"home4.session.type.language": "Мова"
  ,"home4.session.type.workspace": "Робочий простір"
  ,"home4.session.type.document-processing": "Документ"
  ,"home4.lastActivity": "Остання активність"
  ,"home4.artifact": "Остання робота"
  ,"home4.upcoming": "Незабаром"
  ,"home4.upcomingDetail": "Наступні навчальні події, що потребують вашої уваги."
  ,"home4.upcomingEmpty": "Найближчим часом нічого не заплановано."
  ,"home4.planning": "Навчальний календар"
  ,"home4.upcoming.kind.exam": "Іспит"
  ,"home4.upcoming.kind.homework": "Домашнє завдання"
  ,"home4.upcoming.kind.practical": "Практична робота"
  ,"home4.upcoming.kind.language": "Мовна практика"
  ,"home4.upcoming.kind.aiSession": "Сесія ШІ"
  ,"home4.upcoming.kind.revision": "Повторення"
  ,"home4.upcoming.kind.quiz": "Вікторина"
  ,"home4.upcoming.kind.objective": "Ціль"
  ,"home4.upcoming.kind.deadline": "Кінцевий термін"
  ,"home4.mainGoal": "Головна ціль"
  ,"home4.goal.period.daily": "Щоденна ціль"
  ,"home4.goal.period.weekly": "Щотижнева ціль"
  ,"home4.goal.period.monthly": "Щомісячна ціль"
  ,"home4.goal.open": "Відкрити ціль"
  ,"home4.progress.title": "Ваш прогрес"
  ,"home4.progress.detail": "Стислий огляд змін у вашому навчанні."
  ,"home4.progress.due": "повторень на часі"
  ,"home4.progress.mastered": "понять опановано"
  ,"home4.progress.streak": "днів поспіль"
  ,"home4.progress.open": "Відкрити Мій Мозок"
  ,"home4.other": "Інші способи почати"
  ,"home4.otherDetail": "Зафіксуйте або висловіть щось, якщо рекомендація не відповідає вашій потребі."
  ,"home4.date.today": "Сьогодні"
  ,"home4.date.tomorrow": "Завтра"
  ,"home4.date.yesterday": "Учора"
  ,"home4.date.unknown": "Невідома дата"
  ,"home4.partial": "Деякі джерела тимчасово недоступні. Доступні пріоритети все одно використовують перевірені дані."
  ,"home4.stale": "Показано останню доступну Головну сторінку, поки триває повторне оновлення."
  ,"home4.unavailable": "Зараз не вдалося завантажити жодного перевіреного пріоритету."
  ,"learn5.eyebrow": "Навчання"
  ,"learn5.title": "Почніть із того, чого хочете досягти"
  ,"learn5.subtitle": "Запитуйте, говоріть, знімайте або імпортуйте. Second Brain вибере наявний формат відповідно до вашого наміру й збереже контекст."
  ,"learn5.question": "Чого ви хочете навчитися або що зробити?"
  ,"learn5.composer.badge": "Єдина розумна точка входу"
  ,"learn5.composer.detail": "Опишіть результат своїми словами. Вибирати намір необов’язково."
  ,"learn5.composer.placeholder": "Наприклад: поясни фотосинтез, допоможи практикувати іспанську або створи вікторину з моїх нотаток…"
  ,"learn5.composer.inputLabel": "Чого ви хочете навчитися або досягти"
  ,"learn5.composer.submit": "Продовжити"
  ,"learn5.examples.label": "Спробуйте щось із цього"
  ,"learn5.examples.understand": "Зрозуміти тему"
  ,"learn5.examples.understandPrompt": "Поясни мені цю тему: "
  ,"learn5.examples.practice": "Практикувати мову"
  ,"learn5.examples.practicePrompt": "Допоможи мені практикувати розмовну англійську"
  ,"learn5.examples.scan": "Відсканувати сторінку"
  ,"learn5.examples.import": "Імпортувати курс"
  ,"learn5.intent.label": "Намір (необов’язково)"
  ,"learn5.intent.understand": "Зрозуміти"
  ,"learn5.intent.learn": "Навчитися"
  ,"learn5.intent.practice": "Практикуватися"
  ,"learn5.intent.research": "Дослідити"
  ,"learn5.intent.create": "Створити"
  ,"learn5.intent.suggested": "запропоновано"
  ,"learn5.depth.label": "Глибина дослідження"
  ,"learn5.depth.quick": "Швидка відповідь"
  ,"learn5.depth.standard": "Дослідження"
  ,"learn5.depth.deep": "Поглиблене дослідження"
  ,"learn5.modality.write": "Писати"
  ,"learn5.modality.speak": "Говорити"
  ,"learn5.modality.capture": "Зняти"
  ,"learn5.modality.import": "Імпортувати"
  ,"learn5.modality.export": "Експортувати"
  ,"learn5.modality.exportData": "Відкрити експорт ваших даних"
  ,"learn5.route.prefix": "Далі:"
  ,"learn5.route.capture": "відкрити сканер, переглянути сторінки й підтвердити."
  ,"learn5.route.import": "імпортувати цей файл у Бібліотеку та її конвеєр розуміння."
  ,"learn5.route.voice": "почати голосову репліку з вашим ШІ-професором."
  ,"learn5.route.free-question": "запитати безпосередньо вашого ШІ-професора."
  ,"learn5.route.document-understanding": "поставити запитання про активний документ і отримати обґрунтовані відповіді."
  ,"learn5.route.concept-explanation": "відкрити цільове пояснення активного поняття."
  ,"learn5.route.explanation": "попросити ШІ-професора надати структуроване пояснення."
  ,"learn5.route.lesson": "створити керований урок на цю тему."
  ,"learn5.route.guided-session": "почати наявний формат керованої сесії."
  ,"learn5.route.learning-path": "відкрити ваш адаптивний навчальний шлях."
  ,"learn5.route.document-learning": "навчатися з активного документа."
  ,"learn5.route.practice": "підготувати практичну вправу."
  ,"learn5.route.document-practice": "створити формат практики з активного документа."
  ,"learn5.route.oral-practice": "відкрити усну практику з Професором."
  ,"learn5.route.language-practice": "продовжити у спеціалізованому мовному просторі."
  ,"learn5.route.research-quick": "отримати стислу відповідь від Професора."
  ,"learn5.route.research-library": "дослідити всю вашу Бібліотеку й видимі джерела."
  ,"learn5.route.research-deep": "відкрити розширений формат поглибленого дослідження."
  ,"learn5.route.create-quiz": "підготувати вікторину в просторі оцінювання."
  ,"learn5.route.create-course": "створити керований курс."
  ,"learn5.route.create-work": "відкрити Академічний простір із цими вказівками."
  ,"learn5.route.create-from-document": "створити з активного документа."
  ,"learn5.clarify.question": "Що ви хотіли б зробити з цією темою?"
  ,"learn5.deep.confirmTitle": "Поглиблене дослідження використовує розширений процес"
  ,"learn5.deep.confirmDetail": "Це може тривати довше й використати більше вашого ліміту. Запит залишиться збереженим, якщо сервіс недоступний."
  ,"learn5.deep.confirm": "Підтвердити поглиблене дослідження"
  ,"learn5.attachment.ready": "готово до імпорту"
  ,"learn5.attachment.remove": "Видалити"
  ,"learn5.attachment.import": "Імпортувати й продовжити"
  ,"learn5.attachment.error": "Не вдалося вибрати цей файл."
  ,"learn5.attachment.missing": "Виберіть файл ще раз перед імпортом."
  ,"learn5.capture.title": "Зняти або імпортувати"
  ,"learn5.capture.detail": "Скан попередньо переглядається перед завантаженням. Файли потрапляють до того самого конвеєра розуміння документів."
  ,"learn5.capture.scan": "Сфотографувати або відсканувати сторінку"
  ,"learn5.capture.file": "Вибрати файл"
  ,"learn5.voice.stop": "Зупинити й надіслати"
  ,"learn5.voice.error": "Не вдалося завершити запис."
  ,"learn5.voice.missing": "Немає готового запису для надсилання."
  ,"learn5.voice.unavailable": "Мікрофон недоступний на цьому пристрої"
  ,"learn5.error.generic": "Не вдалося почати цю дію."
  ,"learn5.error.preserved": "Ваш текст, контекст і вкладення збережено. Можна повторити спробу або скористатися іншою функцією без ШІ."
  ,"learn5.draft.restored": "Чернетку відновлено"
  ,"learn5.draft.restoredDetail": "Ваш попередній запит і його контекст залишилися тут."
  ,"learn5.draft.clear": "Очистити"
  ,"learn5.cancel": "Скасувати"
  ,"learn5.context.user-profile": "Профіль"
  ,"learn5.context.brain": "Мій Мозок"
  ,"learn5.context.document": "Документ"
  ,"learn5.context.document-collection": "Колекція документів"
  ,"learn5.context.concept": "Поняття"
  ,"learn5.context.lesson": "Урок"
  ,"learn5.context.goal": "Ціль"
  ,"learn5.context.exam": "Іспит"
  ,"learn5.context.language": "Мова навчання"
  ,"learn5.context.workspace": "Робочий простір"
  ,"learn5.context.tutor-session": "Сесія з репетитором"
  ,"learn5.context.research": "Дослідження"
  ,"learn5.context.revision": "Повторення"
  ,"learn5.context.learning-path": "Навчальний шлях"
  ,"learn5.resume.unavailable": "Сесії тимчасово недоступні"
  ,"learn5.resume.unavailableDetail": "Поле введення залишається доступним, а чернетку буде збережено."
  ,"learn5.spaces.title": "Спеціалізовані простори"
  ,"learn5.spaces.detail": "Відкрийте окреме середовище, коли це корисно для завдання."
  ,"learn5.spaces.languages": "Мови"
  ,"learn5.spaces.languagesDetail": "Занурення, вимова й розмова."
  ,"learn5.spaces.library": "Бібліотека"
  ,"learn5.spaces.libraryDetail": "Ваші документи й джерела в одному місці."
  ,"learn5.spaces.workspace": "Академічний простір"
  ,"learn5.spaces.workspaceDetail": "Створюйте й удосконалюйте структуровані академічні роботи."
  ,"learn5.advanced.title": "Розширені режими"
  ,"learn5.advanced.detail": "Наявні спеціалізовані формати для безпосереднього керування."
  ,"learn5.advanced.explain": "Пояснити"
  ,"learn5.advanced.teach": "Навчити мене"
  ,"learn5.advanced.guided": "Керована сесія"
  ,"learn5.advanced.oral": "Усна практика"
  ,"learn5.advanced.exam": "Усний іспит"
  ,"learn5.advanced.deep": "Поглиблене дослідження"
  ,"teacher.mode.lesson": "Урок"
  ,"teacher.mode.exercise": "Вправа"
  ,"teacher.mode.training": "Тренування"
  ,"teacher.mode.assessed": "Оцінювання"
  ,"teacher.mode.exam": "Іспит"
  ,"teacher.exam.rulesTitle": "Правила іспиту"
  ,"teacher.exam.mode": "Режим іспиту"
  ,"teacher.exam.grading": "Виставлення оцінки"
  ,"teacher.exam.rubric": "Критерії оцінювання"
  ,"teacher.exam.help": "Дозволена допомога"
  ,"teacher.exam.helpLimited": "Обмежена допомога"
  ,"teacher.exam.helpNone": "Без допомоги"
  ,"teacher.exam.feedbackAfter": "Відгук після здачі"
  ,"profile.intro": "Керуйте особистими даними, налаштуваннями Second Brain, мовами, тарифом і даними."
  ,"profile.section.myProfile": "Мій профіль"
  ,"profile.section.myProfileDetail": "Ваша особистість і навчальний контекст, що використовуються в усьому продукті."
  ,"profile.section.personalization": "Персоналізація Second Brain"
  ,"profile.section.personalizationDetail": "Виберіть, як навчає ваш ШІ-професор. Докладне Навчальне ДНК залишається в Моєму Мозку."
  ,"profile.section.languages": "Мови й досвід"
  ,"profile.section.languagesDetail": "Налаштуйте мову інтерфейсу окремо від мови, яку вивчаєте."
  ,"profile.section.billing": "Підписка й використання"
  ,"profile.section.billingDetail": "Перегляньте поточний тариф, реальні ліміти, залишок використання й дати скидання."
  ,"profile.section.privacy": "Дані й конфіденційність"
  ,"profile.section.privacyDetail": "Керуйте виглядом, пам’яттю ШІ, документами, згодами й особистими даними."
  ,"profile.billing.current": "Поточний тариф"
  ,"profile.billing.unavailable": "Тариф недоступний"
  ,"profile.billing.usageUnavailable": "Дані про використання тимчасово недоступні."
  ,"profile.billing.viewUsage": "Переглянути використання й квоти"
  ,"profile.brainPreview.title": "Навчальний профіль"
  ,"profile.brainPreview.detail": "Короткий огляд. Ваше Навчальне ДНК, пам’ять і опанування містяться в Моєму Мозку."
  ,"profile.brainPreview.empty": "Навчальний профіль з’являтиметься в міру завершення сесій."
  ,"profile.brainPreview.open": "Відкрити Мій Мозок"
  ,"profile.languages.specialized": "Мова інтерфейсу відокремлена від мови, яку ви вивчаєте."
  ,"profile.languages.open": "Відкрити Мови й занурення"
  ,"profile.privacy.detail": "Докладні налаштування конфіденційності й пам’яті доступні будь-коли."
  ,"profile.privacy.memory": "Пам’ять ШІ"
  ,"profile.privacy.documents": "Мої документи"
  ,"profile.partial": "Не вдалося оновити частину профілю. Доступними налаштуваннями й далі можна користуватися."
  ,"profile.teacher.title": "Мій ШІ-професор"
  ,"profile.teacher.detail": "Менш вимогливий дає більше підказок і повторних спроб; Звичайний працює жваво, доброзичливо й структуровано; Вимогливий просить глибших міркувань і точних виправлень."
  ,"profile.teacher.auto": "Автоматична адаптація"
  ,"profile.teacher.autoDetail": "Second Brain адаптує настанови, темп і складність за вашим реальним прогресом. Поза оголошеними оцінюваннями типовим є Звичайний режим."
  ,"profile.teacher.learning": "Рівень викладання"
  ,"profile.teacher.learning.guided": "Менш вимогливий"
  ,"profile.teacher.learning.balanced": "Звичайний"
  ,"profile.teacher.learning.demanding": "Вимогливий"
  ,"profile.teacher.conversation": "Режим розмови"
  ,"profile.teacher.conversation.training": "Тренування"
  ,"profile.teacher.conversation.assessed": "Оцінювання"
  ,"profile.teacher.conversation.trainingDetail": "Практикуйтеся вільно з підказками й виправленнями."
  ,"profile.teacher.conversation.assessedDetail": "Пройдіть оголошену оцінювану розмову з обмеженою допомогою й відгуком на основі доказів."
  ,"profile.teacher.exam": "Режим іспиту"
  ,"profile.teacher.exam.standard": "Стандартний"
  ,"profile.teacher.exam.strict": "Суворий"
  ,"profile.teacher.examDetail": "Правила іспиту визначають доступну допомогу, оцінювання й час надання відгуку."
  ,"profile.teacher.advancedOpen": "Показати розширені налаштування"
  ,"profile.teacher.advancedClose": "Сховати розширені налаштування"
  ,"profile.teacher.correction": "Час виправлення"
  ,"profile.teacher.correction.immediate": "Виправляти одразу"
  ,"profile.teacher.correction.let_me_finish": "Дати мені завершити"
  ,"profile.teacher.correction.adaptive": "Адаптуватися до ситуації"
  ,"profile.teacher.summary": "Підсумок сесії"
  ,"profile.teacher.encouragement": "Заохочення"
  ,"profile.teacher.encouragement.measured": "Стримане"
  ,"profile.teacher.encouragement.supportive": "Підтримувальне"
  ,"profile.teacher.reset": "Відновити типові налаштування"
  ,"profile.settings.saveError": "Не вдалося зберегти ці налаштування."
  ,"profile.settings.preserved": "Попередні налаштування збережено."
  ,"tutor.fasterMsg": "Я це зрозумів — можна трохи швидше?"
  ,"tutor.loadFailed": "Не вдалося відкрити клас."
  ,"tutor6.lobby.loading": "Відкриття ваших навчальних сесій…"
  ,"tutor6.lobby.eyebrow": "ШІ-професор"
  ,"tutor6.lobby.title": "Над чим ви хотіли б попрацювати?"
  ,"tutor6.lobby.subtitle": "Продовжте саме ту навчальну тему, де зупинилися, або почніть цільовий запит."
  ,"tutor6.lobby.continueTitle": "Продовжити з місця зупинки"
  ,"tutor6.lobby.resumeDetail": "Ваші ціль, контекст та історію збережено."
  ,"tutor6.lobby.resume": "Продовжити сесію"
  ,"tutor6.lobby.newTitle": "Новий запит"
  ,"tutor6.lobby.placeholder": "Поясни поняття, постав мені запитання, допоможи практикуватися…"
  ,"tutor6.lobby.start": "Запитати Професора"
  ,"tutor6.lobby.openSaved": "Відкрити збережену сесію"
  ,"tutor6.lobby.recent": "Нещодавні сесії"
  ,"tutor6.lobby.completed": "Завершені сесії"
  ,"tutor6.lobby.modes": "Інші способи роботи"
  ,"tutor6.lobby.mode.explain": "Пояснити"
  ,"tutor6.lobby.mode.discuss": "Обговорити"
  ,"tutor6.lobby.mode.oral": "Усна практика"
  ,"tutor6.lobby.mode.deep": "Поглиблене дослідження"
  ,"tutor6.objective": "Навчальна ціль"
  ,"tutor6.strategy": "Педагогічний підхід"
  ,"tutor6.empty": "Поставте перше запитання. Ваша ціль і активний контекст залишаться прикріпленими до цієї сесії."
  ,"tutor6.loading.detail": "Відновлення цілі, контексту й нещодавньої розмови."
  ,"tutor6.backTutor": "Назад до Професора"
  ,"tutor6.pause": "Призупинити й вийти"
  ,"tutor6.complete": "Завершити сесію"
  ,"tutor6.options": "Параметри сесії"
  ,"tutor6.state.ready": "Готово"
  ,"tutor6.state.listening": "Слухаю"
  ,"tutor6.state.transcription": "Транскрибування вашого голосу…"
  ,"tutor6.state.thinking": "Професор готує відповідь…"
  ,"tutor6.state.response": "Відповідь готова"
  ,"tutor6.state.error": "Потрібна дія"
  ,"tutor6.voice.heard": "Транскрипцію збережено: «{text}»"
  ,"tutor6.voice.saved": "Вашу усну репліку й письмовий урок «{topic}» збережено."
  ,"tutor6.error.provider": "Професор тимчасово недоступний"
  ,"tutor6.error.preserved": "Вашу чернетку й сесію збережено."
  ,"tutor6.error.retry": "Повторити цей запит"
  ,"tutor6.quota.title": "Ліміт використання ШІ вичерпано"
  ,"tutor6.quota.detail": "Цю дію ШІ призупинено. Ви й далі можете читати документи й користуватися зонами без ШІ."
  ,"tutor6.quota.reset": "Дії ШІ знову будуть доступні після {date}. Сесію збережено."
  ,"tutor6.quota.usage": "Переглянути використання"
  ,"tutor6.quota.library": "Відкрити Бібліотеку"
  ,"tutor6.block.text": "Відповідь"
  ,"tutor6.block.teaching": "Пояснення"
  ,"tutor6.block.example": "Приклад"
  ,"tutor6.block.question": "Перевірка розуміння"
  ,"tutor6.block.exercise": "Вправа"
  ,"tutor6.block.quiz": "Вікторина"
  ,"tutor6.block.summary": "Підсумок"
  ,"tutor6.block.source": "Джерело"
  ,"tutor6.block.action": "Наступний крок"
  ,"tutor6.block.progress": "Прогрес"
  ,"tutor6.progress.title": "Що змінилося в цій сесії"
  ,"tutor6.progress.count": "Виконано {done} із {total} реальних кроків"
  ,"tutor6.progress.completed": "Виконано кроків: {done}"
  ,"tutor6.impact.concept-added": "Поняття додано до вашого Мозку"
  ,"tutor6.impact.connection-added": "Додано зв’язок знань"
  ,"tutor6.impact.mastery": "Рівень опанування поняття змінився"
  ,"tutor6.impact.memory": "Розклад пам’яті змінився"
  ,"tutor6.impact.progress": "Навчальний прогрес змінився"
  ,"tutor6.result.title": "Виберіть наступну дію"
  ,"tutor6.result.detail": "Продовжте, закріпіть або поверніться до початкового контексту."
  ,"tutor6.result.continue": "Продовжити навчання"
  ,"tutor6.result.consolidate": "Закріпити практикою"
  ,"tutor6.result.origin": "Повернутися до початкового контексту"
  ,"strategy.reason.socratic": "Навідні запитання допомагають самостійно побудувати міркування до підтвердження Професором."
  ,"strategy.reason.project_based": "Конкретний результат одразу надає кожному поняттю практичне застосування."
  ,"strategy.reason.problem_solving": "Тема стає зрозумілішою, якщо розв’язувати по одному змістовному кроку."
  ,"strategy.reason.case_study": "Реалістичний випадок полегшує розгляд основних принципів."
  ,"strategy.reason.task_based": "Використання навички в реальному завданні підтримує активне навчання."
  ,"strategy.reason.guided_demonstration": "Розв’язаний приклад надає опору, перш ніж ви поступово переберете ініціативу."
  ,"strategy.reason.active_learning": "Короткі й часті вправи підтримують вашу активну участь."
  ,"strategy.reason.experiential": "Застосування поняття й осмислення результату поглиблюють опанування."
  ,"library7.owned": "Те, що мені належить"
  ,"library7.mission": "Усе, що ви надали Second Brain, — упорядковане, зрозуміле й готове до навчання."
  ,"library7.offline": "Бібліотека зараз офлайн."
  ,"library7.stale.title": "Офлайн-перегляд"
  ,"library7.stale.detail": "Це останні збережені дані Бібліотеки. Дії, що потребують Second Brain, стануть доступними після відновлення зв’язку."
  ,"library7.import": "Імпортувати"
  ,"library7.scan": "Сканувати"
  ,"library7.batch": "Кілька документів"
  ,"library7.ask": "Запитати мої джерела"
  ,"library7.search": "Пошук файлів, тем або підсумків…"
  ,"library7.sort.newest": "Найновіші"
  ,"library7.sort.oldest": "Найстаріші"
  ,"library7.sort.title": "Назва"
  ,"library7.more": "Завантажити більше"
  ,"library7.favorite": "Додати до обраного або видалити звідти"
  ,"library7.conceptsCount": "Виявлено понять: {n}"
  ,"library7.documentsCount": "Документів: {n}"
  ,"library7.collection.create": "Нова колекція"
  ,"library7.collection.name": "Назва колекції"
  ,"library7.collection.none": "Без колекції"
  ,"library7.empty.title": "Ваша Бібліотека ще порожня"
  ,"library7.empty.detail": "Додайте курс, книгу, статтю або нотатки. Second Brain зможе їх зрозуміти, пов’язати з вашим мозком і допомогти їх вивчити."
  ,"library7.empty.pipeline": "Що відбувається після імпорту"
  ,"library7.empty.import": "Імпорт"
  ,"library7.empty.read": "Читання"
  ,"library7.empty.understand": "Розуміння"
  ,"library7.empty.connect": "Зв’язування"
  ,"library7.empty.ready": "Готово"
  ,"library7.import.title": "Додати джерело"
  ,"library7.import.file": "Файл"
  ,"library7.import.text": "Нотатки"
  ,"library7.import.url": "Вебсторінка"
  ,"library7.import.formats": "PDF, текст, Markdown і зображення використовують той самий конвеєр документів."
  ,"library7.import.choose": "Вибрати файл"
  ,"library7.quota.title": "Ліміт використання вичерпано"
  ,"library7.quota.reset": "Знову доступно: {date}."
  ,"library7.quota.usage": "Переглянути використання"
  ,"library7.quota.alternatives": "Залишається доступним"
  ,"document.pipeline.queued": "Очікує читання"
  ,"document.pipeline.reading": "Читання документа"
  ,"document.pipeline.extracting": "Вилучення корисного вмісту"
  ,"document.pipeline.indexing": "Підготовка пошуку в документі"
  ,"document.pipeline.connecting": "Пов’язування понять"
  ,"document.pipeline.completed": "Документ готовий"
  ,"document.pipeline.failed": "Обробку зупинено"
  ,"document.pipeline.noEstimate": "Поточний етап — надійної оцінки часу немає"
  ,"document.pipeline.retry": "Повторити обробку документа"
  ,"document.pipeline.retryOcr": "Повторно прочитати збережений скан"
  ,"document.pipeline.ocrFailed": "Розпізнавання тексту не вдалося. Зняті сторінки збережено."
  ,"document.pipeline.ocrRetryHelp": "Зняті сторінки збережено. Ця дія повторює розпізнавання тексту, але не індексує порожній документ."
  ,"document.batch.title": "Імпорт кількох документів"
  ,"document.batch.detail": "Кожен файл обробляється окремо. Помилка ніколи не скасовує успішні документи."
  ,"document.batch.choose": "Вибрати документи"
  ,"document.batch.start": "Почати імпорт"
  ,"document.batch.cancel": "Зупинити імпорти в очікуванні"
  ,"document.batch.summary": "усього {total} · готово {done} · обробляється {processing} · помилок {failed}"
  ,"document.batch.waiting": "Очікування"
  ,"document.batch.uploading": "Завантаження…"
  ,"document.batch.result": "Підсумок пакета"
  ,"document.batch.resultDetail": "Готово документів: {documents} · виявлено понять: {concepts}"
  ,"document.batch.subjects": "Виявлені теми"
  ,"source.passage": "Уривок {n}"
  ,"source.close": "Закрити перегляд джерела"
  ,"source.openDocument": "Відкрити документ"
  ,"library7.document.loading": "Відкриття Інтелекту документа…"
  ,"library7.document.intelligence": "Інтелект документа"
  ,"library7.document.processingHelp": "Можна залишити цей екран. Обробка триватиме без втрати імпортованого документа."
  ,"library7.document.previewLimited": "Обмежений перегляд"
  ,"library7.document.previewLimitedDetail": "Тут завантажено лише початок, щоб екран залишався швидким."
  ,"library7.backLibrary": "Назад до Бібліотеки"
  ,"library7.action.ask": "Запитати цей документ"
  ,"library7.action.learn": "Вивчити цей документ"
  ,"library7.action.more": "Більше дій"
  ,"library7.action.less": "Менше дій"
  ,"library7.action.advanced": "Перетворити або впорядкувати"
  ,"library7.action.quiz": "Створити вікторину"
  ,"library7.action.flashcards": "Створити картки"
  ,"library7.action.workspace": "Додати до роботи"
  ,"library7.tab.document": "Документ"
  ,"library7.tab.understand": "Зрозуміти"
  ,"library7.tab.ask": "Запитати"
  ,"library7.understood": "Що розуміє Second Brain"
  ,"library7.summaryUnavailable": "Підсумок поки недоступний. Оригінальний документ залишається доступним."
  ,"library7.concepts": "Виявлено понять: {n}"
  ,"library7.noConcepts": "Механізм документів не повернув жодного поняття."
  ,"library7.brainImpact": "{known} уже відомо · {new} нових · {links} зв’язків створено"
  ,"library7.brain.open": "Переглянути в Моєму Мозку"
  ,"library7.resources": "Перетворення"
  ,"library7.resources.trace": "Створено з {title}"
  ,"library7.compare.with": "Порівняти з…"
  ,"library7.nba.title": "Запропонований наступний крок"
  ,"library7.nba.learn": "Вивчити {n} нових понять"
  ,"library7.nba.ask": "Запитати цей документ"
  ,"library7.nba.flashcards": "Створити картки"
  ,"library7.nba.brain": "Переглянути зв’язки Мозку"
  ,"library7.ask.documentTitle": "Запитати цей документ"
  ,"library7.ask.noAnswer": "Вибрані джерела не містять відповіді"
  ,"library7.ask.ownedSources": "Лише мої джерела"
  ,"library7.ask.title": "Запитати мої джерела"
  ,"library7.ask.detail": "Виберіть точну область. Second Brain відповідає лише з отриманих уривків і показує джерела."
  ,"library7.ask.scope.all": "Усі"
  ,"library7.ask.scope.collection": "Колекція"
  ,"library7.ask.scope.selected": "Вибрані"
  ,"library7.ask.noCollections": "Спочатку створіть колекцію в Бібліотеці."
  ,"library7.ask.selectedCount": "Вибрано: {n}"
  ,"library7.ask.chooseScope": "Вибрати джерела"
  ,"library7.ask.chooseScopeDetail": "Перед запитанням виберіть колекцію або принаймні один документ."
  ,"research10.eyebrow": "Дослідження"
  ,"research10.title": "Дослідження з доказами"
  ,"research10.subtitle": "Знаходьте, звіряйте, аналізуйте й синтезуйте те, що справді підтверджують ваші джерела."
  ,"research10.question": "Дослідницьке запитання"
  ,"research10.placeholder": "Наприклад: порівняй TCP та UDP за моїми матеріалами курсу."
  ,"research10.depth": "Глибина"
  ,"research10.depth.quick": "Швидке запитання"
  ,"research10.depth.sourced": "Дослідження з джерелами"
  ,"research10.depth.deep": "Поглиблене дослідження"
  ,"research10.depth.quick.detail": "Стисла відповідь із доступних джерел."
  ,"research10.depth.sourced.detail": "Аналіз із явними джерелами й посиланнями."
  ,"research10.depth.deep.detail": "План, добірка, порівняння й структурований синтез."
  ,"research10.scope": "Джерела для пошуку"
  ,"research10.scope.edit": "Вибрати джерела · вибрано {count}"
  ,"research10.scope.apply": "Застосувати джерела"
  ,"research10.scope.brain": "Мій Мозок"
  ,"research10.scope.library": "Моя Бібліотека"
  ,"research10.scope.documents": "Вибрані документи"
  ,"research10.scope.collection": "Колекція"
  ,"research10.scope.external": "Зовнішні джерела"
  ,"research10.scope.web": "Веб"
  ,"research10.webUnavailable": "Вебдослідження недоступне"
  ,"research10.webUnavailableDetail": "Зовнішнього провайдера досліджень не налаштовано. Ваш Мозок і Бібліотека залишаються доступними."
  ,"research10.documents": "Вибрати документи"
  ,"research10.documents.empty": "Немає готових документів."
  ,"research10.collections": "Вибрати колекцію"
  ,"research10.collections.empty": "Колекцій немає."
  ,"research10.deep.costTitle": "Дослідження з більшим використанням"
  ,"research10.deep.costDetail": "Поглиблене дослідження читає більше джерел. Перегляньте план перед початком; витратні дії не запускаються непомітно."
  ,"research10.reviewPlan": "Переглянути план дослідження"
  ,"research10.launch": "Почати дослідження"
  ,"research10.cancel": "Скасувати"
  ,"research10.cancelled": "Дослідження скасовано. Збережена сесія залишається доступною."
  ,"research10.plan.title": "Запропонований план дослідження"
  ,"research10.plan.find": "Визначити доречні джерела у вибраній області."
  ,"research10.plan.compare": "Порівняти позиції, підтверджені цими джерелами."
  ,"research10.plan.verify": "Виявити суперечності й прогалини в доказах."
  ,"research10.plan.synthesize": "Створити структурований синтез із посиланнями."
  ,"research10.running": "Дослідження триває"
  ,"research10.runningDetail": "Second Brain опитує вибрані джерела. Відсоток завершення не оцінюється."
  ,"research10.running.collect": "Збір вибраних джерел"
  ,"research10.noSources": "Підтверджувальних джерел не знайдено"
  ,"research10.noSourcesDetail": "Second Brain не створив відповідь, бо вибрані джерела її не підтверджують. Змініть область або запитання."
  ,"research10.partial": "Часткове дослідження"
  ,"research10.partialDetail": "Деякі вибрані джерела були недоступні. Результат нижче використовує лише фактично прочитані джерела."
  ,"research10.synthesis": "Синтез"
  ,"research10.keyPoints": "Ключові тези"
  ,"research10.comparison": "Порівняння джерел"
  ,"research10.agreements": "Збіги"
  ,"research10.divergences": "Розбіжності"
  ,"research10.specificities": "Особливості"
  ,"research10.sources": "Використані джерела"
  ,"research10.stage.sources-found": "Джерела знайдено"
  ,"research10.stage.sources-read": "Джерела прочитано"
  ,"research10.stage.compared": "Джерела порівняно"
  ,"research10.stage.synthesized": "Синтез завершено"
  ,"research10.next": "Продовжити з цього дослідження"
  ,"research10.next.reason": "Синтез із джерелами готовий до перетворення на активне навчання."
  ,"research10.action.learn": "Вивчити цю тему"
  ,"research10.action.workspace": "Додати до Робочого простору"
  ,"research10.action.deepen": "Поглибити"
  ,"research10.quota": "Ліміт досліджень вичерпано"
  ,"research10.quotaDetail": "Дослідження не запускалося повторно. Ви можете користуватися зонами без ШІ або переглянути використання."
  ,"research10.openUsage": "Переглянути використання"
  ,"workspace10.eyebrow": "Академічний простір"
  ,"workspace10.title": "Створіть свою роботу"
  ,"workspace10.subtitle": "Організуйте план, пишіть, зазначайте джерела й просіть контекстної допомоги, зберігаючи авторство."
  ,"workspace10.create": "Створити робочий простір"
  ,"workspace10.createAction": "Створити простір"
  ,"workspace10.template.memoire": "Дипломна робота"
  ,"workspace10.template.tfc": "Випускний проєкт"
  ,"workspace10.template.dissertation": "Дисертація"
  ,"workspace10.template.report": "Звіт"
  ,"workspace10.template.article": "Стаття"
  ,"workspace10.template.assignment": "Завдання"
  ,"workspace10.template.academic-research": "Академічне дослідження"
  ,"workspace10.template.other": "Інше"
  ,"workspace10.field.title": "Назва"
  ,"workspace10.field.titlePlaceholder": "Назвіть цю роботу"
  ,"workspace10.field.objective": "Ціль"
  ,"workspace10.field.objectivePlaceholder": "Що ви намагаєтеся довести або створити?"
  ,"workspace10.field.due": "Необов’язковий кінцевий термін"
  ,"workspace10.sources": "Джерела"
  ,"workspace10.sourceCount": "Вибрано: {n}"
  ,"workspace10.sourceMode.documents": "Документи"
  ,"workspace10.sourceMode.collections": "Колекції"
  ,"workspace10.structure": "Початкова структура"
  ,"workspace10.defaultPlan.0": "Вступ"
  ,"workspace10.defaultPlan.1": "Основна частина"
  ,"workspace10.defaultPlan.2": "Висновок"
  ,"workspace10.integrity": "Ваші міркування залишаються в центрі"
  ,"workspace10.integrityDetail": "Second Brain допомагає зрозуміти, послатися й перевірити. Він не пише непомітно повну академічну роботу замість вас."
  ,"workspace10.resume": "Продовжити робочий простір"
  ,"workspace10.resumeDetail": "Ваш план, вміст, джерела й історія асистента зберігаються разом."
  ,"workspace10.loading": "Завантаження робочих просторів…"
  ,"workspace10.empty": "Робочих просторів поки немає"
  ,"workspace10.emptyDetail": "Створіть простір, щоб організувати реальну роботу й продовжити її пізніше."
  ,"workspace10.open": "Продовжити"
  ,"workspace10.sourcesN": "Джерел: {n}"
  ,"workspace10.steps": "Виконано {done} із {total} реальних кроків"
  ,"workspace10.status.active": "Активний"
  ,"workspace10.status.paused": "Призупинений"
  ,"workspace10.status.completed": "Завершений"
  ,"workspace10.status.archived": "Архівований"
  ,"workspace10.opening": "Відкриття робочого простору…"
  ,"workspace10.openingDetail": "Завантаження збереженого плану, чернетки, джерел та історії асистента."
  ,"workspace10.unavailable": "Робочий простір недоступний"
  ,"workspace10.noObjective": "Цілі ще не додано."
  ,"workspace10.area.plan": "План"
  ,"workspace10.area.work": "Робота"
  ,"workspace10.area.sources": "Джерела"
  ,"workspace10.area.assistant": "Асистент"
  ,"workspace10.plan": "План"
  ,"workspace10.plan.new": "Новий розділ"
  ,"workspace10.plan.rename": "Перейменувати розділ"
  ,"workspace10.plan.remove": "Видалити"
  ,"workspace10.plan.add": "Додати розділ"
  ,"workspace10.editor.heading": "Заголовок"
  ,"workspace10.editor.list": "Список"
  ,"workspace10.editor.quote": "Цитата"
  ,"workspace10.editor.reference": "Посилання"
  ,"workspace10.editor.placeholder": "Почніть писати тут…"
  ,"workspace10.editor.label": "Вміст робочого простору"
  ,"workspace10.save.idle": "Без змін"
  ,"workspace10.save.dirty": "Зміни ще не збережено"
  ,"workspace10.save.saving": "Збереження…"
  ,"workspace10.save.saved": "Збережено"
  ,"workspace10.save.error": "Помилка збереження"
  ,"workspace10.save.offline": "Офлайн — зміни збережено на екрані"
  ,"workspace10.saveNow": "Зберегти зараз"
  ,"workspace10.conflict": "Цей простір змінено деінде. Перезавантажте перед новим збереженням, щоб не перезаписати роботу."
  ,"workspace10.sourcesEmpty": "Джерел ще не прикріплено."
  ,"workspace10.addSource": "Додати джерело"
  ,"workspace10.assistant": "Асистент Second Brain"
  ,"workspace10.assistantDetail": "Контекстна допомога для цієї роботи. Чернетка залишається головною робочою поверхнею."
  ,"workspace10.assist.explain": "Пояснити"
  ,"workspace10.assist.challenge": "Поставити під сумнів"
  ,"workspace10.assist.suggest": "Запропонувати"
  ,"workspace10.assist.structure": "Структурувати"
  ,"workspace10.assist.compare-sources": "Порівняти джерела"
  ,"workspace10.assist.check-coherence": "Перевірити зв’язність"
  ,"workspace10.assist.rephrase": "Перефразувати"
  ,"workspace10.selection": "Вибраний уривок"
  ,"workspace10.assistantQuestion": "Запит"
  ,"workspace10.assistantPlaceholder": "Запитайте про поточну роботу або вибраний уривок…"
  ,"workspace10.assistantSend": "Запитати асистента"
  ,"workspace10.next": "Найкраща наступна дія"
  ,"workspace10.nextSection": "Продовжити: {section}"
  ,"workspace10.nextSources": "Додайте джерело перед розвитком аргументу."
  ,"workspace10.continue": "Продовжити писати"
  ,"workspace10.askTutor": "Запитати Професора"
  ,"workspace10.research": "Почати дослідження"
  ,"languages11.eyebrow": "Мови й занурення"
  ,"languages11.title": "Ваша мовна практика"
  ,"languages11.description": "Єдиний зосереджений простір для розмови, словника, розуміння, письма й усної практики."
  ,"languages11.preferences": "Мови"
  ,"languages11.goal.empty": "Додайте ціль, щоб зробити практику точнішою."
  ,"languages11.goal.label": "Навчальна ціль"
  ,"languages11.goal.placeholder": "Подорож, іспит, робота, розмова…"
  ,"languages11.level.title": "Ваш рівень"
  ,"languages11.level.declared": "заявлений рівень"
  ,"languages11.level.notEvaluated": "Цей рівень заявлено самостійно. Оцінювання його ще не перевіряло."
  ,"languages11.metric.words": "слів"
  ,"languages11.metric.due": "на часі"
  ,"languages11.metric.sessions": "сесій"
  ,"languages11.metric.lessons": "уроків"
  ,"languages11.lastActivity": "Остання активність: {date}"
  ,"languages11.lastActivity.none": "Активності поки немає."
  ,"languages11.nba.badge": "НАСТУПНА ПРАКТИКА"
  ,"languages11.nba.start": "Почати"
  ,"languages11.nba.review": "Повторити {count} словникових елементів"
  ,"languages11.nba.reasonDue": "Ці елементи вже на часі за вашим розкладом пам’яті FSRS."
  ,"languages11.nba.firstConversation": "Почати першу керовану розмову"
  ,"languages11.nba.reasonStart": "Короткий обмін створює ваш перший контекст активної практики."
  ,"languages11.nba.lesson": "Побудувати перший цільовий урок"
  ,"languages11.nba.reasonLesson": "Ви вже практикувалися, але мовного уроку ще не створено."
  ,"languages11.nba.conversation": "Продовжити короткою розмовою"
  ,"languages11.nba.reasonPractice": "Регулярне мовлення підтримує мову активною."
  ,"languages11.resume.title": "Продовжити мовну сесію"
  ,"languages11.resume.action": "Продовжити"
  ,"languages11.resume.empty": "Немає перерваної сесії"
  ,"languages11.resume.emptyDetail": "Наступна змістовна практика з’явиться тут після початку."
  ,"languages11.openSpace": "Відкрити цей мовний простір"
  ,"languages11.empty.title": "Виберіть мову, щоб почати"
  ,"languages11.empty.detail": "Second Brain пов’яже уроки, розмови й реальні повторення словника FSRS."
  ,"languages11.create.title": "Почати вивчати {language}"
  ,"languages11.create.action": "Створити мовний простір"
  ,"languages11.other.title": "Інші мови"
  ,"languages11.space.eyebrow": "Зосереджений мовний простір"
  ,"languages11.formats.title": "Формати практики"
  ,"languages11.formats.detail": "Виберіть одну дію; робочий простір зосередиться на ній."
  ,"languages11.practice.focused": "Одна дія за раз зі збереженням вашого рівня й цілі."
  ,"languages11.practice.conversation": "Розмова"
  ,"languages11.practice.vocabulary": "Словник"
  ,"languages11.practice.grammar": "Граматика"
  ,"languages11.practice.conjugation": "Дієвідмінювання"
  ,"languages11.practice.comprehension": "Розуміння"
  ,"languages11.practice.reading": "Читання"
  ,"languages11.practice.writing": "Письмо"
  ,"languages11.practice.pronunciation": "Вимова"
  ,"languages11.practice.oral": "Усне мовлення"
  ,"languages11.practice.quiz": "Вікторина"
  ,"languages11.conversation.detail": "Той самий ШІ-професор адаптує частку цільової мови й виправлення до цієї сесії."
  ,"languages11.conversation.start": "Почати розмову"
  ,"languages11.oral.detail": "Говоріть із тим самим Професором. Транскрипція залишається видимою й доступною для редагування до надсилання."
  ,"languages11.oral.start": "Почати усну практику"
  ,"languages11.scenario.label": "Сценарій"
  ,"languages11.scenario.placeholder": "В аптеці, на співбесіді, у повсякденні…"
  ,"languages11.immersion.title": "Занурення"
  ,"languages11.immersion.guided": "Кероване"
  ,"languages11.immersion.mixed": "Змішане"
  ,"languages11.immersion.full": "Повне"
  ,"languages11.correction.title": "Виправлення"
  ,"languages11.correction.light": "Легкі"
  ,"languages11.correction.balanced": "Збалансовані"
  ,"languages11.correction.detailed": "Докладні"
  ,"languages11.generate": "Створити практику"
  ,"languages11.quiz.detail": "Повторіть словник на часі за допомогою наявного механізму пам’яті FSRS."
  ,"languages11.quiz.action": "Відкрити мовне повторення"
  ,"languages11.review.return": "Назад до мови"
  ,"languages11.reading.history": "Відкрити історію Читання"
  ,"languages11.writing.workspace": "Відкрити повний простір Письма"
  ,"languages11.writing.instruction": "Пишіть мовою {language}."
  ,"languages11.offline.title": "Голос і ШІ недоступні офлайн"
  ,"languages11.offline.detail": "Локальну чернетку збережено. Відновіть зв’язок перед транскрибуванням або зверненням до Професора."
  ,"rlle.ui.hub.learn": "Вивчати {language}"
  ,"rlle.ui.hub.resume": "Продовжити мій курс мови {language}"
  ,"rlle.ui.hub.courseDetail": "Структурований адаптивний курс CEFR, побудований навколо ваших реальних потреб."
  ,"rlle.ui.hub.openCourse": "Відкрити мій курс"
  ,"rlle.ui.hub.courseUnavailable": "Сервіс курсів поки недоступний. Інструменти практики залишаються доступними."
  ,"rlle.ui.course.eyebrow": "МОВНИЙ МЕХАНІЗМ РЕАЛЬНОГО ЖИТТЯ"
  ,"rlle.ui.course.title": "Курс мови {language}"
  ,"rlle.ui.course.subtitle": "Навчайтеся поступово, а потім доведіть свої вміння в реальних ситуаціях."
  ,"rlle.ui.course.loading": "Завантаження курсу…"
  ,"rlle.ui.course.notStarted": "Побудувати мій курс"
  ,"rlle.ui.course.notStartedDetail": "Виберіть початковий рівень і реальну ціль. Основні засади ніколи не вилучаються."
  ,"rlle.ui.course.startZero": "Почати з нуля"
  ,"rlle.ui.course.startDeclared": "Почати із заявленого рівня"
  ,"rlle.ui.course.declaredWarning": "{level} — заявлений рівень, а не результат оцінювання."
  ,"rlle.ui.course.targetLevel": "Цільовий рівень"
  ,"rlle.ui.course.goalDomain": "Пріоритет у реальному житті"
  ,"rlle.ui.course.goal.general": "Загальне"
  ,"rlle.ui.course.goal.travel": "Подорожі"
  ,"rlle.ui.course.goal.work": "Робота"
  ,"rlle.ui.course.goal.studies": "Навчання"
  ,"rlle.ui.course.goal.social": "Соціальне життя"
  ,"rlle.ui.course.start": "Почати мій курс"
  ,"rlle.ui.course.resume": "Продовжити мій курс"
  ,"rlle.ui.course.pause": "Призупинити курс"
  ,"rlle.ui.course.current": "Продовжити поточний урок"
  ,"rlle.ui.course.curriculum": "Навчальний шлях CEFR"
  ,"rlle.ui.course.curriculumDetail": "Цільові модулі мають пріоритет, а повна навчальна основа зберігається."
  ,"rlle.ui.course.goalPriority": "Ваша ціль"
  ,"rlle.ui.course.core": "Основа"
  ,"rlle.ui.course.unit.open": "Відкрити модуль"
  ,"rlle.ui.course.status.locked": "Заблоковано"
  ,"rlle.ui.course.status.available": "Доступно"
  ,"rlle.ui.course.status.in-progress": "Виконується"
  ,"rlle.ui.course.status.completed": "Завершено"
  ,"rlle.ui.course.status.untracked": "Не розпочато"
  ,"rlle.ui.course.progress": "Виміряний прогрес"
  ,"rlle.ui.course.progressUnits": "Завершено {done} із {total} модулів"
  ,"rlle.ui.course.progressUnknown": "Виміряного прогресу курсу поки немає."
  ,"rlle.ui.course.lastActivity": "Остання активність: {date}"
  ,"rlle.ui.course.noActivity": "Активності в курсі поки немає"
  ,"rlle.ui.course.levels": "Рівні CEFR"
  ,"rlle.ui.course.level.declared": "Заявлений"
  ,"rlle.ui.course.level.estimated": "Орієнтовний"
  ,"rlle.ui.course.level.evaluated": "Оцінений"
  ,"rlle.ui.course.level.target": "Цільовий"
  ,"rlle.ui.course.notEvaluated": "Не оцінено"
  ,"rlle.ui.course.dimensions": "Навички, виміряні доказами"
  ,"rlle.ui.course.evidenceCount": "Елементів доказів: {count}"
  ,"rlle.ui.course.review": "Повторити цю мову"
  ,"rlle.ui.course.brain": "Переглянути мовні знання в Моєму Мозку"
  ,"rlle.ui.course.professor": "Запитати Професора"
  ,"rlle.ui.course.offline": "Не вдалося оновити останній стан курсу."
  ,"rlle.ui.course.preferences.title": "Налаштування курсу"
  ,"rlle.ui.course.preferences.detail": "Адаптуйте інтенсивність занурення й виправлень без втрати прогресу."
  ,"rlle.ui.course.preferences.save": "Зберегти налаштування"
  ,"rlle.ui.course.preferences.saved": "Налаштування курсу збережено."
  ,"rlle.ui.course.preferences.error": "Не вдалося зберегти налаштування."
  ,"rlle.ui.review.returnCourse": "Назад до мого курсу"
  ,"rlle.ui.brain.evidenceTitle": "Виміряні мовні можливості"
  ,"rlle.ui.brain.evidenceDetail": "Тут показано лише спостережені докази з цього мовного курсу."
  ,"rlle.ui.brain.backCourse": "Відкрити мовний курс"
  ,"rlle.ui.lesson.eyebrow": "СТРУКТУРОВАНИЙ УРОК"
  ,"rlle.ui.lesson.title": "Урок"
  ,"rlle.ui.lesson.intro": "Комунікативна ціль"
  ,"rlle.ui.lesson.start": "Почати цей урок"
  ,"rlle.ui.lesson.resume": "Продовжити цей урок"
  ,"rlle.ui.lesson.complete": "Завершити урок"
  ,"rlle.ui.lesson.completeStage": "Завершити цей крок"
  ,"rlle.ui.lesson.completed": "Урок завершено. Функціональні вміння все ще потребують реальних доказів."
  ,"rlle.ui.lesson.openGenerated": "Відкрити вміст уроку"
  ,"rlle.ui.lesson.path": "Послідовність уроку"
  ,"rlle.ui.lesson.stageAction": "Практикувати цей крок"
  ,"rlle.ui.lesson.noActive": "У цьому модулі ще немає активного уроку."
  ,"rlle.ui.lesson.proofNote": "Саме лише завершення уроку ніколи не підтверджує вміння."
  ,"rlle.ui.mission.eyebrow": "СВІТОВІ МІСІЇ"
  ,"rlle.ui.mission.title": "Місії реального життя"
  ,"rlle.ui.mission.subtitle": "Виконайте комунікативне завдання з Професором. Успіх потребує спостережених доказів, а не балів вікторини."
  ,"rlle.ui.mission.start": "Почати місію"
  ,"rlle.ui.mission.resume": "Продовжити місію"
  ,"rlle.ui.mission.minimum": "Від рівня {level}"
  ,"rlle.ui.mission.survival": "Навички комунікативного виживання"
  ,"rlle.ui.mission.notAvailable": "Відстеження місій поки недоступне на сервері."
  ,"rlle.ui.mission.dynamic": "Професор реагує на ваші реальні відповіді й перевіряє, чи виконано завдання."
  ,"rlle.ui.mission.all": "Усі"
  ,"rlle.ui.cando.eyebrow": "МАПА ВМІНЬ"
  ,"rlle.ui.cando.title": "Що я справді вмію"
  ,"rlle.ui.cando.subtitle": "Уміння підтверджується лише успішною місією, оцінюванням або контрольованою діяльністю."
  ,"rlle.ui.cando.open": "Відкрити мою мапу вмінь"
  ,"rlle.ui.cando.status.not-evaluated": "Не оцінено"
  ,"rlle.ui.cando.status.in-progress": "Докази збираються"
  ,"rlle.ui.cando.status.validated": "Продемонстровано"
  ,"rlle.ui.cando.evidence": "Докази"
  ,"rlle.ui.cando.noEvidence": "Спостережених доказів поки немає."
  ,"rlle.ui.cando.source.mission": "Світова місія"
  ,"rlle.ui.cando.source.assessment": "Оцінювання"
  ,"rlle.ui.cando.source.controlled-activity": "Контрольована діяльність"
  ,"rlle.ui.recovery.title": "Цільове відновлення"
  ,"rlle.ui.recovery.subtitle": "Тут з’являються лише складності, реально спостережені під час діяльності."
  ,"rlle.ui.recovery.empty": "Немає підтверджених складностей для виправлення."
  ,"rlle.ui.recovery.gaps": "Функціональні прогалини"
  ,"rlle.ui.recovery.mistakes": "Пам’ять помилок"
  ,"rlle.ui.recovery.repair": "Цикл виправлення"
  ,"rlle.ui.recovery.occurrences": "Спостережених випадків: {count}"
  ,"rlle.ui.recovery.next": "Поточний етап виправлення: {stage}"
  ,"rlle.ui.common.retry": "Спробувати ще раз"
  ,"rlle.ui.common.backCourse": "Назад до курсу"
  ,"rlle.ui.common.error": "Не вдалося завантажити курс."
  ,"rlle.ui.category.travel": "Подорожі"
  ,"rlle.ui.category.work": "Робота"
  ,"rlle.ui.category.studies": "Навчання"
  ,"rlle.ui.category.social": "Соціальне життя"
  ,"rlle.ui.dimension.vocabulary": "Словниковий запас"
  ,"rlle.ui.dimension.grammar": "Граматика"
  ,"rlle.ui.dimension.conversation": "Розмова"
  ,"rlle.ui.dimension.listening": "Сприйняття на слух"
  ,"rlle.ui.dimension.reading": "Читання"
  ,"rlle.ui.dimension.writing": "Письмо"
  ,"rlle.ui.dimension.interaction": "Взаємодія"
  ,"rlle.ui.dimension.pronunciation": "Вимова"
  ,"rlle.ui.dimension.mediation": "Медіація"
  ,"rlle.ui.dimension.status.not-evaluated": "Не оцінено"
  ,"rlle.ui.dimension.status.emerging": "Формується"
  ,"rlle.ui.dimension.status.demonstrated": "Продемонстровано"
  ,"rlle.ui.dimension.status.consistent": "Стабільно"
  ,"rlle.ui.strand.vocabulary": "Словниковий запас"
  ,"rlle.ui.strand.verbs": "Дієслова"
  ,"rlle.ui.strand.conjugation": "Дієвідмінювання"
  ,"rlle.ui.strand.grammar": "Граматика"
  ,"rlle.ui.strand.listening": "Сприйняття на слух"
  ,"rlle.ui.strand.reading": "Читання"
  ,"rlle.ui.strand.conversation": "Розмова"
  ,"rlle.ui.strand.interaction": "Взаємодія"
  ,"rlle.ui.strand.pronunciation": "Вимова"
  ,"rlle.ui.strand.writing": "Письмо"
  ,"rlle.ui.strand.mediation": "Медіація"
  ,"rlle.ui.stage.communicative-objective": "Комунікативна мета"
  ,"rlle.ui.stage.vocabulary": "Лексика в контексті"
  ,"rlle.ui.stage.grammar-verbs": "Граматика й дієслова"
  ,"rlle.ui.stage.example": "Зразок"
  ,"rlle.ui.stage.comprehension": "Розуміння"
  ,"rlle.ui.stage.practice": "Керована практика"
  ,"rlle.ui.stage.oral": "Спочатку говоріння"
  ,"rlle.ui.stage.writing": "Письмо"
  ,"rlle.ui.stage.verification": "Перевірка"
  ,"rlle.ui.stage.review": "Повторення для пам’яті"
  ,"rlle.ui.stage.status.pending": "Треба виконати"
  ,"rlle.ui.stage.status.active": "Зараз"
  ,"rlle.ui.stage.status.completed": "Виконано"
  ,"rlle.ui.stage.status.skipped": "Не потрібно"
  ,"rlle.ui.repair.explain": "Пояснення"
  ,"rlle.ui.repair.guided-practice": "Керована практика"
  ,"rlle.ui.repair.retry-now": "Спробувати ще раз зараз"
  ,"rlle.ui.repair.reuse-later": "Застосувати пізніше"
  ,"rlle.ui.repair.consolidate": "Закріпити під час Повторення"
  ,"rlle.ui.survival.ask-repeat": "Попросити повторити"
  ,"rlle.ui.survival.ask-slow-down": "Попросити говорити повільніше"
  ,"rlle.ui.survival.ask-definition": "Попросити дати визначення"
  ,"rlle.ui.survival.rephrase": "Перефразувати"
  ,"rlle.ui.survival.check-understanding": "Перевірити розуміння"
  ,"rlle.ui.survival.explain-unknown-word": "Пояснити незнайоме слово"
  ,"rlle.ui.survival.buy-thinking-time": "Виграти час на відповідь"
  ,"rlle.unit.a1FirstContact": "Перше знайомство"
  ,"rlle.objective.a1FirstContact": "Представитися й обмінятися основною особистою інформацією."
  ,"rlle.unit.a1DailyNeeds": "Щоденні потреби"
  ,"rlle.objective.a1DailyNeeds": "Давати раду простим щоденним потребам за допомогою корисних слів і базових форм."
  ,"rlle.unit.a1Survival": "Набір для комунікативного виживання"
  ,"rlle.objective.a1Survival": "Підтримувати розмову, навіть якщо ви розумієте не все."
  ,"rlle.unit.a2Routines": "Звички й плани"
  ,"rlle.objective.a2Routines": "Описувати звички, заняття й прості плани на майбутнє."
  ,"rlle.unit.a2PastPlans": "Минулий досвід"
  ,"rlle.objective.a2PastPlans": "Розповідати просту історію та пов’язувати минулі події."
  ,"rlle.unit.a2TravelStudy": "Основи для подорожей і навчання"
  ,"rlle.objective.a2TravelStudy": "Знаходити інформацію та виконувати типові завдання під час подорожі чи навчання."
  ,"rlle.unit.b1Experiences": "Розкажіть свою історію"
  ,"rlle.objective.b1Experiences": "Описувати досвід із чіткою хронологією та доречними подробицями."
  ,"rlle.unit.b1WorkTravel": "Дійте самостійно"
  ,"rlle.objective.b1WorkTravel": "Самостійно давати раду типовим ситуаціям на роботі й у подорожах."
  ,"rlle.unit.b1Opinions": "Поясніть свою думку"
  ,"rlle.objective.b1Opinions": "Розуміти погляд співрозмовника й обґрунтовано захищати власний."
  ,"rlle.unit.b2Collaboration": "Вільно співпрацюйте"
  ,"rlle.objective.b2Collaboration": "Активно брати участь у зустрічах, обговореннях і презентаціях."
  ,"rlle.unit.b2Argument": "Побудуйте аргументацію"
  ,"rlle.objective.b2Argument": "Порівнювати позиції, уточнювати твердження й будувати переконливу відповідь."
  ,"rlle.unit.b2Professional": "Професійне висловлювання"
  ,"rlle.objective.b2Professional": "Писати й говорити в регістрі, якого очікують у професійному середовищі."
  ,"rlle.unit.c1ComplexInput": "Розуміння складного матеріалу"
  ,"rlle.objective.c1ComplexInput": "Виокремлювати, пов’язувати й переформульовувати ідеї зі складних матеріалів."
  ,"rlle.unit.c1Influence": "Вплив і переговори"
  ,"rlle.objective.c1Influence": "Точно добирати мову, щоб переконувати, співпрацювати й долати розбіжності."
  ,"rlle.unit.c1Production": "Точне висловлювання"
  ,"rlle.objective.c1Production": "Створювати зрозумілі й нюансовані матеріали для академічної та професійної аудиторії."
  ,"rlle.unit.c2Nuance": "Нюанси й прихований зміст"
  ,"rlle.objective.c2Nuance": "Розуміти тонкі відмінності, регістр і прихований зміст."
  ,"rlle.unit.c2Adaptation": "Адаптація в реальному часі"
  ,"rlle.objective.c2Adaptation": "Природно передавати й переформульовувати зміст для різних аудиторій і ситуацій."
  ,"rlle.unit.c2Mastery": "Цілісне володіння"
  ,"rlle.objective.c2Mastery": "Поєднувати всі навички з точністю, гнучкістю та комунікативним контролем."
  ,"rlle.mission.travelAirport": "Зорієнтуватися в аеропорту"
  ,"rlle.missionObjective.travelAirport": "Зрозуміти вказівки й дістатися потрібного виходу."
  ,"rlle.mission.travelHotel": "Розв’язати проблему в готелі"
  ,"rlle.missionObjective.travelHotel": "Пояснити проблему й домовитися про практичне рішення."
  ,"rlle.mission.travelRestaurant": "Зробити замовлення в ресторані"
  ,"rlle.missionObjective.travelRestaurant": "Розпитати про меню й зробити доречне замовлення."
  ,"rlle.mission.travelTransport": "Скористатися місцевим транспортом"
  ,"rlle.missionObjective.travelTransport": "Запитати маршрут, зрозуміти варіанти й підтвердити пункт призначення."
  ,"rlle.mission.travelDirections": "Запитати дорогу"
  ,"rlle.missionObjective.travelDirections": "Запитати, куди йти, і перевірити, чи правильно ви зрозуміли."
  ,"rlle.mission.travelEmergency": "Діяти в надзвичайній ситуації"
  ,"rlle.missionObjective.travelEmergency": "Описати невідкладну проблему й зрозуміти наступну вказівку."
  ,"rlle.mission.workInterview": "Пройти співбесіду"
  ,"rlle.missionObjective.workInterview": "Розповісти про свій досвід і природно відповідати на додаткові запитання."
  ,"rlle.mission.workMeeting": "Взяти участь у зустрічі"
  ,"rlle.missionObjective.workMeeting": "Стежити за обговоренням, запропонувати ідею й уточнити подальшу дію."
  ,"rlle.mission.workPresentation": "Представити проєкт"
  ,"rlle.missionObjective.workPresentation": "Чітко пояснити проєкт і відповісти на запитання."
  ,"rlle.mission.workEmail": "Написати професійного листа"
  ,"rlle.missionObjective.workEmail": "Написати стислий лист із доречним тоном і проханням."
  ,"rlle.mission.workNegotiation": "Домовитися про угоду"
  ,"rlle.missionObjective.workNegotiation": "Висловити пріоритети, відповісти на заперечення й досягти компромісу."
  ,"rlle.mission.studiesLecture": "Прослухати лекцію"
  ,"rlle.missionObjective.studiesLecture": "Визначити ключові ідеї та пояснити їх простіше."
  ,"rlle.mission.studiesSynthesis": "Узагальнити складні джерела"
  ,"rlle.missionObjective.studiesSynthesis": "Пов’язати складний усний і письмовий матеріал, а потім точно передати його зміст."
  ,"rlle.mission.studiesPresentation": "Виступити з академічною презентацією"
  ,"rlle.missionObjective.studiesPresentation": "Структурувати пояснення й відповісти аудиторії."
  ,"rlle.mission.studiesDiscussion": "Долучитися до обговорення на занятті"
  ,"rlle.missionObjective.studiesDiscussion": "Розвинути чужу ідею й обґрунтувати власний внесок."
  ,"rlle.mission.studiesTeacher": "Поговорити з викладачем"
  ,"rlle.missionObjective.studiesTeacher": "Попросити пояснення й уточнити очікування."
  ,"rlle.mission.studiesAdministration": "Розв’язати адміністративне питання"
  ,"rlle.missionObjective.studiesAdministration": "Зрозуміти процедуру й запросити потрібну інформацію."
  ,"rlle.mission.socialIntroduction": "Представитися"
  ,"rlle.missionObjective.socialIntroduction": "Розпочати дружню розмову й поділитися основною інформацією."
  ,"rlle.mission.socialChat": "Підтримувати розмову"
  ,"rlle.missionObjective.socialChat": "Реагувати, ставити уточнювальні запитання й виправляти непорозуміння."
  ,"rlle.mission.socialStory": "Розповісти історію"
  ,"rlle.missionObjective.socialStory": "Викласти події в чіткому порядку й утримати увагу слухача."
  ,"rlle.mission.socialInvitation": "Запросити когось"
  ,"rlle.missionObjective.socialInvitation": "Запропонувати план, обговорити подробиці й чемно відповісти."
  ,"rlle.mission.socialDebate": "Обговорити суперечливу ідею"
  ,"rlle.missionObjective.socialDebate": "Захищати позицію, водночас відповідаючи на інший погляд."
  ,"rlle.canDo.travelOrder": "Зробити замовлення в ресторані"
  ,"rlle.canDo.travelDirections": "Запитати й зрозуміти дорогу"
  ,"rlle.canDo.travelHotelProblem": "Пояснити проблему в готелі"
  ,"rlle.canDo.travelTransport": "Спланувати поїздку місцевим транспортом"
  ,"rlle.canDo.travelEmergency": "Пояснити невідкладну проблему"
  ,"rlle.canDo.workInterview": "Розповісти про себе на співбесіді"
  ,"rlle.canDo.workMeeting": "Взяти участь у зустрічі"
  ,"rlle.canDo.workPresent": "Представити проєкт"
  ,"rlle.canDo.workEmail": "Написати професійного листа"
  ,"rlle.canDo.workNegotiate": "Домовитися про угоду"
  ,"rlle.canDo.studiesRequest": "Звернутися по академічну чи адміністративну допомогу"
  ,"rlle.canDo.studiesFollowLecture": "Прослухати лекцію й визначити її ключові ідеї"
  ,"rlle.canDo.studiesDiscuss": "Взяти участь в обговоренні на занятті"
  ,"rlle.canDo.studiesPresent": "Виступити з академічною презентацією"
  ,"rlle.canDo.studiesSynthesise": "Узагальнити й пояснити складну інформацію"
  ,"rlle.canDo.socialIntroduce": "Природно представитися"
  ,"rlle.canDo.socialClarify": "Усунути непорозуміння"
  ,"rlle.canDo.socialInvite": "Запросити когось і узгодити план"
  ,"rlle.canDo.socialTellStory": "Розповісти про минулий досвід"
  ,"rlle.canDo.socialDefendOpinion": "Обґрунтовано захистити думку"
  ,"rlle.demo.objectiveInternationalWork": "Працювати на міжнародному рівні"
  ,"rlle.ui.badge": "СТРУКТУРОВАНИЙ КУРС"
  ,"rlle.ui.cefr": "CEFR"
  ,"rlle.ui.nba.badge": "НАСТУПНА МОВНА ДІЯ"
  ,"rlle.ui.nba.review": "Повторити мовні елементи: {count}"
  ,"rlle.ui.nba.reviewReason": "Зараз настав час повторити {count} реальних елементів FSRS."
  ,"rlle.ui.nba.reviewAction": "Повторити зараз"
  ,"rlle.ui.nba.retryMission": "Спробувати завдання з реального життя ще раз"
  ,"rlle.ui.nba.retryMissionReason": "Для виявленої складності вже є мікроурок, тож можна повторити спробу."
  ,"rlle.ui.nba.resumeMission": "Продовжити Світову місію"
  ,"rlle.ui.nba.resumeMissionReason": "Ця місія реального життя ще активна."
  ,"rlle.ui.nba.resumeLesson": "Продовжити мовний урок"
  ,"rlle.ui.nba.resumeLessonReason": "Один з етапів структурованого уроку ще активний."
  ,"rlle.ui.nba.nextLesson": "Продовжити структурований курс"
  ,"rlle.ui.nba.nextLessonReason": "Це наступний незавершений модуль навчальної програми CEFR."
  ,"rlle.ui.nba.nextLessonAction": "Почати наступний урок"
  ,"rlle.ui.course.status.paused": "Призупинено"
  ,"rlle.ui.course.status.not-started": "Не розпочато"
  ,"rlle.ui.mission.category": "Категорія місії"
  ,"rlle.ui.mission.modality": "Режим практики"
  ,"rlle.ui.mission.current": "Поточна місія"
  ,"rlle.ui.mission.starting": "Місія розпочинається…"
  ,"rlle.ui.mission.status.active": "Триває"
  ,"rlle.ui.mission.status.paused": "Призупинено"
  ,"rlle.ui.mission.status.succeeded": "Успішно"
  ,"rlle.ui.mission.status.needs-retry": "Спробуйте ще раз"
  ,"rlle.ui.mission.feedback.succeeded": "Місію виконано з підтвердженими доказами."
  ,"rlle.ui.mission.feedback.repair": "Виявлено конкретну складність. Пройдіть мікроурок, а потім спробуйте ще раз."
  ,"rlle.ui.mission.feedback.proof": "КОМУНІКАТИВНИЙ ДОКАЗ"
  ,"rlle.ui.mission.feedback.microLesson": "МІКРОУРОК"
  ,"rlle.ui.mission.feedback.example": "Приклад"
  ,"rlle.ui.modality.text": "Писати"
  ,"rlle.ui.modality.voice": "Говорити"
  ,"rlle.ui.modality.mixed": "Писати й говорити"
  ,"rlle.ui.cando.notAvailable": "Мапа вмінь поки недоступна на сервері."
  ,"rlle.ui.cando.all": "Усі вміння"
  ,"rlle.ui.cando.summary": "Підтвердити вміння можуть лише спостережені докази."
  ,"rlle.ui.cando.validatedCount": "Продемонстровано: {count}"
  ,"rlle.ui.cando.measuredCount": "Оцінено: {count}"
  ,"rlle.ui.gap.status.observed": "Спостережено один раз"
  ,"rlle.ui.gap.status.repeated": "Спостережено знову"
  ,"rlle.ui.gap.status.confirmed": "Підтверджено"
  ,"rlle.ui.gap.status.repairing": "Виправляється"
  ,"rlle.ui.gap.status.consolidated": "Закріплено"
  ,"rlle.ui.dimension.conjugation": "Дієвідмінювання"
  ,"rlle.ui.dimension.fluency": "Плавність мовлення"
  ,"rlle.ui.dimension.formulation": "Формулювання"
  ,"tutor6.state.paused": "Запис призупинено"
  ,"scan.openDocument": "Відкрити Інтелект документа"
  ,"scan.captured": "Сторінки безпечно збережено"
  ,"scan.capturedDetail": "Знімок збережено. Аналіз тексту стане доступним, коли буде активовано авторизованого постачальника комп’ютерного зору."
  ,"sub.usageAction": "Переглянути використання й квоти"
  ,"sub.availablePlans": "Індивідуальні плани"
  ,"sub.availablePlansDetail": "Порівняйте поточні обмеження для кожної доступної пропозиції."
  ,"sub.notAvailable": "Наразі недоступно"
  ,"sub.periodEnd": "Поточний період завершується"
  ,"sub.trialEnds": "Пробний період завершується"
  ,"sub.openInvoice": "Відкрити рахунок"
  ,"sub.upgrade": "Перейти на"
  ,"sub.partial": "Частина платіжної інформації тимчасово недоступна. Жодну чинну підписку не змінено."
  ,"usage.loading": "Завантажуємо дані про використання…"
  ,"usage.remaining": "Залишилося"
  ,"usage.reset": "Оновлення"
  ,"usage.mb": "МБ"
  ,"usage.kb": "КБ"
  ,"usage.managePlan": "Керувати підпискою"
  ,"usage.currentPlan": "Поточний план"
  ,"usage.planUnavailable": "Інформація про план тимчасово недоступна."
  ,"usage.limitReached": "Досягнуто обмеження плану"
  ,"usage.limitResetKnown": "Цей лічильник знову стане доступним {date}."
  ,"usage.limitNoReset": "Це обмеження відображає поточне використання. Звільніть ресурс або змініть план, щоб продовжити цю дію."
  ,"usage.nonAiAvailable": "Решта Second Brain залишається доступною, зокрема функції, які не використовують цю квоту."
  ,"usage.partial": "Не вдалося оновити частину інформації про план або використання. Показано останні доступні значення."
  ,"priv.controls": "Пов’язані налаштування"
  ,"priv.memory": "Пам’ять ШІ"
  ,"priv.memoryHelp": "Перегляньте, що пам’ятає Second Brain, і налаштування, пов’язані з цією пам’яттю."
  ,"priv.documents": "Документи й джерела"
  ,"priv.documentsHelp": "Перегляньте джерела, які ви імпортували до своєї бібліотеки."
  ,"landing.nav.menu": "Меню"
  ,"landing12.seo.title": "Second Brain — ваша персональна інтелектуальна система навчання"
  ,"landing12.seo.description": "Навчайтеся, розумійте, практикуйтеся, запам’ятовуйте й створюйте в єдиній пов’язаній системі: ваші документи, ШІ-професор, когнітивний двійник, повторення, дослідження, мови й робочий простір."
  ,"landing12.brand": "Second Brain"
  ,"landing12.signature": "Один продукт. Єдиний досвід."
  ,"landing12.nav.product": "Продукт"
  ,"landing12.nav.how": "Як це працює"
  ,"landing12.nav.languages": "Мови"
  ,"landing12.nav.pricing": "Тарифи"
  ,"landing12.nav.download": "Завантажити"
  ,"landing12.nav.faq": "Часті запитання"
  ,"landing12.nav.contact": "Контакти"
  ,"landing12.nav.menu": "Відкрити навігацію"
  ,"landing12.nav.close": "Закрити навігацію"
  ,"landing12.cta.signin": "Увійти"
  ,"landing12.cta.start": "Почати безкоштовно"
  ,"landing12.cta.startShort": "Почати"
  ,"landing12.cta.how": "Дізнатися, як це працює"
  ,"landing12.cta.download": "Завантажити Second Brain"
  ,"landing12.cta.language": "Вивчати мову"
  ,"landing12.cta.next": "Наступний крок"
  ,"landing12.cta.restart": "Переглянути шлях ще раз"
  ,"landing12.demo.label": "Демонстрація продукту"
  ,"landing12.demo.disclaimer": "Статичний загальнодоступний приклад. Без реальних даних користувачів і без імітації обробки."
  ,"landing12.hero.eyebrow": "Персональна інтелектуальна система навчання"
  ,"landing12.hero.title": "Навчайтеся. Розумійте. Практикуйтеся. Запам’ятовуйте. Розвивайтеся."
  ,"landing12.hero.subtitle": "Поставте Second Brain запитання, надайте документ або визначте мету. Система сформує контекст, навчатиме вас, допоможе практикуватися, закріпить важливе й запропонує наступну дію."
  ,"landing12.hero.availability": "Доступно у вебверсії · мобільний і настільний застосунки готуються"
  ,"landing12.hero.scene.product": "SECOND BRAIN · ЄДИНИЙ КОНТЕКСТ"
  ,"landing12.hero.scene.tabsLabel": "Етапи демонстрації продукту"
  ,"landing12.hero.scene.question.tab": "Намір"
  ,"landing12.hero.scene.context.tab": "Контекст"
  ,"landing12.hero.scene.teaching.tab": "Досвід"
  ,"landing12.hero.scene.next.tab": "Наступна дія"
  ,"landing12.hero.scene.question.title": "Що ви хочете зрозуміти?"
  ,"landing12.hero.scene.question.message": "Допоможи мені зрозуміти клітинне дихання до іспиту."
  ,"landing12.hero.scene.question.intent": "Зрозуміти"
  ,"landing12.hero.scene.question.source": "Курс біології.pdf"
  ,"landing12.hero.scene.context.title": "Second Brain об’єднує корисний контекст"
  ,"landing12.hero.scene.context.brain": "Мій Мозок"
  ,"landing12.hero.scene.context.document": "Курс біології.pdf"
  ,"landing12.hero.scene.context.goal": "Мета: іспит"
  ,"landing12.hero.scene.context.concept": "Клітинне дихання"
  ,"landing12.hero.scene.context.fragile": "Поняття для закріплення"
  ,"landing12.hero.scene.teaching.title": "ШІ-професор"
  ,"landing12.hero.scene.teaching.message": "Пов’яжімо глюкозу, кисень та АТФ, а потім перевірмо розуміння одним запитанням."
  ,"landing12.hero.scene.teaching.explain": "Пояснення"
  ,"landing12.hero.scene.teaching.practice": "Практика"
  ,"landing12.hero.scene.teaching.voice": "Голос"
  ,"landing12.hero.scene.next.title": "Найкраща наступна дія"
  ,"landing12.hero.scene.next.action": "Закріпити клітинне дихання"
  ,"landing12.hero.scene.next.reason": "Рекомендовано, оскільки це поняття пов’язане з вашою метою скласти іспит і ще потребує практики."
  ,"landing12.hero.scene.next.context": "Причину видно · пункт призначення збережено"
  ,"landing12.story.kicker": "Один продукт, єдиний досвід"
  ,"landing12.story.title": "Погляньте, як знання проходять через усю систему"
  ,"landing12.story.lead": "Джерело не залишається просто у сховищі. Ця демонстрація показує, як один контекст переходить від документа до розуміння, практики, повторення й академічної роботи."
  ,"landing12.story.documents.title": "Документ стає знанням, яке можна застосувати"
  ,"landing12.story.documents.short": "Документи"
  ,"landing12.story.documents.desc": "Бібліотека приймає джерело. Інтелект документа читає його, виділяє поняття й готує обґрунтовані запитання, не вигадуючи прогресу."
  ,"landing12.story.brain.title": "Поняття долучаються до пов’язаної когнітивної мапи"
  ,"landing12.story.brain.short": "Мій Мозок"
  ,"landing12.story.brain.desc": "Когнітивний двійник унаочнює поняття, зв’язки, сильні сторони й прогалини. Цей загальнодоступний приклад є ілюстративним, а не реальним показником учня."
  ,"landing12.story.professor.title": "Професор навчає в тому самому контексті"
  ,"landing12.story.professor.short": "ШІ-професор"
  ,"landing12.story.professor.desc": "Документ, цільове поняття й навчальна мета супроводжують сесію. Досвід може перетворитися на пояснення, урок, запитання або керовану практику."
  ,"landing12.story.oral.title": "Розуміння переходить в усну практику"
  ,"landing12.story.oral.short": "Усне мовлення й голос"
  ,"landing12.story.oral.desc": "Слухання, транскрипція й відповідь мають окремі зрозумілі стани. Текст залишається видимим; жодна декоративна хвиля не вдає, що вимірює мовлення."
  ,"landing12.story.review.title": "Слабко засвоєна ідея стає матеріалом для повторення"
  ,"landing12.story.review.short": "Повторення"
  ,"landing12.story.review.desc": "Механізм повторення закріплює знання в належний час. Показана тут дата — це явно демонстрація, а не реальний розклад."
  ,"landing12.story.workspace.title": "Знання стає готовою роботою"
  ,"landing12.story.workspace.short": "Робочий простір"
  ,"landing12.story.workspace.desc": "Академічний робочий простір об’єднує план, текст, джерела й цитати, а контекстний помічник підтримує самостійну роботу учня."
  ,"landing12.story.sharedContext": "Спільний контекст"
  ,"landing12.story.traceability": "Простежуваність джерела"
  ,"landing12.story.outcome": "Я надаю інформацію → Second Brain її розуміє → навчає мене → допомагає практикуватися → допомагає запам’ятати → допомагає застосувати."
  ,"landing12.story.nba": "Потім система пропонує чітку й зрозуміло обґрунтовану наступну дію, а не залишає мене наодинці з панеллю показників."
  ,"landing12.story.file": "Курс біології.pdf"
  ,"landing12.story.fileType": "Демонстраційний документ · PDF"
  ,"landing12.story.readyDemo": "Приклад готовий"
  ,"landing12.story.pipeline.import": "Джерело імпортовано"
  ,"landing12.story.pipeline.read": "Читабельний вміст визначено"
  ,"landing12.story.pipeline.concepts": "Поняття виділено"
  ,"landing12.story.pipeline.connect": "Зв’язки підготовлено"
  ,"landing12.story.concept.respiration": "Клітинне дихання"
  ,"landing12.story.concept.toConsolidate": "Потрібно закріпити"
  ,"landing12.story.concept.photosynthesis": "Фотосинтез"
  ,"landing12.story.concept.chlorophyll": "Хлорофіл"
  ,"landing12.story.concept.atp": "АТФ"
  ,"landing12.story.brain.note": "Мапа показує зв’язки й навчальні стани лише тоді, коли продукт має реальні докази."
  ,"landing12.story.context.brain": "Мій Мозок"
  ,"landing12.story.context.document": "Курс біології.pdf"
  ,"landing12.story.context.goal": "Мета: іспит"
  ,"landing12.story.professor.question": "Чому це поняття досі здається складним?"
  ,"landing12.story.professor.answer": "Відтворімо його, починаючи з АТФ: спершу призначення, потім етапи, а тоді коротка перевірка вашими словами."
  ,"landing12.story.professor.session": "Сесія досвіду зберігає разом джерело, намір, історію й наступну дію."
  ,"landing12.story.oral.listen": "Слухання"
  ,"landing12.story.oral.transcript": "Транскрипція"
  ,"landing12.story.oral.answer": "Відповідь"
  ,"landing12.story.oral.visibleTranscript": "Видимий текст"
  ,"landing12.story.oral.transcriptText": "«Клітинне дихання перетворює енергію глюкози на АТФ, яку може використовувати клітина»."
  ,"landing12.story.oral.note": "Голос доповнює письмовий досвід. Збій аудіосервісу ніколи не прибирає доступний для читання вміст."
  ,"landing12.story.review.cardLabel": "Повторення поняття"
  ,"landing12.story.review.question": "Поясніть роль АТФ, не зазираючи в джерело."
  ,"landing12.story.review.tomorrow": "Приклад: повторити завтра"
  ,"landing12.story.review.note": "Справжній застосунок планує повторення за реальною історією; ця лендингова сторінка не створює розкладу."
  ,"landing12.story.review.fsrs": "Інтервальне повторення"
  ,"landing12.story.workspace.plan": "План"
  ,"landing12.story.workspace.context": "Контекст"
  ,"landing12.story.workspace.analysis": "Аналіз"
  ,"landing12.story.workspace.conclusion": "Висновок"
  ,"landing12.story.workspace.documentTitle": "Як клітини перетворюють енергію"
  ,"landing12.story.workspace.copy": "Джерело й поняття залишаються простежуваними, поки учень вибудовує аргументацію та пише підсумковий текст."
  ,"landing12.story.workspace.source": "Курс біології.pdf"
  ,"landing12.story.workspace.citation": "Цитата з джерела"
  ,"landing12.features.kicker": "Пов’язані можливості"
  ,"landing12.features.title": "Не просто набір інструментів ШІ"
  ,"landing12.features.lead": "Кожна можливість має чітку роль, але всі вони використовують ті самі джерела, сесії та навчальний контекст."
  ,"landing12.features.group.personal": "Персональний інтелект"
  ,"landing12.features.group.personal.desc": "Знає учня"
  ,"landing12.features.group.understand": "Розуміти"
  ,"landing12.features.group.understand.desc": "Запитання й джерела"
  ,"landing12.features.group.practice": "Практикувати й запам’ятовувати"
  ,"landing12.features.group.practice.desc": "Активне навчання"
  ,"landing12.features.group.produce": "Застосовувати й продовжувати"
  ,"landing12.features.group.produce.desc": "Робота й наступна дія"
  ,"landing12.feature.brain.title": "Мій Мозок"
  ,"landing12.feature.brain.desc": "Видимий когнітивний двійник для понять, зв’язків, опанування, пам’яті та історії навчання."
  ,"landing12.feature.professor.title": "ШІ-професор"
  ,"landing12.feature.professor.desc": "Педагогічна особистість, що навчає, пояснює, запитує, оцінює й адаптується до активного контексту."
  ,"landing12.feature.learn.title": "Навчання"
  ,"landing12.feature.learn.desc": "Єдине поле введення, щоб розуміти, навчатися, практикуватися, досліджувати або створювати за допомогою тексту, голосу й джерел."
  ,"landing12.feature.documents.title": "Інтелект документа"
  ,"landing12.feature.documents.desc": "Імпортуйте, осмислюйте, опитуйте й перетворюйте один документ або обмежений пакет зі збереженням простежуваності джерел."
  ,"landing12.feature.review.title": "Повторення"
  ,"landing12.feature.review.desc": "Закріплює те, що може забутися, на основі реальної історії повторень та інтервального навчання."
  ,"landing12.feature.research.title": "Дослідження"
  ,"landing12.feature.research.desc": "Швидке, підкріплене джерелами або поглиблене дослідження в Моєму Мозку й Бібліотеці; цитати завжди можна перевірити."
  ,"landing12.feature.workspace.title": "Академічний робочий простір"
  ,"landing12.feature.workspace.desc": "Постійний простір для планів, чернеток, джерел, цитат і контекстної допомоги."
  ,"landing12.feature.languages.title": "Мови й занурення"
  ,"landing12.feature.languages.desc": "Структурований курс CEFR, пов’язаний із місіями реального життя, зворотним зв’язком, повторенням і доказами практичних умінь."
  ,"landing12.feature.voice.title": "Усне мовлення й голос"
  ,"landing12.feature.voice.desc": "Говоріть, переглядайте транскрипцію й отримуйте письмову відповідь, яка залишиться доступною навіть у разі збою аудіо."
  ,"landing12.feature.next.title": "Найкраща наступна дія"
  ,"landing12.feature.next.desc": "Зрозуміло обґрунтована рекомендація, що поєднує цілі, сесії, повторення й поточний контекст."
  ,"landing12.features.researchScope": "Дослідження у власних джерелах"
  ,"landing12.features.noWebClaim": "Зовнішнього вебпостачальника не налаштовано"
  ,"landing12.features.sameContext": "Єдиний спільний контекст"
  ,"landing12.brain.kicker": "Мій Мозок"
  ,"landing12.brain.title": "Ваш видимий когнітивний двійник"
  ,"landing12.brain.lead": "Він показує, що ви знаєте, що засвоєно слабко, як пов’язані знання й що варте уваги далі."
  ,"landing12.brain.center": "Ваш навчальний контекст"
  ,"landing12.brain.knowledge": "Знання"
  ,"landing12.brain.connections": "Зв’язки"
  ,"landing12.brain.strengths": "Сильні сторони"
  ,"landing12.brain.fragilities": "Прогалини"
  ,"landing12.brain.memory": "Пам’ять"
  ,"landing12.brain.noScores": "Second Brain показує опанування й вплив лише за наявності доказів; лендингова сторінка не вигадує оцінок."
  ,"landing12.professor.kicker": "ШІ-професор"
  ,"landing12.professor.title": "Викладач, а не черговий універсальний чатбот"
  ,"landing12.professor.lead": "Він може змінювати формат досвіду, зберігаючи контекст і сесію учня."
  ,"landing12.professor.level": "Рівень"
  ,"landing12.professor.goals": "Цілі"
  ,"landing12.professor.documents": "Документи"
  ,"landing12.professor.progress": "Прогрес"
  ,"landing12.professor.identity": "Педагогічна особистість"
  ,"landing12.professor.example": "«Я можу пояснити інакше, поставити вам запитання, перейти до усної практики або перетворити складність на повторення»."
  ,"landing12.professor.mode.explain": "Пояснити"
  ,"landing12.professor.mode.teach": "Навчати"
  ,"landing12.professor.mode.question": "Запитати"
  ,"landing12.professor.mode.assess": "Оцінити"
  ,"landing12.professor.mode.voice": "Голос"
  ,"landing12.personal.kicker": "Персональний інтелект"
  ,"landing12.personal.title": "Система, що розвивається разом із вашим навчанням"
  ,"landing12.personal.lead": "Що більше ви навчаєтеся, практикуєтеся й повторюєте, то краще Second Brain впорядковує ваш контекст і добирає корисну наступну дію."
  ,"landing12.personal.learn": "Що ви вивчаєте"
  ,"landing12.personal.understand": "Що ви розумієте"
  ,"landing12.personal.forget": "Що може забутися"
  ,"landing12.personal.master": "Чим ви володієте"
  ,"landing12.personal.goals": "Чого ви хочете досягти"
  ,"landing12.personal.twin": "Жива когнітивна мапа"
  ,"landing12.personal.note": "Коли даних мало — спочатку хронологія; коли докази достатні — дослідницький граф."
  ,"landing12.personal.nbaLabel": "Приклад найкращої наступної дії"
  ,"landing12.personal.nbaAction": "Продовжити місію англійською про робочу зустріч"
  ,"landing12.personal.nbaReason": "Тому що вона пов’язана з вашою метою працювати на міжнародному рівні, а останню сесію вже можна продовжити."
  ,"landing12.languages.kicker": "Мови й занурення"
  ,"landing12.languages.title": "Вивчайте мову зі своїм ШІ-професором"
  ,"landing12.languages.lead": "Оберіть, що саме хочете вміти. Second Brain поєднає повний курс, місії реального життя, усну практику, цільове виправлення й повторення."
  ,"landing12.languages.demoDisclaimer": "Сценарій із концепції Lot 11 bis. Лише демонстрація; жодної заяви про сертифікацію чи реальний бал учня."
  ,"landing12.languages.objective": "Мета"
  ,"landing12.languages.objectiveValue": "Я хочу працювати на міжнародному рівні"
  ,"landing12.languages.missionMeeting": "Взяти участь у зустрічі"
  ,"landing12.languages.rlle": "Мовний механізм реального життя"
  ,"landing12.languages.stage.goal": "Мета"
  ,"landing12.languages.stage.course": "Курс"
  ,"landing12.languages.stage.mission": "Місія"
  ,"landing12.languages.stage.conversation": "Розмова з Професором"
  ,"landing12.languages.stage.gap": "Виявлена складність"
  ,"landing12.languages.stage.micro-lesson": "Мікроурок"
  ,"landing12.languages.stage.retry": "Нова спроба"
  ,"landing12.languages.stage.vocabulary": "Корисні мовні засоби"
  ,"landing12.languages.stage.review": "Повторення"
  ,"landing12.languages.stage.functional-progress": "Прогрес умінь"
  ,"landing12.languages.stage.goal.note": "Реальна мета учня визначає пріоритети курсу."
  ,"landing12.languages.stage.course.note": "CEFR структурує шлях, але не подається як зовнішня сертифікація."
  ,"landing12.languages.stage.mission.note": "Світова місія перетворює знання на конкретне комунікативне завдання."
  ,"landing12.languages.stage.conversation.note": "Мова навчання залишається відокремленою від мови інтерфейсу."
  ,"landing12.languages.stage.gap.note": "Прогалина ґрунтується на спостережених доказах, а не на декоративному показнику."
  ,"landing12.languages.stage.micro-lesson.note": "Перед новою спробою виправлення зосереджується саме на перешкоді."
  ,"landing12.languages.stage.retry.note": "Повторна спроба дає учневі змогу негайно застосувати виправлення."
  ,"landing12.languages.stage.vocabulary.note": "Відібрані мовні засоби зберігають походження з місії та сесії."
  ,"landing12.languages.stage.review.note": "Лексика може перейти до чинного процесу повторення й FSRS."
  ,"landing12.languages.stage.functional-progress.note": "У реальному продукті вміння підтверджується лише прийнятими доказами."
  ,"landing12.languages.path.goal": "Практична мета, а не розмита тема"
  ,"landing12.languages.path.goal.desc": "Курс починається із ситуації, з якою учень хоче впоратися в реальному житті."
  ,"landing12.languages.path.course": "Структурований шлях B1"
  ,"landing12.languages.path.course.desc": "Навчальна програма, напрями й місії залишаються пов’язаними, а не перетворюються на окремі мініпрограми."
  ,"landing12.languages.path.mission": "Зустріч як реальне завдання"
  ,"landing12.languages.path.mission.desc": "Професор створює контекстну розмову, помічає перешкоди й супроводжує цикл виправлення."
  ,"landing12.languages.professorLabel": "ШІ-професор · Англійська B1"
  ,"landing12.languages.transcriptVisible": "У застосунку стан голосу й транскрипція залишаються явними та доступними для редагування."
  ,"landing12.languages.gapDetected": "Виявлена практична прогалина"
  ,"landing12.languages.gapExplanation": "Задум зрозумілий, але форма прислівника заважає природному професійному реченню. У реальному продукті ця виявлена складність може потрапити до Пам’яті помилок, щоб згодом Цикл виправлення працював саме з нею."
  ,"landing12.languages.gapGrammar": "Граматика"
  ,"landing12.languages.gapFluency": "Плавність мовлення"
  ,"landing12.languages.microLesson": "Цільове виправлення"
  ,"landing12.languages.microRule": "Використовуйте прислівник, щоб описати, як працює команда."
  ,"landing12.languages.microHint": "Професор пов’язує правило з реченням, а не відкриває сторонній урок."
  ,"landing12.languages.retryLabel": "Спробуйте виконати те саме завдання ще раз"
  ,"landing12.languages.retryObserved": "Виправлена конструкція з’являється в новій спробі"
  ,"landing12.languages.vocabularyTitle": "Мовні засоби, відібрані з цієї місії"
  ,"landing12.languages.vocabularyTrace": "У продукті кожен збережений елемент містить відомості про мову, джерело й сесію походження."
  ,"landing12.languages.reviewLabel": "Пов’язано з Повторенням"
  ,"landing12.languages.reviewAction": "Закріпити корисну конструкцію в належний час"
  ,"landing12.languages.reviewTrace": "Реальний розклад створюється з фактичних доказів повторення; ця демонстрація нічого не створює."
  ,"landing12.languages.canDoTitle": "Що я вже вмію"
  ,"landing12.languages.canDo.introduce": "Представитися"
  ,"landing12.languages.canDo.restaurant": "Зробити замовлення в ресторані"
  ,"landing12.languages.canDo.meeting": "Взяти участь у зустрічі"
  ,"landing12.languages.canDo.opinion": "Захистити думку"
  ,"landing12.languages.canDoDisclaimer": "Ілюстративний список. У застосунку вміння можна підтвердити лише доказами."
  ,"landing12.languages.courseTitle": "Повний мовний курс"
  ,"landing12.languages.courseLead": "Розмова — лише одна частина курсу поряд із цілеспрямованим вивченням мови та розумінням."
  ,"landing12.languages.strand.vocabulary": "Словниковий запас"
  ,"landing12.languages.strand.grammar": "Граматика"
  ,"landing12.languages.strand.verbs": "Дієслова"
  ,"landing12.languages.strand.conjugation": "Дієвідмінювання"
  ,"landing12.languages.strand.reading": "Читання"
  ,"landing12.languages.strand.writing": "Письмо"
  ,"landing12.languages.strand.listening": "Сприйняття на слух"
  ,"landing12.languages.strand.oral": "Усне мовлення"
  ,"landing12.languages.strand.pronunciation": "Вимова"
  ,"landing12.languages.strand.mediation": "Медіація"
  ,"landing12.languages.missionsTitle": "Світові місії"
  ,"landing12.languages.missionsLead": "Обмежений каталог ситуацій для застосування мови, кожна з метою та мінімальним рівнем."
  ,"landing12.languages.mission.travel": "Подорожі"
  ,"landing12.languages.mission.work": "Робота"
  ,"landing12.languages.mission.studies": "Навчання"
  ,"landing12.languages.mission.social": "Соціальне життя"
  ,"landing12.languages.registryTitle": "34 підтримувані мови навчання"
  ,"landing12.languages.registryLead": "Назви рідною мовою та мовою інтерфейсу передають зміст. Якщо прапор однієї країни був би неоднозначним, його замінює нейтральний символ."
  ,"landing12.how.kicker": "Як це працює"
  ,"landing12.how.title": "Простий шлях, навіть коли інтелект складний"
  ,"landing12.how.lead": "Ви задаєте намір. Second Brain приховує технічну складність за єдиним безперервним досвідом."
  ,"landing12.how.goal.title": "Вкажіть свою мету"
  ,"landing12.how.goal.desc": "Скажіть, що хочете зрозуміти або здійснити."
  ,"landing12.how.act.title": "Навчайтеся, імпортуйте або запитуйте"
  ,"landing12.how.act.desc": "Використовуйте текст, голос, скан або файл."
  ,"landing12.how.context.title": "Сформуйте контекст"
  ,"landing12.how.context.desc": "Об’єднайте доречні сесії, джерела й цілі."
  ,"landing12.how.practice.title": "Практикуйтеся"
  ,"landing12.how.practice.desc": "Перейдіть від пояснення до активного досвіду."
  ,"landing12.how.consolidate.title": "Закріплюйте"
  ,"landing12.how.consolidate.desc": "Повторюйте те, що докази визначають як слабко засвоєне."
  ,"landing12.how.continue.title": "Продовжуйте"
  ,"landing12.how.continue.desc": "Виконайте одну зрозуміло обґрунтовану наступну дію."
  ,"landing12.nba.kicker": "Найкраща наступна дія"
  ,"landing12.nba.title": "Знайте, що зараз заслуговує на увагу"
  ,"landing12.nba.lead": "Рекомендації враховують реальний контекст і пояснюють свою користь. Це пропозиції, а не невидимі накази."
  ,"landing12.nba.english": "Продовжити курс англійської"
  ,"landing12.nba.review": "Повторити 5 понять, для яких настав час"
  ,"landing12.nba.workspace": "Продовжити план дипломної роботи"
  ,"landing12.nba.professor": "Продовжити сесію з Професором"
  ,"landing12.nba.why": "Чому ця рекомендація? · Мета й сесія, яку можна продовжити"
  ,"landing12.platform.web": "Веб"
  ,"landing12.platform.android": "Android"
  ,"landing12.platform.ios": "iOS"
  ,"landing12.platform.windows": "Windows"
  ,"landing12.platform.macos": "macOS"
  ,"landing12.platform.status.available": "Доступно"
  ,"landing12.platform.status.prepared": "Застосунок технічно готовий; загальнодоступного посилання в магазині ще немає"
  ,"landing12.platform.status.coming-soon": "Незабаром; загальнодоступного посилання для завантаження ще немає"
  ,"landing12.download.kicker": "Безперервність на різних платформах"
  ,"landing12.download.title": "Second Brain усюди, де ви навчаєтеся"
  ,"landing12.download.lead": "Почніть із вебверсії вже сьогодні. Доступність мобільної й настільної версій показується чесно, щойно вони з’являються."
  ,"landing12.download.continuity": "Модель сесій дає змогу почати на одному пристрої та продовжити на іншому."
  ,"landing12.download.webAction": "Використовувати у вебверсії"
  ,"landing12.download.sameSession": "Та сама сесія"
  ,"landing12.download.synced": "Контекст готовий до продовження"
  ,"landing12.privacy.kicker": "Конфіденційність і контроль"
  ,"landing12.privacy.title": "Ваші дані залишаються під вашим контролем"
  ,"landing12.privacy.lead": "Second Brain містить налаштування рівня облікового запису для пам’яті, документів, перенесення та видалення даних."
  ,"landing12.privacy.scope": "Це налаштування продукту, а не додаткова юридична гарантія чи обіцянка безпеки."
  ,"landing12.privacy.memory": "Керувати пам’яттю ШІ"
  ,"landing12.privacy.export": "Експортувати свої дані"
  ,"landing12.privacy.documents": "Керувати своїми документами"
  ,"landing12.privacy.delete": "Подати підтверджений запит на видалення облікового запису"
  ,"landing12.pricing.kicker": "Free · Pro · Max"
  ,"landing12.pricing.title": "Три індивідуальні пропозиції без вигаданих подробиць"
  ,"landing12.pricing.lead": "Остаточні ціни, квоти й переваги визначать після публічного бета-тестування. Наразі лендингова сторінка показує лише реальний каталог."
  ,"landing12.pricing.free.name": "Free"
  ,"landing12.pricing.free.desc": "Стандартна індивідуальна пропозиція для знайомства з можливостями Second Brain."
  ,"landing12.pricing.pro.name": "Pro"
  ,"landing12.pricing.pro.desc": "Розширена індивідуальна пропозиція, остаточні ціна, квоти й переваги якої ще налаштовуються."
  ,"landing12.pricing.max.name": "Max"
  ,"landing12.pricing.max.desc": "Найповніша індивідуальна пропозиція; її остаточні комерційні умови ще налаштовуються."
  ,"landing12.pricing.freeStatus": "Безкоштовна пропозиція доступна"
  ,"landing12.pricing.pending": "Подробиці після публічного бета-тестування"
  ,"landing12.pricing.sourceNote": "Екрани підписки після входу й надалі отримують дані з бекенда. Жодної ціни, знижки, квоти чи виняткової переваги тут не закодовано жорстко."
  ,"landing12.faq.kicker": "Корисні відповіді"
  ,"landing12.faq.title": "Є запитання? Ми відповімо."
  ,"landing12.faq.lead": "Короткі відповіді про те, що продукт справді робить сьогодні."
  ,"landing12.faq.q1": "Що таке Second Brain?"
  ,"landing12.faq.a1": "Персональна інтелектуальна система навчання, що в єдиному контексті поєднує запитання, джерела, викладання, практику, пам’ять і академічну роботу."
  ,"landing12.faq.q2": "Це просто чатбот?"
  ,"landing12.faq.a2": "Ні. Розмова — лише один з інтерфейсів. Та сама сесія може стати уроком, усною вправою, запитанням до документа з посиланнями на джерела, повторенням або дією в Робочому просторі."
  ,"landing12.faq.q3": "Як працює Мій Мозок?"
  ,"landing12.faq.a3": "Він унаочнює ваші поняття, зв’язки, докази опанування, пам’ять та історію навчання. Подання адаптується до зрілості доступних даних."
  ,"landing12.faq.q4": "Чи можу я використовувати власні документи?"
  ,"landing12.faq.a4": "Так. Бібліотека приймає підтримувані файли й скани, показує реальні стани обробки, виділяє поняття та дає змогу ставити обґрунтовані запитання й перетворювати матеріал."
  ,"landing12.faq.q5": "Чи можу я вивчати мову?"
  ,"landing12.faq.a5": "Так. Мовний механізм реального життя поєднує програму CEFR, цілеспрямовану роботу з мовою, Світові місії, усну практику, точкове виправлення, повторення й докази вмінь."
  ,"landing12.faq.q6": "Як працює ШІ-професор?"
  ,"landing12.faq.a6": "Він використовує активний контекст учня та може пояснювати, навчати, запитувати, оцінювати або практикуватися, зберігаючи Сесію досвіду."
  ,"landing12.faq.q7": "Як працюють повторення?"
  ,"landing12.faq.a7": "Повторення використовує фактичну історію та інтервальний метод, щоб надавати перевагу знанням, які можуть забутися. Повторення без ШІ залишається доступним незалежно від квот ШІ."
  ,"landing12.faq.q8": "Які мови доступні?"
  ,"landing12.faq.a8": "Спільний реєстр наразі містить 34 мови навчання. Мова інтерфейсу й мова навчання завжди обираються окремо."
  ,"landing12.faq.q9": "Чи шукає Дослідження у вебі?"
  ,"landing12.faq.a9": "Наразі Дослідження може працювати з Моїм Мозком і вашою Бібліотекою. У поточному розгортанні зовнішнього вебпостачальника не налаштовано, тому лендингова сторінка не стверджує, що він доступний."
  ,"landing12.faq.q10": "Чи мої дані конфіденційні?"
  ,"landing12.faq.a10": "Налаштування після входу охоплюють пам’ять ШІ, документи, згоди, експорт і видалення облікового запису. Ця сторінка не додає юридичних або інфраструктурних обіцянок понад ці налаштування."
  ,"landing12.faq.q11": "Чим відрізняються Free, Pro та Max?"
  ,"landing12.faq.a11": "Це три рівні індивідуальних планів у каталозі бекенда. Остаточні ціни, квоти й переваги планів налаштують після публічного бета-тестування."
  ,"landing12.faq.q12": "Де можна користуватися Second Brain?"
  ,"landing12.faq.a12": "У цьому застосунку доступна вебверсія. Android та iOS технічно підготовлені, але загальнодоступних посилань у магазинах ще немає; версії для Windows і macOS з’являться пізніше."
  ,"landing12.contact.kicker": "Контакти й підтримка"
  ,"landing12.contact.title": "Розкажіть, що вам потрібно"
  ,"landing12.contact.lead": "Загальнодоступний спосіб зв’язку залишається прозорим: він відкриває канал електронної пошти лише тоді, коли налаштовано публічну адресу підтримки."
  ,"landing12.contact.write": "Написати в підтримку"
  ,"landing12.contact.account": "Увійти до облікового запису"
  ,"landing12.contact.notConfigured": "Публічну адресу підтримки ще не налаштовано. Увійдіть, щоб керувати обліковим записом і даними; надсилання повідомлення не імітуватиметься."
  ,"landing12.contact.subject": "Запит до підтримки Second Brain"
  ,"landing12.contact.general": "Загальне запитання"
  ,"landing12.contact.general.desc": "Дізнатися про продукт або його доступність."
  ,"landing12.contact.technical": "Технічна підтримка"
  ,"landing12.contact.technical.desc": "Повідомити про проблему під час використання застосунку."
  ,"landing12.contact.billing": "Підписка й оплата"
  ,"landing12.contact.billing.desc": "Запитання про пропозицію, рахунок або платіж."
  ,"landing12.contact.privacy": "Конфіденційність і дані"
  ,"landing12.contact.privacy.desc": "Запитання про пам’ять, експорт або видалення."
  ,"landing12.contact.problem": "Повідомити про проблему"
  ,"landing12.contact.problem.desc": "Описати відтворювану проблему продукту."
  ,"landing12.contact.feedback": "Пропозиції та відгуки"
  ,"landing12.contact.feedback.desc": "Поділитися ідеєю для покращення досвіду."
  ,"report.title": "Повідомити про проблему"
  ,"report.intro": "Розкажіть, що сталося. Ваше повідомлення переглянуть люди; це не команда для системи й воно не запускає автоматичне виправлення."
  ,"report.category": "Чого стосується проблема?"
  ,"report.category.app_not_working": "Застосунок не працює"
  ,"report.category.ai_teacher_problem": "ШІ-викладач"
  ,"report.category.document_pdf_problem": "Документ або PDF"
  ,"report.category.voice_problem": "Голос"
  ,"report.category.language_learning_problem": "Вивчення мови"
  ,"report.category.revision_problem": "Повторення"
  ,"report.category.brain_digital_twin_problem": "Мій Мозок або цифровий двійник"
  ,"report.category.subscription_payment_problem": "Підписка або платіж"
  ,"report.category.account_login_problem": "Обліковий запис або вхід"
  ,"report.category.other": "Інше"
  ,"report.description": "Опишіть проблему"
  ,"report.placeholder": "Що ви намагалися зробити й що сталося натомість?"
  ,"report.counter": "{count}/{max} символів"
  ,"report.minimum": "Введіть щонайменше {min} символів."
  ,"report.privacyTitle": "Не додавайте чутливих даних"
  ,"report.privacyDetail": "Не вказуйте паролі, коди доступу, платіжні дані, приватні документи, вміст розмов або персональні дані. Перед надсиланням значення, схожі на чутливі, буде приховано."
  ,"report.consent": "Я дозволяю передати обмежені додаткові діагностичні дані, якщо вони знадобляться. Це необов’язково; повідомлення можна надіслати й без них."
  ,"report.contextTitle": "Обмежений діагностичний контекст"
  ,"report.contextDetail": "Застосунок надсилає лише категорію повідомлення, обмежений за обсягом опис, безпечну назву маршруту, версію застосунку/збірки, платформу й непрозорий ідентифікатор запиту. Він не надсилає знімків екрана, документів, розмов або аудіо."
  ,"report.attachments": "Вкладення"
  ,"report.attachmentsDetail": "НЕ РЕАЛІЗОВАНО — вкладення навмисно недоступні для повідомлень про проблеми."
  ,"report.submit": "Надіслати повідомлення"
  ,"report.successTitle": "Повідомлення надіслано"
  ,"report.successDetail": "Дякуємо. Людина може зіставити його з безпечною телеметрією; це не підтверджує причину й не вносить автоматичних змін."
  ,"report.error": "Не вдалося надіслати повідомлення. Автоматичних повторних спроб не було."
  ,"report.profileTitle": "Допомога й повідомлення про проблеми"
  ,"report.profileDetail": "Повідомте про проблему продукту, не додаючи приватного навчального вмісту."
  ,"report.open": "Повідомити про проблему"
  ,"landing12.final.kicker": "Один продукт. Єдиний досвід."
  ,"landing12.final.title": "Створіть систему, яка навчається разом із вами"
  ,"landing12.final.lead": "Почніть з одного наміру. Збережіть контекст. Продовжуйте з правильної наступної дії."
  ,"landing12.footer.tagline": "Ваша персональна інтелектуальна система навчання: розумійте, практикуйтеся, запам’ятовуйте й створюйте в єдиному безперервному контексті."
  ,"landing12.footer.beta": "Публічна бета-версія · можливості й комерційні налаштування продовжують розвиватися."
  ,"landing12.footer.product": "Продукт"
  ,"landing12.footer.resources": "Ресурси"
  ,"landing12.footer.features": "Можливості"
  ,"landing12.footer.brain": "Мій Мозок"
  ,"landing12.footer.languages": "Мови"
  ,"landing12.footer.pricing": "Тарифи"
  ,"landing12.footer.download": "Завантажити"
  ,"landing12.footer.how": "Як це працює"
  ,"landing12.footer.faq": "Часті запитання"
  ,"landing12.footer.contact": "Контакти"
  ,"landing12.footer.account": "Обліковий запис"
  ,"landing12.footer.privacy": "Конфіденційність і керування даними"
  ,"landing12.footer.copy": "© 2026 Second Brain. Усі демонстрації продукту є загальнодоступними прикладами."
  ,"landing12.footer.noTracking": "Без вигаданих партнерів, відгуків чи показників."
  ,"capture.permission.pending": "Готуємо камеру…"
  ,"capture.permission.title": "Потрібен дозвіл на використання камери"
  ,"capture.permission.detail": "Second Brain відкриває камеру лише після вашої дії. Ви також можете імпортувати наявне зображення."
  ,"capture.permission.allow": "Дозволити камеру"
  ,"capture.importFallback": "Імпортувати зображення"
  ,"capture.error.capture": "Не вдалося зробити фото."
  ,"capture.error.fallback": "Закрийте інший застосунок, що використовує камеру, перевірте дозвіл або імпортуйте зображення."
  ,"capture.error.unavailable": "Доступної камери не знайдено."
  ,"capture.error.paused": "Камеру призупинено."
  ,"capture.error.denied": "У доступі до камери відмовлено."
  ,"capture.error.secureContext": "Для камери потрібне захищене з’єднання HTTPS."
  ,"capture.error.busy": "Камера недоступна або вже використовується."
  ,"capture.retake": "Перезняти"
  ,"capture.confirm": "Використати це фото"
  ,"capture.take": "Зробити фото"
  ,"capture.switch": "Перемкнути камеру"
  ,"capture.preview": "Попередній перегляд із камери наживо"
  ,"capture.cameraChoice": "Виберіть камеру"
  ,"capture.camera": "Камера"
  ,"qr.title": "Зчитати QR-код"
  ,"qr.detail": "Наведіть камеру на QR-код. Його вміст залишатиметься неактивним, доки ви його не перевірите."
  ,"qr.aim": "Тримайте QR-код у межах рамки."
  ,"qr.unsupported": "Цей браузер не підтримує зчитування QR-кодів"
  ,"qr.unsupportedDetail": "Скористайтеся сумісним браузером із HTTPS або іншим пристроєм. Жоден вміст не відкрито."
  ,"qr.detected": "Виявлено адресу з QR-коду"
  ,"qr.confirmDetail": "Перевірте повну адресу перед відкриттям."
  ,"qr.open": "Відкрити цю адресу"
  ,"qr.openError": "Не вдалося відкрити цю адресу. Її не виконано й не імпортовано."
  ,"qr.noneFound": "QR-код не знайдено. Розташуйте його в кадрі й спробуйте ще раз."
  ,"qr.scanAgain": "Зчитати інший QR-код"
  ,"qr.textDetected": "Виявлено текст у QR-коді"
  ,"qr.textInert": "Цей текст лише показано. Він не виконується й не надсилається ШІ-викладачу."
  ,"qr.done": "Готово"
  ,"qr.blocked": "Небезпечну адресу з QR-коду заблоковано"
  ,"qr.blockedDetail": "Відкривати можна лише явні посилання HTTP та HTTPS. Власні схеми, а також схеми файлів, даних і сценаріїв відхиляються."
  ,"scan.importError": "Не вдалося імпортувати вибрані зображення."
  ,"scan.editError": "Не вдалося відредагувати цю сторінку. Інші сторінки збережено."
  ,"scan.uploadError": "Не вдалося зберегти скан."
  ,"scan.inProgress": "Цей скан ще обробляється. Спробуйте знову за мить."
  ,"scan.retryNewAttempt": "Попередня спроба безпечно завершилася. Натисніть «Зберегти» ще раз, щоб розпочати нову спробу сканування."
  ,"scan.returnToLearn": "Повернутися до Навчання з цим документом"
  ,"scan.captureFirst": "Перевірте перед збереженням"
  ,"scan.captureFirstDetail": "Зніміть або імпортуйте сторінки, змініть їх порядок, обрізання й поворот, а потім підтвердьте. До фінальної дії нічого не завантажується."
  ,"scan.retryPreserved": "Ваші сторінки залишаться тут, тож ви зможете повторити спробу без нового знімання."
  ,"scan.pagePosition": "Сторінка {current} з {total}"
  ,"scan.moveBefore": "Перемістити ліворуч"
  ,"scan.moveAfter": "Перемістити праворуч"
  ,"scan.rotate": "Повернути"
  ,"scan.crop": "Налаштувати обрізання"
  ,"scan.perspectiveLimit": "Доступні шаблони обрізання по центру. Налаштування країв сторінки й виправлення перспективи поки недоступні."
  ,"learn5.capture.photo": "Фото"
  ,"learn5.capture.document": "Сканувати документ"
  ,"learn5.capture.qr": "Зчитати QR-код"
  ,"profile.card.webcam": "Використати вебкамеру"
  ,"profile.card.importImage": "Імпортувати зображення"
  ,"profile.email.verified": "Електронну адресу підтверджено"
  ,"profile.email.unverified": "Електронну адресу не підтверджено"
  ,"profile.edit": "Редагувати мій профіль"
  ,"profile.avatar.loadError": "Не вдалося завантажити збережене фото профілю."
  ,"profile.avatar.saveError": "Не вдалося зберегти нове фото профілю."
  ,"profile.avatar.removeError": "Не вдалося видалити фото профілю."
  ,"profile.avatar.denied": "У доступі до фотографій відмовлено."
  ,"profile.avatar.error": "Не вдалося відкрити вибір зображення."
  ,"profile.avatar.preserved": "Попереднє збережене фото не змінено. Можна безпечно повторити спробу."
  ,"profile.avatar.editorTitle": "Налаштуйте фото профілю"
  ,"profile.avatar.editorDetail": "Перегляньте круглий результат. Поворот і масштаб застосуються лише після підтвердження."
  ,"profile.avatar.rotate": "Повернути"
  ,"profile.avatar.zoomOut": "Зменшити"
  ,"profile.avatar.zoomIn": "Збільшити"
  ,"profile.avatar.confirm": "Зберегти це фото"
};

registerLocale('uk', "Українська", uk);
