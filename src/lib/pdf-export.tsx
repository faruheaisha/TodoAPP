/**
 * pdf-export.ts — PDF 导出引擎（jsPDF v4 + Windows 系统字体）
 *
 * 替换原 @react-pdf/renderer 方案，解决以下问题：
 *  1. Google Fonts 运行时 fetch 在 Tauri WebView 中不稳定（网络/CSP 限制）
 *  2. woff2 子集只含单一 Unicode range，导致拉丁字符也乱码
 *  3. 模板通过 StyleSheet 写死，难以后续扩展
 *
 * 新方案：
 *  - jsPDF (GitHub ⭐29k, parallax/jsPDF)：纯 JS PDF 生成，无 React 渲染依赖
 *  - 通过 Tauri FS 读取 Windows 系统 SimHei.ttf（TTF 单文件，支持中英文）
 *  - TemplateConfig 数据对象驱动 4 套模板，后续增减只需加一条配置
 */
import { jsPDF } from 'jspdf';
import type { Todo } from '../store/todoStore';

export type PdfTemplateId = 'classic' | 'slate' | 'editorial' | 'minimal';

// ─── 模板配置（数据驱动，后续增减只需修改此处）───────────────────────────────
interface TemplateConfig {
  name: string;
  bg: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  borderColor: string;
  headerLineWidth: number;
  titleSize: number;
  bodySize: number;
  metaSize: number;
}

export const TEMPLATE_CONFIGS: Record<PdfTemplateId, TemplateConfig> = {
  classic: {
    name: 'Classic Ivory',
    bg: '#faf9f5',
    textPrimary: '#141413',
    textSecondary: '#3d3d3a',
    textMuted: '#b0aea5',
    accent: '#d97757',
    borderColor: '#e3dacc',
    headerLineWidth: 2,
    titleSize: 20,
    bodySize: 10,
    metaSize: 9,
  },
  slate: {
    name: 'Midnight Slate',
    bg: '#141413',
    textPrimary: '#e8e6dc',
    textSecondary: '#87867f',
    textMuted: '#5e5d59',
    accent: '#d97757',
    borderColor: '#2a2a28',
    headerLineWidth: 2,
    titleSize: 20,
    bodySize: 10,
    metaSize: 9,
  },
  editorial: {
    name: 'Editorial Draft',
    bg: '#fffdf6',
    textPrimary: '#141413',
    textSecondary: '#3d3d3a',
    textMuted: '#b0aea5',
    accent: '#d97757',
    borderColor: '#e3dacc',
    headerLineWidth: 0.5,
    titleSize: 22,
    bodySize: 10,
    metaSize: 9,
  },
  minimal: {
    name: 'Minimal Lines',
    bg: '#ffffff',
    textPrimary: '#3d3d3a',
    textSecondary: '#5e5d59',
    textMuted: '#b0aea5',
    accent: '#d97757',
    borderColor: '#e3dacc',
    headerLineWidth: 0.5,
    titleSize: 18,
    bodySize: 10,
    metaSize: 9,
  },
};

// ─── 工具函数 ────────────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  return [
    parseInt(c.substring(0, 2), 16),
    parseInt(c.substring(2, 4), 16),
    parseInt(c.substring(4, 6), 16),
  ];
}

function getDeadlineText(deadline: string, lang: 'zh' | 'en'): string {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff < 0) return lang === 'zh' ? '已过期' : 'Overdue';
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return lang === 'zh' ? `${hours}小时后` : `${hours}h left`;
  const days = Math.floor(hours / 24);
  if (days < 30) return lang === 'zh' ? `${days}天后` : `${days}d left`;
  return new Date(deadline).toLocaleDateString();
}

// ─── 字体加载（Windows 系统字体，离线可用）──────────────────────────────────
let fontBase64Cache: string | null = null;
let fontLoadAttempted = false;

async function loadCJKFontBase64(): Promise<string | null> {
  if (fontLoadAttempted) return fontBase64Cache;
  fontLoadAttempted = true;
  try {
    const { readFile } = await import('@tauri-apps/plugin-fs');
    // Windows 内置 CJK 字体候选（均含中英文，TTF 单文件）
    const candidates = [
      'C:\\Windows\\Fonts\\simhei.ttf',   // 黑体（Win7+，约 9.7MB）
      'C:\\Windows\\Fonts\\SIMHEI.TTF',
      'C:\\Windows\\Fonts\\simkai.ttf',    // 楷体（备选）
      'C:\\Windows\\Fonts\\SIMKAI.TTF',
    ];
    for (const path of candidates) {
      try {
        const bytes = await readFile(path);
        // Uint8Array → base64（分块避免 call stack overflow）
        const CHUNK = 8192;
        let binary = '';
        for (let i = 0; i < bytes.length; i += CHUNK) {
          binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
        }
        fontBase64Cache = btoa(binary);
        console.log(`[PDF] CJK font loaded from ${path}`);
        return fontBase64Cache;
      } catch {
        // 尝试下一个候选
      }
    }
    console.warn('[PDF] No system CJK font found, falling back to Helvetica');
  } catch (e) {
    console.warn('[PDF] Font loading failed:', e);
  }
  return null;
}

