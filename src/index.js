require('dotenv').config();

const path = require("path");
const { Telegraf, Markup } = require('telegraf');
const { Storage } = require('./storage');

const BOT_TOKEN = process.env.BOT_TOKEN;
const LEADS_CHAT_ID = Number(process.env.LEADS_CHAT_ID || 0);
const MARINA_CHAT_URL = 'https://t.me/Mrs_Mishagina';
const DB_PATH = process.env.DB_PATH || './data/db.sqlite';
const START_PHOTO = process.env.START_PHOTO || '';

if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN is required');
}

if (!LEADS_CHAT_ID) {
  console.warn('[config] LEADS_CHAT_ID is not set. Lead notifications are disabled.');
}

const storage = new Storage(DB_PATH);
const bot = new Telegraf(BOT_TOKEN);

const QUESTIONS = [
  {
    text: '1. Когда ты остаешься одна перед зеркалом, какая мысль появляется первой?\n\n(Небольшой спойлер. Все ответы нормальные. Правда.)',
    options: [
      'В целом я себе нравлюсь, но хочется больше стройности',
      'Есть зоны, которые хотелось бы подтянуть',
      'Я знаю, что могу выглядеть лучше',
      'Я устала себя стесняться'
    ]
  },
  {
    text: '2️⃣ К вечеру твоё тело обычно…\n\n(Если ты выбрала первые варианты ты не одна. Такое я вижу почти каждый день.)',
    options: [
      'Немного «наливается», особенно ноги или живот',
      'Чувствуется тяжелее, чем утром',
      'Устаёт спина или поясница',
      'В целом нормально, но хочется больше тонуса'
    ]
  },
  {
    text: '3️⃣ Бывает ли ощущение, что ты стараешься (спорт, питание), а тело как будто откликается слабее чем хотелось бы?\n\n(Это очень частая история. И у неё обычно есть причина)',
    options: [
      'Да, и это немного расстраивает',
      'Иногда замечаю',
      'Раньше было проще',
      'Я не особо слежу, но чувствую, что можно лучше',
      'Я уже перестала пытаться'
    ]
  },
  {
    text: '4️⃣ В одежде ты чаще выбираешь…\n\n(Одежда кстати всегда честно показывает что происходит с телом.)',
    options: [
      'Чувствуешь себя уверенно',
      'В целом комфортно, но есть зоны, которые прячу',
      'Выбираю фасоны посвободнее',
      'Думаю о том, как выгляжу',
      'То, что «безопасно”'
    ]
  },
  {
    text: '5️⃣ Если совсем честно, в моменты когда хочется чувствовать себя привлекательной, ты чаще:\n\n(Ты сейчас отвечаешь не мне. Ты отвечаешь себе.)',
    options: [
      'Чувствуешь уверенность в теле',
      'В целом нормально, но можно лучше',
      'Иногда появляется скованность',
      'Начинаю думать о зонах, которые смущают и закрываюсь'
    ]
  },
  {
    text: '6️⃣ Что тебе хотелось бы изменить в ощущениях тела?\n\n(Вот здесь обычно появляется настоящая цель.)',
    options: ['Больше лёгкости', 'Меньше отёков', 'Более подтянутый силуэт', 'Более плотную кожу', 'Чувствовать себя увереннее']
  },
  {
    text: '7️⃣ Ты больше хочешь:',
    options: [
      'Поддержать тело и сохранить форму',
      'Убрать лишнюю тяжесть',
      'Понять, что именно работает для меня',
      'Перестать гадать и получить чёткий план'
    ]
  }
];

const FINAL_TEXT = [
  '✨ Спасибо, что прошла мини-тест.',
  '',
  'Я посмотрела твои ответы.',
  '',
  'И знаешь что интересно.',
  '',
  'Твоё тело не просит радикальных вещей. Оно скорее просит внимания и правильной поддержки.',
  'И знаешь хорошую новость?',
  'Большинство вещей, которые тебя беспокоят — реально корректируются, если работать с телом системно.',
  '',
  'Очень часто за этим стоят:',
  '— застой лимфы',
  '— отёки',
  '— плотные зоны в тканях',
  '— слабая микроциркуляция',
  '',
  'И именно с этим отлично работают аппаратные методики.',
  '',
  'Но есть важный момент.',
  '',
  'Я никогда не назначаю процедуры «вслепую”.',
  'Потому что у каждой женщины тело реагирует по-разному.',
  '',
  'Поэтому первый шаг — спокойная консультация, где мы:',
  '',
  '• посмотрим качество тканей',
  '• определим зоны отёка и напряжения',
  '• сделаем замеры и фото (чтобы видеть реальный прогресс)',
  '• проведём анализ состава тела на специальных весах',
  '• исключим противопоказания',
  '• и подберём курс процедур именно под твою задачу',
  '',
  'Без навязывания.',
  'Без «пакетов любой ценой”.',
  '',
  'Просто понятный план для твоего тела.',
  '',
  'И возможно, именно через пару месяцев ты посмотришь в зеркало и увидишь:',
  '',
  '— более стройный силуэт',
  '— подтянутый животик',
  '— более плотную кожу',
  '— одежду, которая сидит иначе',
  '— и то самое чувство уверенности в себе',
  '',
  'Если откликается — нажми кнопку ниже.'
].join('\n');

