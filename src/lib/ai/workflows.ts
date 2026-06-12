/**
 * workflows.ts — 预置 AI 工作流
 *
 * 与 client.ts 解耦：工作流只组装 prompt 并解析结构化结果，
 * 厂商与模型由 aiStore 的激活配置决定。
 * 调用方负责处理 NO_API_KEY（引导用户去设置页）。
 */
import { chat } from './client';
import { getActiveAIConfig } from '../../store/aiStore';

/**
 * 任务拆解：把一条待办标题拆成 3-6 个可执行子任务。
 * 返回子任务标题数组；JSON 模式 + 容错解析（裸数组 / {subtasks: []} / markdown 包裹均可）。
 */
export async function breakdownTodo(title: string, lang: 'zh' | 'en', signal?: AbortSignal): Promise<string[]> {
  const config = getActiveAIConfig();
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
      signal,
    }
  );

  return parseSubtasks(text);
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
