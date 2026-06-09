/**
 * pdf-export.ts — 字体随 App 打包分发，无需用户额外安装
 *
 * 字体策略（跨平台一致，自包含）：
 *   public/fonts/NotoSansSC-zh.woff2    ← 简体中文子集 (1.1 MB)
 *   public/fonts/NotoSansSC-latin.woff2 ← 拉丁/英文子集 (13 KB)
 *   来源: @fontsource/noto-sans-sc (SIL OFL, 可随商业 app 分发)
 *   随 `tauri build` 打包入安装包，用户无感知，iOS/Android 同理
 *
 * 渲染流程：
 *   FontFace API 加载打包字体 → Canvas 2D 渲染页面 → jsPDF 封装为 PDF
 *   FontFace API 由 WebView (Chromium/WebKit) 保证跨平台一致
 */
import { jsPDF } from 'jspdf';
import type { Todo } from '../store/todoStore';

// ─── 模板系统（数据驱动，扩展只需增加一条配置）──────────────────────────────
export type PdfTemplateId = 'classic' | 'slate' | 'editorial' | 'minimal';

interface TemplateConfig {
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
  noteLeftBar?: boolean;
}

export const TEMPLATE_CONFIGS: Record<PdfTemplateId, TemplateConfig> = {
  classic: {
    bg: '#faf9f5', textPrimary: '#141413', textSecondary: '#3d3d3a',
    textMuted: '#b0aea5', accent: '#d97757', borderColor: '#e3dacc',
    headerLineWidth: 2.5, titleSize: 26, bodySize: 13, metaSize: 11,
  },
  slate: {
    bg: '#141413', textPrimary: '#e8e6dc', textSecondary: '#87867f',
    textMuted: '#5e5d59', accent: '#d97757', borderColor: '#2a2a28',
    headerLineWidth: 2.5, titleSize: 26, bodySize: 13, metaSize: 11,
  },
  editorial: {
    bg: '#fffdf6', textPrimary: '#141413', textSecondary: '#3d3d3a',
    textMuted: '#b0aea5', accent: '#d97757', borderColor: '#e3dacc',
    headerLineWidth: 0.8, titleSize: 30, bodySize: 13, metaSize: 11,
    noteLeftBar: true,
  },
  minimal: {
    bg: '#ffffff', textPrimary: '#3d3d3a', textSecondary: '#5e5d59',
    textMuted: '#b0aea5', accent: '#d97757', borderColor: '#e3dacc',
    headerLineWidth: 0.8, titleSize: 22, bodySize: 13, metaSize: 11,
  },
};

// ─── 字体加载（app bundle 内，FontFace API）───────────────────────────────────
const FONT_FAMILY = 'NotoSansSC-PDF';
let fontLoadPromise: Promise<void> | null = null;

function ensureFonts(): Promise<void> {
  if (fontLoadPromise) return fontLoadPromise;

  fontLoadPromise = (async () => {
    try {
      // 在 Tauri 中，public/ 下的文件通过内部 asset server 提供
      // URL 格式: /fonts/xxx.woff2 (Vite dev) 或 asset://localhost/fonts/xxx.woff2 (prod)
      const base = '';  // Tauri + Vite 均使用相对路径，asset server 自动处理

      const zhFont  = new FontFace(FONT_FAMILY, `url(${base}/fonts/NotoSansSC-zh.woff2)`, {
        weight: '400',
        style: 'normal',
        unicodeRange: 'U+0000-00FF,U+4E00-9FFF,U+3400-4DBF,U+F900-FAFF,U+2E80-2EFF,U+3000-303F,U+FE30-FE4F,U+FF00-FFEF',
      });
      const latinFont = new FontFace(FONT_FAMILY, `url(${base}/fonts/NotoSansSC-latin.woff2)`, {
        weight: '400',
        style: 'normal',
        unicodeRange: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
      });

      const [loaded1, loaded2] = await Promise.all([zhFont.load(), latinFont.load()]);
      document.fonts.add(loaded1);
      document.fonts.add(loaded2);
      await document.fonts.ready;
      console.log('[PDF] NotoSansSC fonts loaded from app bundle');
    } catch (e) {
      console.warn('[PDF] Bundle font load failed, falling back to system fonts:', e);
      // 降级：Canvas 仍会用系统 CJK 字体（Microsoft YaHei / PingFang SC）
    }
  })();

  return fontLoadPromise;
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────
function deadlineText(deadline: string, lang: 'zh' | 'en'): string {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff < 0) return lang === 'zh' ? '已过期' : 'Overdue';
  const h = Math.floor(diff / 3600000);
  if (h < 24) return lang === 'zh' ? `${h}小时后` : `${h}h left`;
  const d = Math.floor(h / 24);
  if (d < 30) return lang === 'zh' ? `${d}天后` : `${d}d left`;
  return new Date(deadline).toLocaleDateString();
}

