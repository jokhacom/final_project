// Слова для теста скорости печати: частые слова и лексика работы с клиентами.
// Узбекский — латиница по действующим правилам (oʻ, gʻ — со знаком ʻ, tutuq belgisi — ʼ).
// Новый алфавит — по закону об усовершенствованном узбекском алфавите (подписан в 2026 г., действует с 22.04.2027):
// oʻ → ö, gʻ → ğ, sh → ş, ch → ç; ng и tutuq belgisi (ʼ) не меняются. Получается из узбекского списка.

export const TYPING_LANGUAGES = ["ru", "uz", "uz_new"] as const;
export type TypingLanguage = (typeof TYPING_LANGUAGES)[number];
export const isTypingLanguage = (l: unknown): l is TypingLanguage => TYPING_LANGUAGES.includes(l as TypingLanguage);
export const TYPING_MODES = [15, 30, 60, 120] as const;

export const TYPING_LABEL: Record<TypingLanguage, string> = {
  ru: "🇷🇺 Русский",
  uz: "🇺🇿 Oʻzbekcha",
  uz_new: "🇺🇿 Yangi alifbo",
};

const RU = `и в не на я что он с как это по но они мы так все она за бы же от вы из у о для ещё уже до если или только когда
день время год человек клиент банк карта счёт платёж сумма оплата перевод кредит вклад заявка вопрос ответ помощь спасибо
пожалуйста здравствуйте извините сейчас сегодня завтра вчера минута час неделя месяц номер телефон сообщение письмо адрес
город документ паспорт договор подпись условия тариф процент долг срок лимит баланс деньги сум рабочий проверить отправить
получить оформить уточнить ответить помочь понять решить ждать знать видеть сказать написать прочитать открыть закрыть
изменить подтвердить отменить вернуть сделать можно нужно важно быстро просто удобно правильно вежливо конечно хорошо новый
старый большой первый последний каждый другой наш ваш свой который где почему сколько какой кто чем тоже также потом затем
очень всегда никогда приложение сайт пароль код доступ вход служба поддержка оператор сотрудник отдел решение проблема ошибка
жалоба благодарим обращение информация уведомление безопасность мошенник внимание ожидание очередь результат причина`;

const UZ = `va bu men sen u biz siz ular bor yoʻq kerak mumkin hisob toʻlov karta bank mijoz xizmat savol javob rahmat iltimos kun vaqt
pul soʻm raqam telefon xabar maʼlumot yordam ish uy katta kichik yaxshi yangi eski tez sekin bugun ertaga kecha hozir keyin oldin
nima qanday qachon qayerda nega kim qancha bir ikki uch toʻrt besh oʻn yuz ming hamma har hech juda faqat yana ham lekin chunki
agar uchun bilan kabi haqida orqali boshqa birinchi oxirgi muhim toʻgʻri notoʻgʻri xato tekshirish yuborish olish berish qilish
boʻlish kelish ketish koʻrish bilish aytish yozish oʻqish ishlash kutish tushunish oʻzgartirish ochish yopish kirish chiqish
narx chegirma kredit qarz foiz oy yil hafta soat daqiqa manzil shahar viloyat tuman mahalla oila ota ona bola doʻst xodim rahbar
boʻlim ariza hujjat pasport imzo shartnoma kafolat sifat xavfsiz parol kod ilova sayt internet aloqa qoʻngʻiroq murojaat shikoyat
taklif mamnun xursand minnatdor kechirasiz salom xayr albatta tayyor bepul qulay oson qiyin tushunarli aniq shoshilinch navbat
bajarildi tasdiqlash bekor qaytarish almashtirish choʻntak gʻoya oʻzbek tilida gapirish soʻz gap matn`;

// Действующая латиница → проект нового алфавита. После o/g принимаем и ‘ ', как часто печатают вместо ʻ.
export function toNewAlphabet(text: string) {
  return text
    .replace(/O[ʻ‘']/g, "Ö").replace(/o[ʻ‘']/g, "ö")
    .replace(/G[ʻ‘']/g, "Ğ").replace(/g[ʻ‘']/g, "ğ")
    .replace(/SH/g, "Ş").replace(/Sh/g, "Ş").replace(/sh/g, "ş")
    .replace(/CH/g, "Ç").replace(/Ch/g, "Ç").replace(/ch/g, "ç");
}

const split = (s: string) => s.split(/\s+/).filter(Boolean);
export const TYPING_WORDS: Record<TypingLanguage, string[]> = {
  ru: split(RU),
  uz: split(UZ),
  uz_new: split(toNewAlphabet(UZ)),
};

// Буквы, которых может не быть на клавиатуре, — кнопками на экране.
export const EXTRA_KEYS: Record<TypingLanguage, string[]> = {
  ru: [],
  uz: ["ʻ", "ʼ"],
  uz_new: ["ö", "ğ", "ş", "ç", "ʼ"],
};

// Все виды апострофа считаем одним знаком: на клавиатуре обычно есть только ' .
const APOSTROPHES = /['`‘’ʼʻ]/g;
export const sameChar = (typed: string, expected: string) => typed.replace(APOSTROPHES, "'") === expected.replace(APOSTROPHES, "'");
