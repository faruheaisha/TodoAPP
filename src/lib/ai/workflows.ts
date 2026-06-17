/**
 * workflows.ts — 预置 AI 工作流
 *
 * 与 client.ts 解耦：工作流只组装 prompt 并解析结构化结果，
 * 厂商与模型由 aiStore 的激活配置决定。
 * 调用方负责处理 NO_API_KEY（引导用户去设置页）。
 */
import { chat } from './client';
import { getAIConfigByTier } from '../../store/aiStore';

/**
 * 任务拆解：把一条待办标题拆成 3-6 个可执行子任务。
 * 返回子任务标题数组；JSON 模式 + 容错解析（裸数组 / {subtasks: []} / markdown 包裹均可）。
 */
export async function breakdownTodo(title: string, lang: 'zh' | 'en', signal?: AbortSignal): Promise<string[]> {
  const config = getAIConfigByTier('complex');
  if (!config) throw new Error('NO_API_KEY');

  const system = lang === 'zh'
    ? '你是任务拆解助手。把用户给出的任务拆解为 3-6 个具体、可执行的子任务。每条以动词开头，不超过 20 字，不编号。只输出 JSON 对象：{"subtasks": ["...", "..."]}'
    : 'You are a task breakdown assistant. Split the given task into 3-6 concrete, actionable subtasks. Each starts with a verb, max 10 words, no numbering. Output only a JSON object: {"subtasks": ["...", "..."]}';

  const { text } = await chat(
    [
      { role: 'system', content: system },
      { role: 'user', content: title },
    ],
    {
      providerId: config.providerId,
      model: config.model,
      apiKey: config.apiKey,
      jsonMode: true,
      temperature: 0.4,
      maxTokens: 600,
      source: '智能拆解',
      signal,
    }
  );

  return parseSubtasks(text);
}

/**
 * 自然语言分类：根据任务标题推断 1-3 个标签 + 优先级(0-3)。
 * 优先复用已有标签名。用轻量级模型（light tier），失败安全降级。
 */
export async function classifyTodo(
  title: string,
  existingTags: string[],
  lang: 'zh' | 'en',
  signal?: AbortSignal
): Promise<{ tags: string[]; priority: number }> {
  const config = getAIConfigByTier('light') || getAIConfigByTier('medium') || getAIConfigByTier('complex');
  if (!config) throw new Error('NO_API_KEY');

  const tagHint = existingTags.length
    ? (lang === 'zh' ? `已有标签（尽量复用）：${existingTags.join('、')}` : `Existing tags (reuse when fitting): ${existingTags.join(', ')}`)
    : '';
  const system = lang === 'zh'
    ? `你是任务分类助手。根据任务标题给出 1-3 个简短标签（每个不超过 6 字）和优先级。优先级：0=无 1=低 2=中 3=高。${tagHint}\n只输出 JSON：{"tags":["..."],"priority":0}`
    : `You are a task classifier. Given a task title, output 1-3 short tags (<=2 words each) and a priority. Priority: 0=none 1=low 2=medium 3=high. ${tagHint}\nOutput only JSON: {"tags":["..."],"priority":0}`;

  const { text } = await chat(
    [
      { role: 'system', content: system },
      { role: 'user', content: title },
    ],
    {
      providerId: config.providerId,
      model: config.model,
      apiKey: config.apiKey,
      jsonMode: true,
      temperature: 0.2,
      maxTokens: 200,
      source: lang === 'zh' ? '智能分类' : 'Classify',
      signal,
    }
  );

  const cleaned = text.replace(/```(?:json)?/g, '').trim();
  try {
    const data = JSON.parse(cleaned);
    const tags = Array.isArray(data?.tags)
      ? data.tags.map((s: unknown) => String(s).trim()).filter((s: string) => s.length > 0 && s.length <= 12).slice(0, 3)
      : [];
    const p = Number(data?.priority);
    const priority = p >= 0 && p <= 3 ? Math.round(p) : 0;
    return { tags, priority };
  } catch {
    return { tags: [], priority: 0 };
  }
}

function parseSubtasks(raw: string): string[] {
  // 剥掉可能的 markdown 代码块包裹
  const cleaned = raw.replace(/```(?:json)?/g, '').trim();
  try {
    const data = JSON.parse(cleaned);
    const list = Array.isArray(data) ? data : data?.subtasks;
    if (Array.isArray(list)) {
      return list
        .map((s) => String(s).trim())
        .filter((s) => s.length > 0 && s.length <= 80)
        .slice(0, 8);
    }
  } catch { /* 走行级回退 */ }
  // 回退：按行切，去掉编号/列表符
  return cleaned
    .split('\n')
    .map((l) => l.replace(/^[\s\-*\d.、)]+/, '').trim())
    .filter((l) => l.length > 1 && l.length <= 80)
    .slice(0, 8);
}
