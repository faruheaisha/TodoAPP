import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import type { Todo } from '../store/todoStore';

export type PdfTemplateId = 'classic' | 'slate' | 'editorial' | 'minimal';

const cS = StyleSheet.create({
  p: { padding: 36, backgroundColor: '#faf9f5' },
  hd: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: '#141413' },
  ti: { fontSize: 20, fontWeight: 700, color: '#141413' },
  sub: { fontSize: 9, color: '#d97757', marginTop: 1 },
  meta: { alignItems: 'flex-end', fontSize: 9, color: '#87867f', lineHeight: 1.6 },
  mn: { fontWeight: 700, color: '#141413' },
  nb: { borderWidth: 0.5, borderStyle: 'dashed', borderColor: '#d1cfc5', borderRadius: 4, padding: 6, marginBottom: 12 },
  nl: { fontSize: 8, fontWeight: 700, color: '#d97757', marginBottom: 2 },
  nt: { fontSize: 10, color: '#5e5d59' },
  sc: { fontSize: 9, fontWeight: 700, color: '#141413', marginTop: 12, marginBottom: 5, flexDirection: 'row', alignItems: 'center' },
  sl: { flex: 1, height: 0.5, backgroundColor: '#e3dacc', marginLeft: 5 },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: '#f0eee6' },
  ck: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: '#d1cfc5' },
  cd: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#d97757', alignItems: 'center', justifyContent: 'center' },
  cm: { fontSize: 6, color: '#fff' },
  tt: { fontSize: 10, color: '#3d3d3a', flex: 1, paddingLeft: 2 },
  td: { fontSize: 10, color: '#b0aea5', flex: 1, textDecoration: 'line-through', paddingLeft: 2 },
  dl: { fontSize: 9, color: '#d97757' },
  ft: { marginTop: 14, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: '#e3dacc', flexDirection: 'row', justifyContent: 'space-between', fontSize: 9, color: '#b0aea5' },
});

const sS = StyleSheet.create({
  p: { padding: 36, backgroundColor: '#141413' },
  hd: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: '#e8e6dc' },
  ti: { fontSize: 20, fontWeight: 700, color: '#e8e6dc' },
  sub: { fontSize: 9, color: '#d97757', marginTop: 1 },
  meta: { alignItems: 'flex-end', fontSize: 9, color: '#5e5d59', lineHeight: 1.6 },
  mn: { fontWeight: 700, color: '#b0aea5' },
  nb: { borderWidth: 0.5, borderStyle: 'dashed', borderColor: '#2a2a28', borderRadius: 4, padding: 6, marginBottom: 12 },
  nl: { fontSize: 8, fontWeight: 700, color: '#d97757', marginBottom: 2 },
  nt: { fontSize: 10, color: '#87867f' },
  sc: { fontSize: 9, fontWeight: 700, color: '#e8e6dc', marginTop: 12, marginBottom: 5, flexDirection: 'row', alignItems: 'center' },
  sl: { flex: 1, height: 0.5, backgroundColor: '#2a2a28', marginLeft: 5 },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: '#222220' },
  ck: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: '#3d3d3a' },
  cd: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#d97757', alignItems: 'center', justifyContent: 'center' },
  cm: { fontSize: 6, color: '#fff' },
  tt: { fontSize: 10, color: '#87867f', flex: 1, paddingLeft: 2 },
  td: { fontSize: 10, color: '#3d3d3a', flex: 1, textDecoration: 'line-through', paddingLeft: 2 },
  dl: { fontSize: 9, color: '#d97757' },
  ft: { marginTop: 14, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: '#2a2a28', flexDirection: 'row', justifyContent: 'space-between', fontSize: 9, color: '#3d3d3a' },
});

