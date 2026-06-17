/**
 * nlpDate — 自然语言日期/时间解析
 *
 * 参考项目：
 *  - chrono-node (GitHub ⭐3.2k): 分段正则 + 优先级合并策略
 *  - Sugar.js (GitHub ⭐4.5k): 多语言 Date.create 模式
 *
 * 设计：无外部依赖，纯 regex；支持中文 + 英文。
 * 返回 { title, deadline } — deadline 为 "YYYY-MM-DDTHH:MM" 或 null
 */

export interface ParseResult {
  title: string;
  deadline: string | null;
  hint: string | null;   // 给用户看的可读提示，如「明天 15:00」
}

// ── 辅助工具 ──────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0'); }

function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function setTime(base: Date, h: number, m = 0): Date {
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

// 中文时段 → 小时偏移
const ZH_PERIOD: Record<string, number> = {
  凌晨: 2, 早上: 7, 早晨: 7, 上午: 9, 中午: 12, 下午: 14, 傍晚: 17, 晚上: 19, 夜: 21, 深夜: 23,
};

const ZH_WEEKDAY: Record<string, number> = {
  一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 0, 日: 0, 天: 0,
};

const EN_WEEKDAY: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

const EN_MONTH: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

// ── 中文日期解析 ──────────────────────────────────────────────────────

function parseChineseDate(text: string, now: Date): { date: Date; matched: string } | null {
  // 1. 相对天数词
  const relMap: Array<[RegExp, number]> = [
    [/大后天/, 3],
    [/后天/, 2],
    [/明天|明日|明晚|明早/, 1],
    [/今天|今日|今晚|今早|今/, 0],
  ];
  for (const [re, offset] of relMap) {
    if (re.test(text)) {
      const matched = text.match(re)![0];
      return { date: addDays(now, offset), matched };
    }
  }

  // 2. X天后 / X小时后 / X分钟后
  let m = text.match(/(\d+)\s*天后/);
  if (m) return { date: addDays(now, parseInt(m[1])), matched: m[0] };
  m = text.match(/(\d+)\s*小时后/);
  if (m) {
    const d = new Date(now.getTime() + parseInt(m[1]) * 3600000);
    return { date: d, matched: m[0] };
  }
  m = text.match(/(\d+)\s*分钟后/);
  if (m) {
    const d = new Date(now.getTime() + parseInt(m[1]) * 60000);
    return { date: d, matched: m[0] };
  }

  // 3. 下周X / 周X
  m = text.match(/下[个個]?[周週星期]([一二三四五六七日天])/);
  if (m) {
    const targetDow = ZH_WEEKDAY[m[1]] ?? 0;
    const cur = now.getDay();
    let diff = targetDow - cur + 7;
    if (diff <= 0) diff += 7;
    return { date: addDays(now, diff), matched: m[0] };
  }
  m = text.match(/[这这]?[周週星期]([一二三四五六七日天])/);
  if (m) {
    const targetDow = ZH_WEEKDAY[m[1]] ?? 0;
    const cur = now.getDay();
    let diff = targetDow - cur;
    if (diff < 0) diff += 7;
    return { date: addDays(now, diff === 0 ? 7 : diff), matched: m[0] };
  }

  // 4. X月X日/号
  m = text.match(/(\d{1,2})[月\/](\d{1,2})[日号]?/);
  if (m) {
    const d = new Date(now.getFullYear(), parseInt(m[1]) - 1, parseInt(m[2]));
    if (d < now) d.setFullYear(d.getFullYear() + 1);
    return { date: d, matched: m[0] };
  }

  return null;
}

// ── 中文时间解析 ──────────────────────────────────────────────────────

function parseChineseTime(text: string): { h: number; m: number; matched: string } | null {
  // 时段 + 数字时间，如 下午3点 / 晚上8点半 / 上午10:30
  const periodKeys = Object.keys(ZH_PERIOD).join('|');
  const m = text.match(
    new RegExp(`(${periodKeys})?\\s*(\\d{1,2})(?:[点時时:]([0-5]?\\d))?(?:半)?`)
  );
  if (!m) return null;
  const [full, period, hourStr, minStr] = m;
  let h = parseInt(hourStr);
  const min = minStr ? parseInt(minStr) : (full.includes('半') ? 30 : 0);

  if (period && ZH_PERIOD[period] !== undefined) {
    const base = ZH_PERIOD[period];
    if (h <= 12 && base >= 12) h += 12;
    if (h === 24) h = 0;
  } else {
    // 无时段时，12以下按下午处理（13-23点直接用）
    if (h < 8 && h !== 0) h += 12;
  }
  if (h >= 24) return null;
  return { h, m: min, matched: full };
}

// ── 英文解析 ──────────────────────────────────────────────────────────

function parseEnglishDate(text: string, now: Date): { date: Date; matched: string } | null {
  const t = text.toLowerCase();

  // relative: in X days/hours/minutes
  let m = t.match(/\bin\s+(\d+)\s+(minute|hour|day|week)s?/);
  if (m) {
    const n = parseInt(m[1]);
    const unit = m[2];
    const ms = unit === 'minute' ? 60000 : unit === 'hour' ? 3600000 : unit === 'day' ? 86400000 : 604800000;
    return { date: new Date(now.getTime() + n * ms), matched: m[0] };
  }

  // day after tomorrow
  if (/day after tomorrow/.test(t)) return { date: addDays(now, 2), matched: 'day after tomorrow' };

  // tomorrow / tonight / today
  if (/\btomorrow\b/.test(t)) return { date: addDays(now, 1), matched: 'tomorrow' };
  if (/\btonight\b/.test(t)) return { date: setTime(now, 20), matched: 'tonight' };
  if (/\btoday\b/.test(t)) return { date: now, matched: 'today' };

  // next weekday
  m = t.match(/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/);
  if (m) {
    const targetDow = EN_WEEKDAY[m[1]];
    const cur = now.getDay();
    let diff = targetDow - cur + 7;
    if (diff <= 0) diff += 7;
    return { date: addDays(now, diff), matched: m[0] };
  }

  // this weekday
  m = t.match(/\b(this\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/);
  if (m) {
    const targetDow = EN_WEEKDAY[m[2]];
    const cur = now.getDay();
    let diff = targetDow - cur;
    if (diff <= 0) diff += 7;
    return { date: addDays(now, diff), matched: m[0] };
  }

  // Month Day: "june 15" / "jan 5"
  m = t.match(new RegExp(`\\b(${Object.keys(EN_MONTH).join('|')})\\s+(\\d{1,2})\\b`));
  if (m) {
    const mo = EN_MONTH[m[1]] - 1;
    const day = parseInt(m[2]);
    const d = new Date(now.getFullYear(), mo, day);
    if (d < now) d.setFullYear(d.getFullYear() + 1);
    return { date: d, matched: m[0] };
  }

  // MM/DD or M/D
  m = t.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (m) {
    const d = new Date(now.getFullYear(), parseInt(m[1]) - 1, parseInt(m[2]));
    if (d < now) d.setFullYear(d.getFullYear() + 1);
    return { date: d, matched: m[0] };
  }

  return null;
}

function parseEnglishTime(text: string): { h: number; m: number; matched: string } | null {
  const t = text.toLowerCase();
  // "3pm" / "3:30pm" / "at 3 pm"
  const m = t.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (!m) return null;
  let h = parseInt(m[1]);
  const min = m[2] ? parseInt(m[2]) : 0;
  const ampm = m[3];
  if (ampm === 'pm' && h !== 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  if (h >= 24) return null;
  return { h, m: min, matched: m[0] };
}

// ── 主函数 ────────────────────────────────────────────────────────────

export function parseNLP(input: string, now = new Date()): ParseResult {
  if (!input.trim()) return { title: input, deadline: null, hint: null };

  let date: Date | null = null;
  let timeSet = false;
  let removeParts: string[] = [];

  // 判断语言
  const hasChinese = /[一-鿿]/.test(input);

  if (hasChinese) {
    const dateResult = parseChineseDate(input, now);
    if (dateResult) {
      date = new Date(dateResult.date);
      removeParts.push(dateResult.matched);

      const timeResult = parseChineseTime(input);
      if (timeResult) {
        date = setTime(date, timeResult.h, timeResult.m);
        timeSet = true;
        removeParts.push(timeResult.matched);
      }
    }
  } else {
    const dateResult = parseEnglishDate(input, now);
    if (dateResult) {
      date = new Date(dateResult.date);
      removeParts.push(dateResult.matched);

      const timeResult = parseEnglishTime(input);
      if (timeResult) {
        date = setTime(date, timeResult.h, timeResult.m);
        timeSet = true;
        removeParts.push(timeResult.matched);
      }
    }
  }

  if (!date) return { title: input.trim(), deadline: null, hint: null };

  // 没有指定时间时，给个默认值：工作日 09:00，晚上 20:00
  if (!timeSet) {
    const h = now.getHours();
    date = setTime(date, h >= 18 ? 20 : 9);
  }

  // 清理 title：去掉已识别的日期/时间片段 + 多余空格/标点
  let title = input;
  // 按最长匹配先去
  const sorted = [...removeParts].sort((a, b) => b.length - a.length);
  for (const part of sorted) {
    title = title.replace(part, ' ');
  }
  // 清除常见连接词
  title = title
    .replace(/\b(at|on|by|for|next|this|in)\b/gi, ' ')
    .replace(/[，,。.：:]\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // 可读 hint
  const hint = buildHint(date, hasChinese);

  return { title: title || input.trim(), deadline: toISO(date), hint };
}

/**
 * classifyTodo — 根据截止时间对任务分类
 * 返回: 'overdue' | 'due_today' | 'due_soon' | 'upcoming' | 'no_deadline'
 */
export function classifyTodo(title: string, deadline: string | null): 'overdue' | 'due_today' | 'due_soon' | 'upcoming' | 'no_deadline' {
  if (!deadline) return 'no_deadline';
  const now = new Date();
  const d = new Date(deadline);
  if (d < now) return 'overdue';
  if (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  ) return 'due_today';
  const diff = d.getTime() - now.getTime();
  if (diff <= 48 * 60 * 60 * 1000) return 'due_soon';
  return 'upcoming';
}

function buildHint(d: Date, zh: boolean): string {
  const now = new Date();
  const today = now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const hhmm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  if (d.toDateString() === today) {
    return zh ? `今天 ${hhmm}` : `Today ${hhmm}`;
  }
  if (d.toDateString() === tomorrow.toDateString()) {
    return zh ? `明天 ${hhmm}` : `Tomorrow ${hhmm}`;
  }

  const mo = d.getMonth() + 1;
  const day = d.getDate();
  return zh
    ? `${mo}月${day}日 ${hhmm}`
    : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${hhmm}`;
}
