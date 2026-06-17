import { useTodoStore } from '../store/todoStore';
import { useHabitStore } from '../store/habitStore';
import { useTagStore } from '../store/tagStore';
import { useSubtaskStore } from '../store/subtaskStore';
import { useCompletionStore } from '../store/completionStore';
import { useNotesStore } from '../store/notesStore';
import { localDateKey } from './utils';
import { useRecurrenceStore } from '../store/recurrenceStore';
import { useQuadrantStore } from '../store/quadrantStore';
import { useFocusStore } from '../store/focusStore';
import { useTimerStore } from '../store/timerStore';
import { useSoundscapeStore } from '../store/soundscapeStore';
import { useMusicLibraryStore } from '../store/musicLibraryStore';

function buildPayload() {
  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    todos: useTodoStore.getState().todos,
    habits: useHabitStore.getState().habits,
    tags: useTagStore.getState().tags,
    todoTags: useTagStore.getState().todoTags,
    subtasks: useSubtaskStore.getState().subtasks,
    completionTimes: useCompletionStore.getState().completionTimes,
    notes: { scratchpad: useNotesStore.getState().scratchpad, todoNotes: useNotesStore.getState().todoNotes },
    recurrence: useRecurrenceStore.getState().rules,
    quadrant: useQuadrantStore.getState().overrides,
    focusSessions: useFocusStore.getState().sessionLog,
    timers: useTimerStore.getState().timers,
    soundscape: {
      volumes: useSoundscapeStore.getState().volumes,
      masterVolume: useSoundscapeStore.getState().masterVolume,
    },
    musicLibrary: {
      tracks: useMusicLibraryStore.getState().tracks,
      categories: useMusicLibraryStore.getState().categories,
      volumes: useMusicLibraryStore.getState().volumes,
      masterVolume: useMusicLibraryStore.getState().masterVolume,
    },
  };
}

/** Upload backup data via WebDAV PUT */
export async function uploadBackupWebDAV(
  baseUrl: string,
  username: string,
  password: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const payload = buildPayload();
    const json = JSON.stringify(payload, null, 2);
    const today = localDateKey();
    const filename = `todoapp-backup-${today}.json`;

    const url = baseUrl.replace(/\/+$/, '') + '/' + encodeURIComponent(filename);

    const cred = btoa(`${username}:${password}`);
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${cred}`,
      },
      body: json,
    });

    if (res.ok) return { success: true };
    return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
  } catch (e: any) {
    return { success: false, error: e?.message ?? String(e) };
  }
}

/** Test WebDAV connection by PROPFIND on the root */
export async function testWebDAVConnection(
  baseUrl: string,
  username: string,
  password: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const url = baseUrl.replace(/\/+$/, '') + '/';
    const cred = btoa(`${username}:${password}`);
    const res = await fetch(url, {
      method: 'PROPFIND',
      headers: {
        Authorization: `Basic ${cred}`,
        Depth: '0',
      },
    });
    if (res.ok || res.status === 207) return { success: true };
    return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
  } catch (e: any) {
    return { success: false, error: e?.message ?? String(e) };
  }
}
