import { Document, Page, Text, View, StyleSheet, Font, pdf } from '@react-pdf/renderer';
import type { Todo } from '../store/todoStore';

Font.register({
  family: 'Inter',
  src: 'https://fonts.gstatic.com/s/inter/v18/UcCo3FwrK3iLTcviYwY.woff',
});

const styles = StyleSheet.create({
  page: { padding: 40, backgroundColor: '#FAF9F7', fontFamily: 'Inter' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  logoDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#D97757', marginRight: 12 },
  title: { fontSize: 20, fontWeight: 700, color: '#1A1814' },
  subtitle: { fontSize: 11, color: '#8C8A87', marginTop: 4 },
  divider: { borderWidth: 0, borderBottomWidth: 1, borderColor: '#E5E3DF', marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: 600, color: '#1A1814', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  todoItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: '#E5E3DF' },
  todoCheckbox: { width: 14, height: 14, borderWidth: 1.5, borderColor: '#E5E3DF', borderRadius: 7, marginRight: 10 },
  todoCheckboxDone: { width: 14, height: 14, borderWidth: 1.5, borderColor: '#D97757', borderRadius: 7, backgroundColor: '#D97757', marginRight: 10 },
  todoText: { fontSize: 12, color: '#1A1814', flex: 1 },
  todoTextDone: { fontSize: 12, color: '#8C8A87', flex: 1, textDecoration: 'line-through' },
  todoDeadline: { fontSize: 10, color: '#8C8A87', padding: 2, paddingLeft: 6, paddingRight: 6, borderRadius: 3, backgroundColor: '#F5F3F0' },
  todoDeadlineUrgent: { fontSize: 10, color: '#D97757', padding: 2, paddingLeft: 6, paddingRight: 6, borderRadius: 3, backgroundColor: '#FFF4F0', fontWeight: 600 },
  footer: { marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderColor: '#E5E3DF', flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 10, color: '#8C8A87' },
});

export function TodoPDFDocument({ todos, lang }: { todos: Todo[]; lang: 'zh' | 'en' }) {
  const quickTodos = todos.filter((t) => t.todoType === 'quick');
  const longtermTodos = todos.filter((t) => t.todoType === 'longterm');
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.logoDot} />
          <Text style={styles.title}>{lang === 'zh' ? '待办事项报告' : 'Todo Report'}</Text>
        </View>
        <Text style={styles.subtitle}>Generated: {new Date().toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US')}</Text>
        <View style={styles.divider} />
        {longtermTodos.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <Text style={styles.sectionTitle}>{lang === 'zh' ? '▸ 长时待办' : '▸ Long-term'} ({longtermTodos.length})</Text>
            {longtermTodos.map((todo) => (
              <View key={todo.id} style={styles.todoItem}>
                <View style={todo.completed ? styles.todoCheckboxDone : styles.todoCheckbox} />
                <Text style={todo.completed ? styles.todoTextDone : styles.todoText}>{todo.title}</Text>
                {todo.deadline && <Text style={styles.todoDeadline}>{new Date(todo.deadline).toLocaleDateString()}</Text>}
              </View>
            ))}
          </View>
        )}
        {quickTodos.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <Text style={styles.sectionTitle}>{lang === 'zh' ? '▸ 临时待办' : '▸ Quick'} ({quickTodos.length})</Text>
            {quickTodos.map((todo) => (
              <View key={todo.id} style={styles.todoItem}>
                <View style={todo.completed ? styles.todoCheckboxDone : styles.todoCheckbox} />
                <Text style={todo.completed ? styles.todoTextDone : styles.todoText}>{todo.title}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {lang === 'zh'
              ? `共 ${todos.length} 项 · 完成 ${todos.filter((t) => t.completed).length} 项`
              : `Total: ${todos.length} · Completed: ${todos.filter((t) => t.completed).length}`}
          </Text>
          <Text style={styles.footerText}>TodoApp v0.1.0</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function exportTodosPDF(todos: Todo[], lang: 'zh' | 'en'): Promise<void> {
  const blob = await pdf(<TodoPDFDocument todos={todos} lang={lang} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const today = new Date().toISOString().split('T')[0];
  a.download = `TodoApp-Report-${today}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
