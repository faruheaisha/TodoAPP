/**
 * export-chat.ts — 导出会话为 Markdown
 */
import type { ChatSession } from '../store/chatStore';

export function exportSessionAsMarkdown(session: ChatSession, lang: 'zh' | 'en'): string {
  const title = session.title || (lang === 'zh' ? '未命名对话' : 'Untitled');
  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`> ${lang === 'zh' ? `模式：${session.mode === 'cowork' ? '协作' : '聊天'}` : `Mode: ${session.mode}`}`);
  lines.push(`> ${new Date(session.createdAt).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US')}`);
  lines.push(`> ${session.messages.length} ${lang === 'zh' ? '条消息' : 'messages'}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const msg of session.messages) {
    const roleLabel = msg.role === 'user'
      ? (lang === 'zh' ? '👤 用户' : '👤 User')
      : (lang === 'zh' ? '🐾 Asha' : '🐾 Asha');
    lines.push(`### ${roleLabel}`);
    lines.push('');
    lines.push(msg.content);
    lines.push('');
    if (msg.toolTrace && msg.toolTrace.length > 0) {
      lines.push('*工具调用：*');
      for (const t of msg.toolTrace) {
        lines.push(`- ${t.name}: ${t.summary}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function downloadMarkdown(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