function ellipsis(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

// ─── Canvas 渲染 ──────────────────────────────────────────────────────────────
function renderToCanvas(
  todos: Todo[],
  lang: 'zh' | 'en',
  cfg: TemplateConfig,
  note: string,
  reportTitle: string,
  userName: string,
): HTMLCanvasElement {
  const SCALE = 2;
  const W = 794;
  const H = 1123;
  const PAD = 50;
  const CW = W - PAD * 2;
  const ROW_H = 26;
  const GAP = 12;

  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SCALE, SCALE);

  // 字体栈：优先使用打包的 NotoSansSC，其次回退系统 CJK 字体
  const FALLBACK = '"Microsoft YaHei","微软雅黑","PingFang SC","Noto Sans CJK SC",SimHei,sans-serif';
  const F = (size: number, bold = false) =>
    `${bold ? 'bold ' : ''}${size}px "${FONT_FAMILY}",${FALLBACK}`;

  // 背景
  ctx.fillStyle = cfg.bg;
  ctx.fillRect(0, 0, W, H);

  let y = PAD;

  // ── 页眉 ────────────────────────────────────────────────────────────────────
  const appTitle   = lang === 'zh' ? '待办助手' : 'TodoApp';
  const title      = reportTitle.trim() || (lang === 'zh' ? '任务报告' : 'Task Report');
  const done       = todos.filter(t => t.completed).length;
  const totalLabel = lang === 'zh' ? `共 ${todos.length} 项 · 完成 ${done}` : `${todos.length} items · ${done} done`;
  const today      = new Date().toLocaleDateString(
    lang === 'zh' ? 'zh-CN' : 'en-US',
    { year: 'numeric', month: '2-digit', day: '2-digit' }
  );

  ctx.font = F(cfg.titleSize, true);
  ctx.fillStyle = cfg.textPrimary;
  ctx.fillText(appTitle, PAD, y + cfg.titleSize * 0.8);

  ctx.font = F(cfg.metaSize);
  ctx.fillStyle = cfg.accent;
  ctx.fillText(title, PAD, y + cfg.titleSize * 0.8 + 18);

  ctx.textAlign = 'right';
  const RX = W - PAD;
  if (userName.trim()) {
    ctx.font = F(cfg.metaSize, true);
    ctx.fillStyle = cfg.textPrimary;
    ctx.fillText(userName, RX, y + cfg.metaSize + 2);
    ctx.font = F(cfg.metaSize);
    ctx.fillStyle = cfg.textSecondary;
    ctx.fillText(today,      RX, y + cfg.metaSize + 19);
    ctx.fillText(totalLabel, RX, y + cfg.metaSize + 36);
  } else {
    ctx.font = F(cfg.metaSize);
    ctx.fillStyle = cfg.textSecondary;
    ctx.fillText(today,      RX, y + cfg.metaSize + 2);
    ctx.fillText(totalLabel, RX, y + cfg.metaSize + 19);
  }
  ctx.textAlign = 'left';

  y += cfg.titleSize + 30;

  // 分割线
  ctx.strokeStyle = cfg.textPrimary;
  ctx.lineWidth   = cfg.headerLineWidth;
  ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
  y += 20;

  // ── 备注框 ──────────────────────────────────────────────────────────────────
  if (note.trim()) {
    const BP = 10;
    const noteLabel = lang === 'zh' ? '备注' : 'Notes';
    ctx.font = F(cfg.bodySize);
    const lines: string[] = [];
    let line = '';
    const maxW = CW - BP * 2 - (cfg.noteLeftBar ? 14 : 4);
    for (const ch of note) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxW) { lines.push(line); line = ch; }
      else line = test;
    }
    if (line) lines.push(line);
    const boxH = BP * 2 + 16 + lines.length * (cfg.bodySize + 5);

    ctx.strokeStyle = cfg.borderColor; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.roundRect(PAD, y, CW, boxH, 4); ctx.stroke();
    if (cfg.noteLeftBar) {
      ctx.fillStyle = cfg.accent;
      ctx.beginPath(); ctx.roundRect(PAD, y + 3, 3, boxH - 6, 1); ctx.fill();
    }

    const tx = PAD + BP + (cfg.noteLeftBar ? 10 : 0);
    ctx.font = F(10); ctx.fillStyle = cfg.accent;
    ctx.fillText(noteLabel, tx, y + BP + 12);
    ctx.font = F(cfg.bodySize); ctx.fillStyle = cfg.textSecondary;
    lines.forEach((l, i) => ctx.fillText(l, tx, y + BP + 28 + i * (cfg.bodySize + 5)));

    y += boxH + 16;
  }

  // ── 待办分节 ─────────────────────────────────────────────────────────────────
  const renderSection = (items: Todo[], label: string) => {
    if (!items.length) return;

    ctx.font = F(cfg.metaSize, true);
    ctx.fillStyle = cfg.textPrimary;
    ctx.fillText(label, PAD, y + 12);
    const lw = ctx.measureText(label).width;

    ctx.strokeStyle = cfg.borderColor; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(PAD + lw + 8, y + 7); ctx.lineTo(W - PAD, y + 7); ctx.stroke();
    y += 22;

    for (const todo of items) {
      const CX = PAD + 7.5;
      const CY = y + ROW_H / 2;

      // 复选圆
      if (todo.completed) {
        ctx.fillStyle = cfg.accent;
        ctx.beginPath(); ctx.arc(CX, CY, 5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(CX - 2.5, CY);
        ctx.lineTo(CX - 0.5, CY + 2.5);
        ctx.lineTo(CX + 3, CY - 2.5);
        ctx.stroke();
      } else {
        ctx.strokeStyle = cfg.borderColor; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.arc(CX, CY, 5, 0, Math.PI * 2); ctx.stroke();
      }

      // 截止时间宽度预留
      let dlW = 0, dlText = '';
      if (todo.deadline && !todo.completed) {
        dlText = deadlineText(todo.deadline, lang);
        ctx.font = F(10);
        dlW = ctx.measureText(dlText).width + 6;
      }

      const tX = PAD + 20;
      ctx.font = F(cfg.bodySize);
      const titleStr = ellipsis(ctx, todo.title, CW - 20 - dlW);

      if (todo.completed) {
        ctx.fillStyle = cfg.textMuted;
        ctx.fillText(titleStr, tX, y + ROW_H / 2 + cfg.bodySize * 0.35);
        const tw = ctx.measureText(titleStr).width;
        ctx.strokeStyle = cfg.textMuted; ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(tX, CY - 1); ctx.lineTo(tX + tw, CY - 1); ctx.stroke();
      } else {
        ctx.fillStyle = cfg.textSecondary;
        ctx.fillText(titleStr, tX, y + ROW_H / 2 + cfg.bodySize * 0.35);
      }

      if (dlText) {
        ctx.font = F(10); ctx.fillStyle = cfg.accent;
        ctx.textAlign = 'right';
        ctx.fillText(dlText, W - PAD, y + ROW_H / 2 + 4);
        ctx.textAlign = 'left';
      }

      ctx.strokeStyle = cfg.borderColor; ctx.lineWidth = 0.4;
      ctx.beginPath(); ctx.moveTo(PAD, y + ROW_H); ctx.lineTo(W - PAD, y + ROW_H); ctx.stroke();
      y += ROW_H;
    }
    y += GAP;
  };

  renderSection(todos.filter(t => t.todoType === 'longterm'), lang === 'zh' ? '长时待办' : 'LONG-TERM');
  renderSection(todos.filter(t => t.todoType === 'quick'),    lang === 'zh' ? '临时待办' : 'QUICK');

  // ── 页脚 ─────────────────────────────────────────────────────────────────────
  ctx.strokeStyle = cfg.borderColor; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(PAD, H - PAD - 10); ctx.lineTo(W - PAD, H - PAD - 10); ctx.stroke();

  ctx.font = F(cfg.metaSize); ctx.fillStyle = cfg.textMuted;
  ctx.fillText('TodoApp v0.1.0', PAD, H - PAD);
  ctx.textAlign = 'right';
  ctx.fillText('1 / 1', W - PAD, H - PAD);
  ctx.textAlign = 'left';

  return canvas;
}

// ─── 导出入口 ─────────────────────────────────────────────────────────────────
export async function exportTodosPDF(
  todos: Todo[],
  lang: 'zh' | 'en',
  template: PdfTemplateId = 'classic',
  note: string = '',
  reportTitle: string = '',
  userName: string = '',
  downloadPath: string = '',
): Promise<void> {
  // 1. 确保打包字体已加载（app bundle 内，无网络依赖）
  await ensureFonts();

  // 2. Canvas 渲染
  const cfg    = TEMPLATE_CONFIGS[template];
  const canvas = renderToCanvas(todos, lang, cfg, note, reportTitle, userName);

  // 3. Canvas → PDF
  const dataUrl = canvas.toDataURL('image/png');
  const doc     = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  doc.addImage(dataUrl, 'PNG', 0, 0, 595.28, 841.89);

  // 4. 保存
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
  } catch { /* Tauri 不可用 */ }

  doc.save(filename);
}
