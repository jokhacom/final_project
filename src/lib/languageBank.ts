// Готовые вопросы для игры «Грамотность». Добавляются в базу кнопкой в «Админ» → «Обучение»
// (повторное нажатие не создаёт дублей), после этого любой вопрос можно изменить или удалить.
// Узбекские — по «Oʻzbek tilining asosiy imlo qoidalari» (1995): oʻ, gʻ со знаком ʻ, tutuq belgisi — ʼ.
// Правильный вариант везде первый — в игре варианты перемешиваются.

export type StarterItem = { category: string; prompt: string; options: string[]; explanation: string };

const RU_Q = "Как правильно?";
const UZ_Q = "Qaysi biri toʻgʻri yozilgan?";

export const LANGUAGE_BANK: Record<"ru" | "uz", StarterItem[]> = {
  ru: [
    // Предлоги и падежи
    { category: "Предлоги", prompt: RU_Q, options: ["в течение трёх рабочих дней", "в течении трёх рабочих дней"], explanation: "Предлог «в течение» (о времени) пишется с «е» на конце." },
    { category: "Предлоги", prompt: RU_Q, options: ["по приезде в офис", "по приезду в офис"], explanation: "«По» в значении «после» требует предложного падежа: по приезде, по прибытии, по окончании." },
    { category: "Предлоги", prompt: RU_Q, options: ["по истечении срока", "по истечению срока"], explanation: "«По» в значении «после»: по истечении, по завершении." },
    { category: "Предлоги", prompt: RU_Q, options: ["согласно приказу", "согласно приказа"], explanation: "«Согласно» употребляется с дательным падежом: согласно чему? — приказу." },
    { category: "Предлоги", prompt: RU_Q, options: ["благодаря вашему обращению", "благодаря вашего обращения"], explanation: "«Благодаря» — с дательным падежом: благодаря чему?" },
    { category: "Предлоги", prompt: RU_Q, options: ["оплатить проезд", "оплатить за проезд"], explanation: "Оплатить что? — проезд. Заплатить за что? — за проезд." },
    // Слитно или раздельно
    { category: "Слитно или раздельно", prompt: RU_Q, options: ["вследствие задержки платежа", "в следствие задержки платежа"], explanation: "Предлог «вследствие» (= из-за) пишется слитно." },
    { category: "Слитно или раздельно", prompt: RU_Q, options: ["ввиду технических работ", "в виду технических работ"], explanation: "Предлог «ввиду» (= из-за) пишется слитно." },
    { category: "Слитно или раздельно", prompt: RU_Q, options: ["насчёт вашего вопроса", "на счёт вашего вопроса"], explanation: "«Насчёт» (= о чём) — слитно. Раздельно — только о деньгах: «на счёт в банке»." },
    { category: "Слитно или раздельно", prompt: RU_Q, options: ["Чтобы получить справку, заполните заявление.", "Что бы получить справку, заполните заявление."], explanation: "Союз «чтобы» (цель) пишется слитно." },
    { category: "Слитно или раздельно", prompt: RU_Q, options: ["Мы также проверили ваш платёж.", "Мы так же проверили ваш платёж."], explanation: "«Также» = «и ещё» — слитно. «Так же» = «таким же образом» — раздельно." },
    { category: "Слитно или раздельно", prompt: RU_Q, options: ["Я тоже так думаю.", "Я то же так думаю."], explanation: "«Тоже» = «также» — слитно." },
    { category: "Слитно или раздельно", prompt: RU_Q, options: ["Ответим вовремя.", "Ответим во время."], explanation: "«Вовремя» = в срок — слитно. «Во время» — «в период»: во время звонка." },
    { category: "Слитно или раздельно", prompt: RU_Q, options: ["Сначала проверьте данные.", "С начала проверьте данные."], explanation: "«Сначала» = «сперва» — слитно." },
    { category: "Слитно или раздельно", prompt: RU_Q, options: ["пойти навстречу клиенту", "пойти на встречу клиенту"], explanation: "«Навстречу» (уступить) — слитно; «на встречу» — на мероприятие." },
    { category: "Слитно или раздельно", prompt: RU_Q, options: ["полчаса", "пол часа", "пол-часа"], explanation: "«Пол-» пишется слитно, если следующее слово начинается с согласной (кроме л): полчаса." },
    // Дефис
    { category: "Дефис", prompt: RU_Q, options: ["по-русски", "по русски", "порусски"], explanation: "Наречия с «по-» на «-ски» пишутся через дефис." },
    { category: "Дефис", prompt: RU_Q, options: ["кто-нибудь", "кто нибудь", "ктонибудь"], explanation: "Частицы -то, -либо, -нибудь пишутся через дефис." },
    { category: "Дефис", prompt: RU_Q, options: ["всё-таки", "всё таки", "всётаки"], explanation: "«Всё-таки» пишется через дефис." },
    { category: "Дефис", prompt: RU_Q, options: ["из-за ошибки в данных", "из за ошибки в данных"], explanation: "Предлоги «из-за», «из-под» — через дефис." },
    // НЕ и НИ
    { category: "НЕ и НИ", prompt: RU_Q, options: ["Платёж ещё не поступил.", "Платёж ещё непоступил."], explanation: "НЕ с глаголами пишется раздельно." },
    { category: "НЕ и НИ", prompt: RU_Q, options: ["Не волнуйтесь, мы всё проверим.", "Неволнуйтесь, мы всё проверим."], explanation: "НЕ с глаголами пишется раздельно." },
    { category: "НЕ и НИ", prompt: RU_Q, options: ["Ни разу не было ошибок.", "Не разу не было ошибок."], explanation: "«Ни разу» — с НИ (усиление отрицания)." },
    // -тся / -ться
    { category: "-тся / -ться", prompt: RU_Q, options: ["Документы проверяются.", "Документы проверяються."], explanation: "Что делают? — проверяются: без ь." },
    { category: "-тся / -ться", prompt: RU_Q, options: ["Нужно обратиться в банк.", "Нужно обратится в банк."], explanation: "Что сделать? — обратиться: с ь." },
    { category: "-тся / -ться", prompt: RU_Q, options: ["Заявка рассматривается.", "Заявка рассматриваеться."], explanation: "Что делает? — рассматривается: без ь." },
    // Суффиксы
    { category: "Суффиксы", prompt: RU_Q, options: ["деревянный", "деревяный"], explanation: "Исключения с -нн-: стеклянный, оловянный, деревянный." },
    { category: "Суффиксы", prompt: RU_Q, options: ["кожаный", "кожанный"], explanation: "Суффикс -ан- пишется с одной н: кожаный, серебряный." },
    { category: "Суффиксы", prompt: RU_Q, options: ["переводчик", "переводщик"], explanation: "После д, т, з, с, ж пишется -чик: переводчик, разведчик." },
    { category: "Суффиксы", prompt: RU_Q, options: ["замочек", "замочик"], explanation: "Е выпадает при склонении (замочка) — пишем -ек." },
    { category: "Суффиксы", prompt: RU_Q, options: ["ключик", "ключек"], explanation: "И сохраняется при склонении (ключика) — пишем -ик." },
    { category: "Суффиксы", prompt: RU_Q, options: ["оплачивать", "оплачевать"], explanation: "Оплачиваю — значит суффикс -ива-: оплачивать." },
    // Приставки
    { category: "Приставки", prompt: RU_Q, options: ["бесплатно", "безплатно"], explanation: "Перед глухой согласной пишется бес-: бесплатно, бесполезно." },
    { category: "Приставки", prompt: RU_Q, options: ["рассчитать", "расчитать"], explanation: "Приставка рас- + корень -счит-: рассчитать." },
    { category: "Приставки", prompt: RU_Q, options: ["прийти", "придти"], explanation: "Правильно только «прийти»." },
    // Окончания и формы слов
    { category: "Окончания", prompt: RU_Q, options: ["в пятистах метрах", "в пятиста метрах"], explanation: "В предложном падеже: о пятистах." },
    { category: "Окончания", prompt: RU_Q, options: ["около полутора часов", "около полторы часа"], explanation: "«Полтора» в косвенных падежах — «полутора»." },
    { category: "Окончания", prompt: RU_Q, options: ["обеими руками", "обоими руками"], explanation: "С существительными женского рода — «обеими»." },
    { category: "Окончания", prompt: RU_Q, options: ["их заявка", "ихняя заявка"], explanation: "«Ихний» — просторечие. Правильно: их." },
    { category: "Окончания", prompt: RU_Q, options: ["Положите документы на стол.", "Ложите документы на стол."], explanation: "«Ложить» без приставки не употребляется: класть, положить." },
    // Орфография
    { category: "Орфография", prompt: RU_Q, options: ["Здравствуйте", "Здраствуйте"], explanation: "Здравствуйте — от «здравствовать», первая в не читается, но пишется." },
    { category: "Орфография", prompt: RU_Q, options: ["пожалуйста", "пожалуста", "пожайлуста"], explanation: "Пожалуйста — с «й» после «а»." },
    { category: "Орфография", prompt: RU_Q, options: ["агентство", "агенство"], explanation: "Агент + -ство: агентство." },
    { category: "Орфография", prompt: RU_Q, options: ["инцидент", "инциндент"], explanation: "Правильно: инцидент — без второй «н»." },
    { category: "Орфография", prompt: RU_Q, options: ["в общем", "вообщем"], explanation: "«В общем» всегда пишется раздельно." },
    { category: "Орфография", prompt: RU_Q, options: ["извините", "извените"], explanation: "Проверочное слово — «извинение»." },
    { category: "Орфография", prompt: RU_Q, options: ["компенсация", "компенцация"], explanation: "Компенсация — от «компенсировать»." },
    { category: "Орфография", prompt: RU_Q, options: ["аккаунт", "акаунт"], explanation: "Аккаунт — с двумя «к»." },
    // Паронимы
    { category: "Похожие слова", prompt: "Банк ___ вам справку о доходах.", options: ["предоставит", "представит"], explanation: "Предоставить = дать. Представить = познакомить или показать." },
    { category: "Похожие слова", prompt: "Не забудьте ___ маску.", options: ["надеть", "одеть"], explanation: "Надеть что-то на себя, одеть кого-то." },
    { category: "Похожие слова", prompt: "Номер ___ недоступен.", options: ["абонента", "абонемента"], explanation: "Абонент — человек. Абонемент — право пользоваться услугой." },
    { category: "Похожие слова", prompt: "Это самый ___ способ решить проблему.", options: ["эффективный", "эффектный"], explanation: "Эффективный = результативный. Эффектный = яркий, производящий впечатление." },
    // Пунктуация
    { category: "Пунктуация", prompt: RU_Q, options: ["Здравствуйте, Анна!", "Здравствуйте Анна!"], explanation: "Обращение выделяется запятой." },
    { category: "Пунктуация", prompt: RU_Q, options: ["Спасибо, что обратились к нам.", "Спасибо что обратились к нам."], explanation: "Перед «что» в сложном предложении ставится запятая." },
    { category: "Пунктуация", prompt: RU_Q, options: ["К сожалению, платёж не прошёл.", "К сожалению платёж не прошёл."], explanation: "Вводное слово «к сожалению» выделяется запятой." },
    // Ударение
    { category: "Ударение", prompt: "Где ударение?", options: ["звонИт", "звОнит"], explanation: "Звонит, звонят, позвонит — ударение на окончании." },
    { category: "Ударение", prompt: "Где ударение?", options: ["договОр", "дОговор"], explanation: "Литературная норма: договОр, договОры." },
    { category: "Ударение", prompt: "Где ударение?", options: ["каталОг", "катАлог"], explanation: "Правильно: каталОг." },
    { category: "Ударение", prompt: "Где ударение?", options: ["квартАл", "квАртал"], explanation: "Правильно: квартАл (и о годе, и о районе)." },
    { category: "Ударение", prompt: "Где ударение?", options: ["облегчИть", "облЕгчить"], explanation: "Правильно: облегчИть, облегчИт." },
  ],
  uz: [
    // Tutuq belgisi
    { category: "Tutuq belgisi", prompt: UZ_Q, options: ["maʼlumot", "malumot"], explanation: "Arab tilidan kirgan soʻzlarda tutuq belgisi (ʼ) yoziladi: maʼlumot, taʼlim, sanʼat." },
    { category: "Tutuq belgisi", prompt: UZ_Q, options: ["taʼlim", "talim"], explanation: "Tutuq belgisi (ʼ) bilan yoziladi: taʼlim." },
    { category: "Tutuq belgisi", prompt: UZ_Q, options: ["eʼlon", "elon"], explanation: "Tutuq belgisi (ʼ) bilan yoziladi: eʼlon." },
    { category: "Tutuq belgisi", prompt: UZ_Q, options: ["masʼuliyat", "masuliyat"], explanation: "Tutuq belgisi (ʼ) bilan yoziladi: masʼuliyat." },
    { category: "Tutuq belgisi", prompt: UZ_Q, options: ["sanʼat", "sanat"], explanation: "Tutuq belgisi (ʼ) bilan yoziladi: sanʼat." },
    { category: "Tutuq belgisi", prompt: UZ_Q, options: ["taʼmirlash", "tamirlash"], explanation: "Tutuq belgisi (ʼ) bilan yoziladi: taʼmir, taʼmirlash." },
    // Oʻ va gʻ
    { category: "Oʻ va gʻ", prompt: UZ_Q, options: ["Oʻzbekiston", "Ozbekiston"], explanation: "Oʻ — alohida harf, ʻ belgisi bilan yoziladi." },
    { category: "Oʻ va gʻ", prompt: UZ_Q, options: ["toʻgʻri", "togri", "toʻgri"], explanation: "Oʻ va gʻ — alohida harflar, ikkalasi ham ʻ belgisi bilan yoziladi." },
    { category: "Oʻ va gʻ", prompt: UZ_Q, options: ["soʻrov", "sorov"], explanation: "Oʻ harfi ʻ belgisi bilan yoziladi: soʻrov." },
    // X va H
    { category: "X va H", prompt: UZ_Q, options: ["xizmat", "hizmat"], explanation: "Bu soʻz «x» bilan yoziladi: xizmat." },
    { category: "X va H", prompt: UZ_Q, options: ["hisob", "xisob"], explanation: "Bu soʻz «h» bilan yoziladi: hisob, hisob-kitob." },
    { category: "X va H", prompt: UZ_Q, options: ["xabar", "habar"], explanation: "Bu soʻz «x» bilan yoziladi: xabar." },
    { category: "X va H", prompt: UZ_Q, options: ["hurmatli", "xurmatli"], explanation: "Bu soʻz «h» bilan yoziladi: hurmat, hurmatli." },
    { category: "X va H", prompt: UZ_Q, options: ["xodim", "hodim"], explanation: "Bu soʻz «x» bilan yoziladi: xodim." },
    { category: "X va H", prompt: UZ_Q, options: ["harakat", "xarakat"], explanation: "Bu soʻz «h» bilan yoziladi: harakat." },
    { category: "X va H", prompt: UZ_Q, options: ["xato", "hato"], explanation: "Bu soʻz «x» bilan yoziladi: xato." },
    { category: "X va H", prompt: UZ_Q, options: ["hujjat", "xujjat"], explanation: "Bu soʻz «h» bilan yoziladi: hujjat." },
    { category: "X va H", prompt: UZ_Q, options: ["muhim", "muxim"], explanation: "Bu soʻz «h» bilan yoziladi: muhim." },
    // Qoʻshimchalar
    { category: "Qoʻshimchalar", prompt: "yurak + i = ?", options: ["yuragi", "yuraki"], explanation: "Koʻp boʻgʻinli soʻz oxiridagi k unli bilan boshlangan qoʻshimchadan oldin g ga aylanadi: yurak — yuragi." },
    { category: "Qoʻshimchalar", prompt: "bilak + i = ?", options: ["bilagi", "bilaki"], explanation: "k → g: bilak — bilagi." },
    { category: "Qoʻshimchalar", prompt: "qishloq + i = ?", options: ["qishlogʻi", "qishloqi"], explanation: "Koʻp boʻgʻinli soʻz oxiridagi q unli bilan boshlangan qoʻshimchadan oldin gʻ ga aylanadi: qishloq — qishlogʻi." },
    { category: "Qoʻshimchalar", prompt: "oʻrtoq + im = ?", options: ["oʻrtogʻim", "oʻrtoqim"], explanation: "q → gʻ: oʻrtoq — oʻrtogʻim." },
    { category: "Qoʻshimchalar", prompt: "qishloq + ga = ?", options: ["qishloqqa", "qishloqga", "qishloqka"], explanation: "q bilan tugagan soʻzga -qa qoʻshiladi: qishloqqa." },
    { category: "Qoʻshimchalar", prompt: "bank + ga = ?", options: ["bankka", "bankga"], explanation: "k bilan tugagan soʻzga -ka qoʻshiladi: bankka, tokka." },
    { category: "Qoʻshimchalar", prompt: "ek + gan = ?", options: ["ekkan", "ekgan"], explanation: "k bilan tugagan feʼlga -kan qoʻshiladi: ekkan." },
    { category: "Qoʻshimchalar", prompt: "chiq + gan = ?", options: ["chiqqan", "chiqgan"], explanation: "q bilan tugagan feʼlga -qan qoʻshiladi: chiqqan." },
    // Qoʻshib yozish
    { category: "Qoʻshib yozish", prompt: UZ_Q, options: ["qabulxona", "qabul xona", "qabul-xona"], explanation: "-xona qismli soʻzlar qoʻshib yoziladi: qabulxona." },
    { category: "Qoʻshib yozish", prompt: UZ_Q, options: ["xushxabar", "xush xabar"], explanation: "xush- qismli soʻzlar qoʻshib yoziladi: xushxabar." },
    { category: "Qoʻshib yozish", prompt: UZ_Q, options: ["ommabop", "omma bop"], explanation: "-bop qismli soʻzlar qoʻshib yoziladi: ommabop." },
    { category: "Qoʻshib yozish", prompt: UZ_Q, options: ["Toʻlov oʻtdimi?", "Toʻlov oʻtdi mi?"], explanation: "-mi yuklamasi soʻzga qoʻshib yoziladi." },
    { category: "Qoʻshib yozish", prompt: UZ_Q, options: ["kimdir", "kim dir"], explanation: "-dir qoʻshib yoziladi: kimdir, nimadir." },
    // Ajratib yozish
    { category: "Ajratib yozish", prompt: UZ_Q, options: ["hech kim", "hechkim"], explanation: "hech, har, u, bu, shu soʻzlari keyingi soʻzdan ajratib yoziladi." },
    { category: "Ajratib yozish", prompt: UZ_Q, options: ["hech qachon", "hechqachon"], explanation: "hech soʻzi keyingi soʻzdan ajratib yoziladi." },
    { category: "Ajratib yozish", prompt: UZ_Q, options: ["har bir mijoz", "harbir mijoz"], explanation: "har soʻzi keyingi soʻzdan ajratib yoziladi." },
    { category: "Ajratib yozish", prompt: UZ_Q, options: ["u yerda", "uyerda"], explanation: "u, bu, shu soʻzlari keyingi soʻzdan ajratib yoziladi." },
    { category: "Ajratib yozish", prompt: UZ_Q, options: ["sotib oling", "sotiboling"], explanation: "Qoʻshma feʼl qismlari ajratib yoziladi: sotib ol, olib kel." },
    // Chiziqcha
    { category: "Chiziqcha", prompt: UZ_Q, options: ["kecha-yu kunduz", "kechayu kunduz", "kecha yu kunduz"], explanation: "-u (-yu) bogʻlovchisi bilan kelgan juft soʻzlar chiziqcha bilan yoziladi." },
    { category: "Chiziqcha", prompt: UZ_Q, options: ["ota-ona", "ota ona", "otaona"], explanation: "Juft soʻzlar chiziqcha bilan yoziladi: ota-ona." },
    { category: "Chiziqcha", prompt: UZ_Q, options: ["hisob-kitob", "hisob kitob"], explanation: "Juft soʻzlar chiziqcha bilan yoziladi: hisob-kitob." },
    { category: "Chiziqcha", prompt: UZ_Q, options: ["tez-tez", "tez tez"], explanation: "Takroriy soʻzlar chiziqcha bilan yoziladi: tez-tez." },
    { category: "Chiziqcha", prompt: UZ_Q, options: ["2024-yil", "2024 yil"], explanation: "Raqam bilan yozilgan tartib sondan keyin chiziqcha qoʻyiladi: 2024-yil, 5-sinf." },
    // Bosh harf
    { category: "Bosh harf", prompt: UZ_Q, options: ["Toʻlov 10-yanvarda amalga oshiriladi.", "Toʻlov 10-Yanvarda amalga oshiriladi."], explanation: "Oy nomlari kichik harf bilan yoziladi: 10-yanvar." },
    // Qoʻsh harflar
    { category: "Qoʻsh harflar", prompt: UZ_Q, options: ["murojaat", "murojat"], explanation: "Bu soʻzda ikkita a yoziladi: murojaat." },
    { category: "Qoʻsh harflar", prompt: UZ_Q, options: ["tashakkur", "tashakur"], explanation: "Bu soʻzda qoʻsh k yoziladi: tashakkur." },
    { category: "Qoʻsh harflar", prompt: UZ_Q, options: ["mutaxassis", "mutaxasis"], explanation: "Bu soʻzda qoʻsh s yoziladi: mutaxassis." },
  ],
};