// ─── PDF 生成主函数 ──────────────────────────────────────────────────────────
export async function exportTodosPDF(
  todos: Todo[],
  lang: 'zh' | 'en',
  template: PdfTemplateId = 'classic',
  note: string = '',
  reportTitle: string = '',
  userName: string = '',
  downloadPath: string = '',
): Promise<void> {
  const cfg = TEMPLATE_CONFIGS[template];

  // jsPDF A4 竖版，单位 pt（1pt = 1/72 inch）
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const PAD = 42;               // 页面四周留白
  const CONTENT_W = PAGE_W - PAD * 2;
  const LINE_H = 17;            // 待办行高
  const SECTION_GAP = 8;        // 分节间距

  // 注册 CJK 字体
  const fontB64 = await loadCJKFontBase64();
  let fontFamily = 'helvetica';
  if (fontB64) {
    doc.addFileToVFS('TodoAppCJK.ttf', fontB64);
    doc.addFont('TodoAppCJK.ttf', 'TodoAppCJK', 'normal');
    fontFamily = 'TodoAppCJK';
  }

  // 辅助：设置文字颜色（接受 hex string）
  const setColor = (hex: string) => doc.setTextColor(...hexToRgb(hex));
  const setDraw  = (hex: string) => doc.setDrawColor(...hexToRgb(hex));
  const setFill  = (hex: string) => doc.setFillColor(...hexToRgb(hex));

  // ── 背景 ──────────────────────────────────────────────────────────────────
  setFill(cfg.bg);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');

  let y = PAD;
  doc.setFont(fontFamily, 'normal');

  // ── 页眉 ──────────────────────────────────────────────────────────────────
  const appTitle   = lang === 'zh' ? '待办助手' : 'TodoApp';
  const title      = reportTitle || (lang === 'zh' ? '任务报告' : 'Task Report');
  const done       = todos.filter(t => t.completed).length;
  const totalLabel = lang === 'zh'
    ? `共 ${todos.length} 项 · 完成 ${done}`
    : `${todos.length} items · ${done} done`;
  const today = new Date().toLocaleDateString(
    lang === 'zh' ? 'zh-CN' : 'en-US',
    { year: 'numeric', month: '2-digit', day: '2-digit' }
  );

  // 左：应用名
  doc.setFontSize(cfg.titleSize);
  setColor(cfg.textPrimary);
  doc.text(appTitle, PAD, y + cfg.titleSize * 0.78);

  // 左：报告副标题
  doc.setFontSize(cfg.metaSize);
  setColor(cfg.accent);
  doc.text(title, PAD, y + cfg.titleSize * 0.78 + 13);

  // 右：用户名 / 日期 / 统计
  const rightX = PAGE_W - PAD;
  const opts = { align: 'right' as const };
  if (userName) {
    doc.setFontSize(cfg.metaSize);
    setColor(cfg.textPrimary);
    doc.text(userName, rightX, y + cfg.metaSize + 2, opts);
  }
  doc.setFontSize(cfg.metaSize);
  setColor(cfg.textSecondary);
  doc.text(today,      rightX, y + cfg.metaSize + 14, opts);
  doc.text(totalLabel, rightX, y + cfg.metaSize + 26, opts);

  y += cfg.titleSize + 20;

  // 分割线
  setDraw(cfg.textPrimary);
  doc.setLineWidth(cfg.headerLineWidth);
  doc.line(PAD, y, PAGE_W - PAD, y);
  y += 16;

  // ── 备注框（可选）────────────────────────────────────────────────────────
  if (note.trim()) {
    const noteLabel = lang === 'zh' ? '备注' : 'Notes';
    const BOX_PAD   = 8;
    const noteLines = doc.splitTextToSize(note, CONTENT_W - BOX_PAD * 2 - 6);
    const boxH      = BOX_PAD * 2 + 11 + noteLines.length * 13;

    setDraw(cfg.borderColor);
    doc.setLineWidth(0.5);
    doc.roundedRect(PAD, y, CONTENT_W, boxH, 3, 3, 'S');

    // 左侧强调线（editorial 专属）
    if (template === 'editorial') {
      setDraw(cfg.accent);
      doc.setLineWidth(2);
      doc.line(PAD, y + 2, PAD, y + boxH - 2);
    }

    doc.setFontSize(8);
    setColor(cfg.accent);
    doc.text(noteLabel, PAD + BOX_PAD + (template === 'editorial' ? 6 : 0), y + BOX_PAD + 8);

    doc.setFontSize(cfg.bodySize);
    setColor(cfg.textSecondary);
    doc.text(noteLines, PAD + BOX_PAD + (template === 'editorial' ? 6 : 0), y + BOX_PAD + 21);

    y += boxH + 14;
  }

  // ── 待办分节渲染 ─────────────────────────────────────────────────────────
  const renderSection = (items: Todo[], label: string) => {
    if (items.length === 0) return;

    // 分节标题
    doc.setFontSize(cfg.metaSize);
    setColor(cfg.textPrimary);
    doc.text(label, PAD, y + 9);
    const labelW = doc.getTextWidth(label);

    setDraw(cfg.borderColor);
    doc.setLineWidth(0.5);
    doc.line(PAD + labelW + 6, y + 5.5, PAGE_W - PAD, y + 5.5);
    y += 18;

    // 待办条目
    for (const todo of items) {
      const CX = PAD + 5.5;
      const CY = y + LINE_H / 2;
      const CR = 3.8;

      // 复选框
      if (todo.completed) {
        setFill(cfg.accent);
        doc.circle(CX, CY, CR, 'F');
        // 勾
        setDraw('#ffffff');
        doc.setLineWidth(0.9);
        doc.line(CX - 2,   CY + 0.3, CX - 0.5, CY + 2);
        doc.line(CX - 0.5, CY + 2,   CX + 2.5, CY - 1.8);
      } else {
        setDraw(cfg.borderColor);
        doc.setLineWidth(0.7);
        doc.circle(CX, CY, CR, 'S');
      }

      // 标题文字（截断超长内容）
      const deadlineW = todo.deadline && !todo.completed ? 68 : 0;
      const titleMaxW = CONTENT_W - 14 - deadlineW;
      const titleX    = PAD + 14;

      doc.setFontSize(cfg.bodySize);
      if (todo.completed) {
        setColor(cfg.textMuted);
        const line0 = doc.splitTextToSize(todo.title, titleMaxW)[0];
        doc.text(line0, titleX, y + 11);
        // 删除线（手动绘制）
        const tw = Math.min(doc.getTextWidth(line0), titleMaxW);
        setDraw(cfg.textMuted);
        doc.setLineWidth(0.5);
        doc.line(titleX, y + 8, titleX + tw, y + 8);
      } else {
        setColor(cfg.textSecondary);
        const titleLines = doc.splitTextToSize(todo.title, titleMaxW);
        doc.text(titleLines[0], titleX, y + 11);
        // 多行续排
        for (let li = 1; li < titleLines.length && li < 3; li++) {
          y += LINE_H;
          doc.text(titleLines[li], titleX, y + 11);
        }
      }

      // 截止时间
      if (todo.deadline && !todo.completed) {
        doc.setFontSize(8);
        setColor(cfg.accent);
        doc.text(getDeadlineText(todo.deadline, lang), PAGE_W - PAD, y + 11, { align: 'right' });
      }

      // 行分隔线
      setDraw(cfg.borderColor);
      doc.setLineWidth(0.3);
      doc.line(PAD, y + LINE_H, PAGE_W - PAD, y + LINE_H);

      y += LINE_H;
    }
    y += SECTION_GAP;
  };

  renderSection(todos.filter(t => t.todoType === 'longterm'), lang === 'zh' ? '长时待办' : 'LONG-TERM');
  renderSection(todos.filter(t => t.todoType === 'quick'),    lang === 'zh' ? '临时待办' : 'QUICK');

  // ── 页脚 ──────────────────────────────────────────────────────────────────
  const footerY = PAGE_H - PAD + 4;
  setDraw(cfg.borderColor);
  doc.setLineWidth(0.5);
  doc.line(PAD, footerY - 8, PAGE_W - PAD, footerY - 8);

  doc.setFontSize(cfg.metaSize);
  setColor(cfg.textMuted);
  doc.text('TodoApp v0.1.0',      PAD,          footerY);
  doc.text('1/1',                 PAGE_W - PAD, footerY, { align: 'right' });

  // ── 保存 ─────────────────────────────────────────────────────────────────
  const filename = `TodoApp-Report-${new Date().toISOString().split('T')[0]}.pdf`;

  try {
    const { save }      = await import('@tauri-apps/plugin-dialog');
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    const path = await save({
      defaultPath: downloadPath ? `${downloadPath}/${filename}` : filename,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (path) {
      await writeFile(path, new Uint8Array(doc.output('arraybuffer')));
      return;
    }
  } catch {
    // Tauri 环境不可用，回退到浏览器下载
  }

  doc.save(filename);
}