const REACTIONS = ['Супер ✨', 'Поняла 😊', 'Отлично 💛', 'Идем дальше 👇'];

const userSessions = new Map();

function getSession(userId) {
  if (!userSessions.has(userId)) {
    userSessions.set(userId, {
      step: 1,
      answers: {},
      lastQuestionMessageId: null,
      lastQuestionChatId: null,
      lastIntroMessageId: null,
      lastIntroChatId: null,
      lastBotMessagesToCleanup: [],
      leadSent: false,
      hasSeenIntro: false,
      pendingFinalTimer: null,
      finalScheduled: false,
      finalResultSent: false,
      dbSessionId: null
    });
  }

  return userSessions.get(userId);
}

function resetSessionForRestart(session) {
  if (session.pendingFinalTimer) {
    clearTimeout(session.pendingFinalTimer);
    session.pendingFinalTimer = null;
  }

  session.step = 1;
  session.answers = {};
  session.lastQuestionMessageId = null;
  session.lastQuestionChatId = null;
  session.lastBotMessagesToCleanup = [];
  session.leadSent = false;
  session.finalScheduled = false;
  session.finalResultSent = false;
  session.dbSessionId = null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeReply(ctx, text, extra, tag) {
  try {
    return await ctx.reply(text, extra);
  } catch (err) {
    console.error(`[${tag}] reply failed`, { userId: ctx.from?.id, chatId: ctx.chat?.id, error: err.message });
    return null;
  }
}

async function safeSendMessage(chatId, text, extra, tag) {
  try {
    return await bot.telegram.sendMessage(chatId, text, extra);
  } catch (err) {
    console.error(`[${tag}] sendMessage failed`, { chatId, error: err.message });
    return null;
  }
}

async function safeSendPhoto(chatId, photo, caption, extra, tag) {
  try {
    return await bot.telegram.sendPhoto(chatId, photo, { caption, ...extra });
  } catch (err) {
    console.error(`[${tag}] sendPhoto failed`, { chatId, error: err.message });
    return null;
  }
}

async function safeAnswerCallback(ctx, text) {
  try {
    await ctx.answerCbQuery(text);
  } catch (err) {
    console.error('[answerCbQuery] failed', { userId: ctx.from?.id, error: err.message });
  }
}

async function safeDeleteMessage(chatId, messageId) {
  try {
    await bot.telegram.deleteMessage(chatId, messageId);
  } catch {
    // ignore
  }
}

async function safeClearKeyboard(chatId, messageId) {
  try {
    await bot.telegram.editMessageReplyMarkup(chatId, messageId, undefined, null);
  } catch {
    // ignore
  }
}

function questionKeyboard(step) {
  const q = QUESTIONS[step - 1];
  const shortLabelsByStep = {
    1: ['Хочется больше стройности', 'Подтянуть кожу', 'Могу выглядеть лучше', 'Устала стесняться'],
    2: ['Немного «наливается»', 'Ощущается тяжелее', 'Устаёт спина/поясница', 'Хочется больше тонуса'],
    3: ['Да, и это расстраивает', 'Иногда замечаю', 'Раньше было проще', 'Можно лучше', 'Перестала пытаться'],
    4: ['Чувствую себя уверенно.', 'Есть зоны, которые прячу.', 'Выбираю фасоны посвободнее.', 'Думаю о том, как выгляжу.', 'То, что «безопасно»'],
    5: ['Чувствую уверенность в теле.', 'Всегда есть, что улучшить.', 'Иногда появляется скованность.', 'Думаю о несовершенствах и закрываюсь.'],
    7: ['Поддержать тело и сохранить форму.', 'Убрать тяжесть и отечность.', 'Понять, что подойдёт тебе.', 'Разобраться и получить план']
  };
  const labels = shortLabelsByStep[step];
  return Markup.inlineKeyboard(
    q.options.map((option, i) => [Markup.button.callback(labels ? labels[i] : option, `ans:${step}:${i}`)])
  );
}

function startQuizKeyboard() {
  return Markup.inlineKeyboard([[Markup.button.callback('Пройти мини-тест ✅', 'start_quiz')]]);
}

function finalKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Записаться на консультацию', 'final_book')],
    [Markup.button.callback('Вопрос специалисту', 'final_question')],
    [Markup.button.callback('Я подумаю', 'final_think')],
    [Markup.button.callback('Пройти тест заново', 'restart_quiz')]
  ]);
}

