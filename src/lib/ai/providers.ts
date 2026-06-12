/**
 * providers.ts — LLM 厂商注册表（系统固定配置）
 *
 * 8 家厂商中 7 家走 OpenAI Chat Completions 兼容端点，
 * Anthropic Claude 走原生 Messages API（kind: 'anthropic'）。
 * baseUrl 与鉴权方式来源于各厂商官方文档（2026-06 核实）。
 *
 * 沙盒原则：本清单为系统固定配置，AI / 用户配置不得增删改；
 * 用户只能为每家填入自己的 API key 与模型名（存 aiStore，仅本机）。
 * 网络边界：capabilities/default.json 的 http 白名单与本清单一一对应。
 */

export type ProviderKind = 'openai' | 'anthropic';

export interface ProviderDef {
  id: string;
  /** 显示名 */
  name: string;
  /** Chat Completions / Messages 端点的 base（不含路径尾） */
  baseUrl: string;
  kind: ProviderKind;
  /** 预设模型（用户可手填覆盖） */
  presetModels: string[];
  /** 获取 key 的控制台地址（设置页跳转提示用） */
  consoleUrl: string;
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    kind: 'openai',
    presetModels: ['deepseek-chat', 'deepseek-reasoner'],
    consoleUrl: 'https://platform.deepseek.com',
  },
  {
    id: 'kimi',
    name: 'Kimi (月之暗面)',
    baseUrl: 'https://api.moonshot.cn/v1',
    kind: 'openai',
    presetModels: ['moonshot-v1-8k', 'kimi-latest'],
    consoleUrl: 'https://platform.moonshot.cn',
  },
  {
    id: 'glm',
    name: 'GLM (智谱)',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    kind: 'openai',
    presetModels: ['glm-4-flash', 'glm-4-plus'],
    consoleUrl: 'https://open.bigmodel.cn',
  },
  {
    id: 'qwen',
    name: 'Qwen (通义千问)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    kind: 'openai',
    presetModels: ['qwen-plus', 'qwen-turbo', 'qwen-max'],
    consoleUrl: 'https://bailian.console.aliyun.com',
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    baseUrl: 'https://api.minimax.chat/v1',
    kind: 'openai',
    presetModels: ['MiniMax-Text-01'],
    consoleUrl: 'https://platform.minimaxi.com',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    kind: 'openai',
    presetModels: ['gpt-4o-mini', 'gpt-4o'],
    consoleUrl: 'https://platform.openai.com',
  },
  {
    id: 'claude',
    name: 'Claude (Anthropic)',
    baseUrl: 'https://api.anthropic.com/v1',
    kind: 'anthropic',
    presetModels: ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
    consoleUrl: 'https://console.anthropic.com',
  },
  {
    id: 'gemini',
    name: 'Gemini (Google)',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    kind: 'openai',
    presetModels: ['gemini-2.0-flash', 'gemini-2.5-pro'],
    consoleUrl: 'https://aistudio.google.com',
  },
];

export function getProvider(id: string): ProviderDef | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
