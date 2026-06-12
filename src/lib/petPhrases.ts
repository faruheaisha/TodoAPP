/**
 * petPhrases — Asha 吉祥物悬停话语库
 *
 * 按时间段分组，中英双语，每组 6 条。
 * 调用 getTimePeriod() 获取当前时段，
 * 调用 getRandomPhrase(lang) 随机取一条。
 */

export type TimePeriod = 'morning' | 'afternoon' | 'evening' | 'night';

/** 宠物根据时间段呈现的情绪 */
export const PERIOD_MOOD: Record<TimePeriod, 'happy' | 'idle' | 'hover' | 'sleepy'> = {
  morning:   'happy',
  afternoon: 'idle',
  evening:   'hover',
  night:     'sleepy',
};

interface PhraseSet {
  zh: string[];
  en: string[];
}

const PHRASES: Record<TimePeriod, PhraseSet> = {
  morning: {
    zh: [
      '早安！今天也要元气满满 ☀️',
      '新的一天，先把最重要的事列上去吧 📋',
      '早起的雪豹有任务做～加油哦 🐾',
      '精神抖擞！今天想完成什么呢？',
      '早上好！把难事放在上午，下午就轻松啦 💪',
      '美好的早晨～规划一下，晚上开心收工 🌅',
    ],
    en: [
      "Good morning! Ready to crush it today? ☀️",
      "Rise and shine — what's on the list? 📋",
      "Early Asha gets the tasks done! 🐾",
      "Morning energy! Tackle the hard stuff first 💪",
      "New day, fresh start. You've got this! 🌅",
      "Plan your morning, own your day ✨",
    ],
  },
  afternoon: {
    zh: [
      '下午好～进度怎么样啦？继续加油 🍀',
      '专注时间到！关掉通知，冲一波 🍅',
      '喝杯水休息一下，然后继续 💧',
      '别被下午困意打败，再坚持一下！',
      '下午了，检查一下截止日期有没有遗漏哦',
      '任务一个个来，不着急，稳住 🌿',
    ],
    en: [
      "Afternoon check-in — how's it going? 🍀",
      "Focus time! Silence those notifications 🍅",
      "Hydrate and keep going 💧",
      "Beat the afternoon slump! Almost there",
      "Check your deadlines — anything urgent?",
      "One task at a time. Steady wins 🌿",
    ],
  },
  evening: {
    zh: [
      '傍晚啦，今天打了几个勾？做得好！🌆',
      '收工前把明天最重要的事排一排',
      '今天辛苦了！完成的任务都值得庆祝 🎉',
      '快收尾啦，差一点点就完美 ✨',
      '把未完成的移到明天，轻松不焦虑 📝',
      '傍晚整理思路，明天更顺畅 🌇',
    ],
    en: [
      "Evening wrap-up — how many ticks today? 🌆",
      "Before you stop, plan tomorrow's big task",
      "You worked hard! Time to wind down 🎉",
      "Almost done for the day — finish strong ✨",
      "Move unfinished tasks to tomorrow, no stress 📝",
      "Review your day, set up tomorrow 🌇",
    ],
  },
  night: {
    zh: [
      '夜深了，明天的任务排好了吗？🌙',
      '早点休息哦，明天的你会感谢今天的自己 😴',
      '睡前把最重要的一件事写下来，安心入睡 ✍️',
      '夜猫子模式！注意休息，我看着你呢 ⭐',
      '再晚也别忘了给明天一个好的开始 🌌',
      '你已经做得很好了，好好休息 💙',
    ],
    en: [
      "Late night? Plan tomorrow before you sleep 🌙",
      "Rest up — your future self will thank you 😴",
      "Write down one priority for tomorrow ✍️",
      "Night owl mode! Don't forget to rest ⭐",
      "Even late nights deserve a plan for tomorrow 🌌",
      "You did great today. Now go sleep 💙",
    ],
  },
};

/** 返回当前时间所属时段 */
export function getTimePeriod(): TimePeriod {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'afternoon';
  if (h >= 18 && h < 22) return 'evening';
  return 'night';
}

/** 随机取当前时段一条话语 */
export function getRandomPhrase(lang: 'zh' | 'en'): string {
  const period = getTimePeriod();
  const pool   = PHRASES[period][lang];
  return pool[Math.floor(Math.random() * pool.length)];
}

/** 取当前时段宠物情绪 */
export function getPeriodMood() {
  return PERIOD_MOOD[getTimePeriod()];
}