function marinaLinkKeyboard() {
  return Markup.inlineKeyboard([[Markup.button.url('Написать специалисту', MARINA_CHAT_URL)]]);
}

function userLabel(from) {
  return from.first_name || from.username || `id:${from.id}`;
}

function buildLeadSummary(from, answers, finalAction) {
  const username = from.username ? `@${from.username}` : 'без username';
  const profileUrl = from.username ? `https://t.me/${from.username}` : 'нет username';

  const lines = [];
  lines.push('Новая заявка 🔥');
  lines.push(`Клиент: ${userLabel(from)} (${username})`);
  lines.push(`userid: ${from.id}`);
  lines.push(`Профиль: ${profileUrl}`);
  lines.push('Ответы:');

  for (let i = 1; i <= QUESTIONS.length; i += 1) {
    lines.push(`${i}) ${answers[`q${i}`] || '-'}`);
  }

  lines.push(`Финальное действие: ${finalAction || 'Не выбрано'}`);
  return lines.join('\n');
}

async function sendMessageWithRetry(chatId, text, extra, tag) {
  const delays = [0, 2000, 5000];

  for (let i = 0; i < delays.length; i += 1) {
    if (delays[i] > 0) {
      await sleep(delays[i]);
    }

    const sent = await safeSendMessage(chatId, text, extra, `${tag}:attempt:${i + 1}`);
    if (sent) {
      return sent;
    }
  }

  return null;
}

function markStepInDb(session) {
  if (!session.dbSessionId) {
    return;
  }

  storage.updateSessionProgress(session.dbSessionId, session.step, session.answers);
}

async function sendQuestion(ctx, session, step, withReaction = true) {
  const q = QUESTIONS[step - 1];
  if (!q) {
    return;
  }

  const reaction = withReaction && step > 1 ? `${REACTIONS[(step - 2) % REACTIONS.length]}\n\n` : '';
  const sent = await safeReply(ctx, `${reaction}${q.text}`, questionKeyboard(step), 'send-question');

  if (sent) {
    session.lastQuestionMessageId = sent.message_id;
    session.lastQuestionChatId = sent.chat.id;
    session.lastBotMessagesToCleanup.push(sent.message_id);
  }
}

async function sendLeadOnce(ctx, session, actionName) {
  if (session.leadSent) {
    return;
  }

  session.leadSent = true;
  const summary = buildLeadSummary(ctx.from, session.answers, actionName);

  if (session.dbSessionId && !storage.hasLeadForSession(session.dbSessionId)) {
    storage.insertLead(session.dbSessionId, ctx.from.id, summary);
  }

  if (!LEADS_CHAT_ID) {
    console.warn('[lead] LEADS_CHAT_ID is not set, skip lead sending');
    return;
  }

  const sent = await sendMessageWithRetry(LEADS_CHAT_ID, summary, undefined, 'lead-send');
  if (!sent) {
    console.warn('[lead] failed to send lead into LEADS_CHAT_ID');
  }
}

async function showStartEntry(ctx) {
  const session = getSession(ctx.from.id);

  if (session.pendingFinalTimer) {
    clearTimeout(session.pendingFinalTimer);
    session.pendingFinalTimer = null;
  }

  const intro = [
    'Привет, Красотка! Рада, что ты заглянула!',
    'Раз ты здесь, значит хочешь что-то изменить в своем отражении.',
    'Может убрать отеки? Может подтянуть кожу? Может избавиться от целлюлита? Может просто почувствовать заботу о себе?',
    '',
    'Я та самая Худышка на ЛПДжишке.',
    'Я не ругаю за булочки. Но отёки вижу сразу.',
    '',
    'Давай сделаем маленький тест. Он займёт минуту. А тебе станет чуть понятнее что происходит с телом. 👇',
    'Поехали!'
  ].join('\n');

  if (START_PHOTO) {
    const sentPhoto = await safeSendPhoto(ctx.chat.id, START_PHOTO, intro, undefined, 'start-photo');
    if (!sentPhoto) {
      const sent = await safeReply(ctx, intro, undefined, 'start-intro-fallback');
      if (sent) {
        session.lastIntroMessageId = sent.message_id;
        session.lastIntroChatId = sent.chat.id;
      }
    } else {
      session.lastIntroMessageId = sentPhoto.message_id;
      session.lastIntroChatId = sentPhoto.chat.id;
    }
  } else {
    const sent = await safeReply(ctx, intro, undefined, 'start-intro');
    if (sent) {
      session.lastIntroMessageId = sent.message_id;
      session.lastIntroChatId = sent.chat.id;
    }
  }

  await safeReply(ctx, 'Пройти мини-тест ✅', startQuizKeyboard(), 'start-cta');
  session.hasSeenIntro = true;
}