const eS = StyleSheet.create({
  p: { padding: 36, backgroundColor: '#fffdf6' },
  hd: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, paddingBottom: 10, borderBottomWidth: 0.5, borderBottomColor: '#e3dacc' },
  ti: { fontSize: 22, fontWeight: 700, color: '#141413' },
  sub: { fontSize: 9, color: '#d97757', fontStyle: 'italic', marginTop: 1 },
  meta: { alignItems: 'flex-end', fontSize: 9, color: '#87867f', lineHeight: 1.6 },
  mn: { fontWeight: 700, color: '#141413' },
  nb: { borderWidth: 0.5, borderStyle: 'dashed', borderColor: '#d1cfc5', borderRadius: 4, padding: 6, marginBottom: 12, borderLeftWidth: 2, borderLeftColor: '#d97757', paddingLeft: 7 },
  nl: { fontSize: 8, fontWeight: 700, color: '#d97757', marginBottom: 2 },
  nt: { fontSize: 10, color: '#5e5d59' },
  sc: { fontSize: 10, fontWeight: 700, color: '#141413', marginTop: 12, marginBottom: 5, flexDirection: 'row', alignItems: 'center' },
  sl: { flex: 1, height: 0.5, backgroundColor: '#e3dacc', marginLeft: 5 },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: '#f5f0e8' },
  ck: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: '#d1cfc5' },
  cd: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#d97757', alignItems: 'center', justifyContent: 'center' },
  cm: { fontSize: 6, color: '#fff' },
  tt: { fontSize: 10, color: '#3d3d3a', flex: 1, paddingLeft: 2 },
  td: { fontSize: 10, color: '#b0aea5', flex: 1, textDecoration: 'line-through', paddingLeft: 2 },
  dl: { fontSize: 9, color: '#d97757' },
  ft: { marginTop: 14, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: '#e3dacc', flexDirection: 'row', justifyContent: 'space-between', fontSize: 9, color: '#b0aea5' },
});

const mS = StyleSheet.create({
  p: { padding: 36, backgroundColor: '#ffffff' },
  hd: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, paddingBottom: 10, borderBottomWidth: 0.5, borderBottomColor: '#e3dacc' },
  ti: { fontSize: 18, fontWeight: 700, color: '#3d3d3a' },
  sub: { fontSize: 9, color: '#87867f', marginTop: 1 },
  meta: { alignItems: 'flex-end', fontSize: 9, color: '#b0aea5', lineHeight: 1.6 },
  mn: { fontWeight: 700, color: '#87867f' },
  nb: { borderWidth: 0.5, borderStyle: 'dashed', borderColor: '#e3dacc', borderRadius: 2, padding: 5, marginBottom: 12 },
  nl: { fontSize: 8, fontWeight: 700, color: '#b0aea5', marginBottom: 2 },
  nt: { fontSize: 10, color: '#87867f' },
  sc: { fontSize: 9, fontWeight: 700, color: '#87867f', marginTop: 12, marginBottom: 5, flexDirection: 'row', alignItems: 'center' },
  sl: { flex: 1, height: 0.5, backgroundColor: '#f0eee6', marginLeft: 5 },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: '#f0eee6' },
  ck: { width: 9, height: 9, borderRadius: 4.5, borderWidth: 1, borderColor: '#d1cfc5' },
  cd: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#d97757', alignItems: 'center', justifyContent: 'center' },
  cm: { fontSize: 6, color: '#fff' },
  tt: { fontSize: 10, color: '#5e5d59', flex: 1, paddingLeft: 2 },
  td: { fontSize: 10, color: '#b0aea5', flex: 1, textDecoration: 'line-through', paddingLeft: 2 },
  dl: { fontSize: 9, color: '#d97757' },
  ft: { marginTop: 14, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: '#f0eee6', flexDirection: 'row', justifyContent: 'space-between', fontSize: 9, color: '#b0aea5' },
});

const sMap: Record<string, unknown> = { classic: cS, slate: sS, editorial: eS, minimal: mS };

function getDeadlineText(deadline: string, lang: 'zh' | 'en'): string {
  const now = Date.now();
  const due = new Date(deadline).getTime();
  const diff = due - now;
  if (diff < 0) return lang === 'zh' ? '已过期' : 'Overdue';
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return lang === 'zh' ? hours + '小时后' : hours + 'h left';
  const days = Math.floor(hours / 24);
  if (days < 30) return lang === 'zh' ? days + '天后' : days + 'd left';
  return new Date(deadline).toLocaleDateString();
}