async function beginQuiz(ctx, startMessage) {
  const session = getSession(ctx.from.id);

  resetSessionForRestart(session);

  const dbSession = storage.createSession(ctx.from.id);
  session.dbSessionId = dbSession.id;
  session.step = 1;

  if (startMessage) {
    await safeReply(ctx, startMessage, undefined, 'quiz-restart-msg');
  }

  markStepInDb(session);
  await sendQuestion(ctx, session, 1, false);
}

async function scheduleFinalResult(ctx, session) {
  if (session.finalScheduled || session.finalResultSent) {
    return;
  }

  session.finalScheduled = true;
  session.pendingFinalTimer = setTimeout(async () => {
    session.pendingFinalTimer = null;
    session.finalScheduled = false;
    session.finalResultSent = true;

    await ctx.replyWithPhoto(
      { source: path.join(__dirname, "../assets/marina.jpg") }
    );
    const sent = await safeReply(ctx, FINAL_TEXT, finalKeyboard(), 'final-result');
    if (!sent) {
      console.error('[final-result] failed after retries', { userId: ctx.from.id });
    }
  }, 120000);
}

bot.use(async (ctx, next) => {
  if (ctx.from) {
    storage.upsertUser(ctx.from);
  }
  await next();
});

bot.start(async (ctx) => {
  await safeReply(ctx, 'Поехали!', startQuizKeyboard(), 'start-short-only');
});

bot.action('start_quiz', async (ctx) => {
  await safeAnswerCallback(ctx);

  await beginQuiz(ctx);
});

bot.action(/ans:(\d+):(\d+)/, async (ctx) => {
  const step = Number(ctx.match[1]);
  const optionIndex = Number(ctx.match[2]);
  const session = getSession(ctx.from.id);

  await safeAnswerCallback(ctx);

  const question = QUESTIONS[step - 1];
  const answer = question?.options?.[optionIndex];
  if (!question || !answer) {
    return;
  }

  if (session.step !== step) {
    return;
  }

  session.answers[`q${step}`] = answer;

  if (step < QUESTIONS.length) {
    session.step = step + 1;
    markStepInDb(session);
    await sendQuestion(ctx, session, session.step, true);
    return;
  }

  session.step = QUESTIONS.length + 1;
  markStepInDb(session);
  await safeReply(ctx, 'Поняла 💛 Сейчас всё подготовлю…', undefined, 'q7-feedback');
  await scheduleFinalResult(ctx, session);
});

async function finishFinalAction(ctx, actionName) {
  const session = getSession(ctx.from.id);

  if (!session.finalResultSent) {
    await safeAnswerCallback(ctx, 'Сначала дождись итогового сообщения');
    return false;
  }

  await safeAnswerCallback(ctx);

  await sendLeadOnce(ctx, session, actionName);
  return true;
}

bot.action('final_book', async (ctx) => {
  const ok = await finishFinalAction(ctx, 'Записаться');
  if (!ok) {
    return;
  }

  await safeReply(
    ctx,
    'Отлично ❤️ Вот ссылка, чтобы написать специалисту:',
    marinaLinkKeyboard(),
    'final-book'
  );
});

bot.action('final_question', async (ctx) => {
  const ok = await finishFinalAction(ctx, 'Задать вопрос');
  if (!ok) {
    return;
  }

  await safeReply(ctx, 'Напишите свой вопрос специалисту сюда 👇', marinaLinkKeyboard(), 'final-question');
});

bot.action('final_think', async (ctx) => {
  const ok = await finishFinalAction(ctx, 'Пока подумаю');
  if (!ok) {
    return;
  }

  await safeReply(ctx, 'Окей 😊 Я рядом, если захочешь вернуться.', undefined, 'final-think');
});

bot.action('restart_quiz', async (ctx) => {
  await safeAnswerCallback(ctx);

  await beginQuiz(ctx, 'Поехали заново ✅');
});

bot.on('text', async (ctx) => {
  const text = ctx.message?.text || '';
  if (text.startsWith('/')) {
    return;
  }

  const session = getSession(ctx.from.id);

  if (session.step >= 1 && session.step <= QUESTIONS.length) {
    await safeReply(ctx, 'Выбери вариант кнопкой в вопросе выше 👇', undefined, 'text-during-quiz');
    return;
  }

  await safeReply(ctx, 'Нажми /start, чтобы начать мини-тест 🙂', undefined, 'text-fallback');
});

bot.catch((err, ctx) => {
  console.error('Bot error', { updateType: ctx.updateType, error: err.message });
});

async function launch() {
  await bot.launch();
  console.log('Bot started');
}

launch().catch((err) => {
  console.error('Failed to launch bot:', err);
  process.exit(1);
});