function TodoPDFPage({
  s, todos, lang, note, reportTitle, userName, pageNum, totalPages,
}: {
  s: any; todos: Todo[]; lang: 'zh' | 'en'; note: string; reportTitle: string;
  userName: string; pageNum: number; totalPages: number;
}) {
  const quick = todos.filter(t => t.todoType === 'quick');
  const long = todos.filter(t => t.todoType === 'longterm');
  const done = todos.filter(t => t.completed).length;
  const today = new Date().toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const title = reportTitle || (lang === 'zh' ? '任务报告' : 'Task Report');
  const appT = lang === 'zh' ? '待办助手' : 'TodoApp';
  const totalT = lang === 'zh' ? '共' + todos.length + '项·完成' + done : todos.length + ' items · ' + done + ' done';
  const noteL = lang === 'zh' ? '可编辑·备注' : 'Notes';

  return (
    <Page size="A4" style={s.p}>
      <View style={s.hd}>
        <View>
          <Text style={s.ti}>{appT}</Text>
          <Text style={s.sub}>{title}</Text>
        </View>
        <View style={s.meta}>
          <Text style={s.mn}>{userName}</Text>
          <Text>{today}</Text>
          <Text>{totalT}</Text>
        </View>
      </View>

      {note ? (
        <View style={s.nb}>
          <Text style={s.nl}>{noteL}</Text>
          <Text style={s.nt}>{note}</Text>
        </View>
      ) : null}

      {long.length > 0 ? (
        <View wrap={false}>
          <View style={s.sc}>
            <Text>{lang === 'zh' ? '长时待办' : 'LONG-TERM'}</Text>
            <View style={s.sl} />
          </View>
          {long.map(t => (
            <View key={t.id} style={s.tr}>
              <View style={t.completed ? s.cd : s.ck}>
                {t.completed ? <Text style={s.cm}>{'✓'}</Text> : null}
              </View>
              <Text style={t.completed ? s.td : s.tt}>{t.title}</Text>
              {t.deadline ? <Text style={s.dl}>{getDeadlineText(t.deadline, lang)}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}

      {quick.length > 0 ? (
        <View wrap={false}>
          <View style={s.sc}>
            <Text>{lang === 'zh' ? '临时待办' : 'QUICK'}</Text>
            <View style={s.sl} />
          </View>
          {quick.map(t => (
            <View key={t.id} style={s.tr}>
              <View style={t.completed ? s.cd : s.ck}>
                {t.completed ? <Text style={s.cm}>{'✓'}</Text> : null}
              </View>
              <Text style={t.completed ? s.td : s.tt}>{t.title}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={s.ft}>
        <Text>TodoApp v0.1.0</Text>
        <Text>{pageNum}/{totalPages}</Text>
      </View>
    </Page>
  );
}

export function TodoPDFDocument({
  todos, lang, template, note, reportTitle, userName,
}: {
  todos: Todo[]; lang: 'zh' | 'en'; template: PdfTemplateId;
  note: string; reportTitle: string; userName: string;
}) {
  return (
    <Document>
      <TodoPDFPage
        s={sMap[template]}
        todos={todos}
        lang={lang}
        note={note}
        reportTitle={reportTitle}
        userName={userName}
        pageNum={1}
        totalPages={1}
      />
    </Document>
  );
}

export async function exportTodosPDF(
  todos: Todo[],
  lang: 'zh' | 'en',
  template: PdfTemplateId = 'classic',
  note: string = '',
  reportTitle: string = 'Task Report',
  userName: string = '',
): Promise<void> {
  const blob = await pdf(
    <TodoPDFDocument
      todos={todos}
      lang={lang}
      template={template}
      note={note}
      reportTitle={reportTitle}
      userName={userName}
    />
  ).toBlob();

  try {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    const path = await save({
      defaultPath: 'TodoApp-Report-' + new Date().toISOString().split('T')[0] + '.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (path) {
      const arrayBuffer = await blob.arrayBuffer();
      await writeFile(path, new Uint8Array(arrayBuffer));
      return;
    }
  } catch {
    // Tauri dialog not available — fallback to browser download
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'TodoApp-Report-' + new Date().toISOString().split('T')[0] + '.pdf';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
