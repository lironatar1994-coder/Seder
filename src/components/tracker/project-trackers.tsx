'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Table2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { today } from '@/lib/dates';
import { dayKey, trackerDays } from '@/lib/tracker';
import type { TrackerDTO } from '@/lib/tracker-types';
import { useToast } from '@/components/ui/toast';
import {
  addTrackerRowAction,
  createTrackerAction,
  deleteTrackerAction,
  deleteTrackerRowAction,
  renameTrackerRowAction,
  setTrackerCheckAction,
  setTrackerNoteAction,
  updateTrackerAction,
} from '@/server/trackers/actions';
import { TrackerForm, type TrackerSettings } from './tracker-form';
import { TrackerTable, type ClientRow, type ClientTracker, type TrackerHandlers } from './tracker-table';
import { playTrackerCue, playTrackerMilestone } from './tracker-sound';

/** Opens the "new table" card from anywhere — the project menu, the toolbar. */
export const NEW_TRACKER_EVENT = 'seder:new-tracker';

const UNDO_MS = 6000;

let tempCounter = 0;
const tempId = (prefix: string) => `${prefix}-tmp-${Date.now()}-${tempCounter++}`;

function toClient(trackers: TrackerDTO[]): ClientTracker[] {
  return trackers.map((tracker) => ({ ...tracker, key: tracker.id, rows: tracker.rows.map((row) => ({ ...row, key: row.id })) }));
}

/**
 * Every habit table in a project, edited in place.
 *
 * The screen never waits for the server: a new table, row, V or note is on the
 * page the moment it is asked for, and the write follows. Rows and tables that
 * are still being created carry a temporary id; anything that needs the real
 * one waits on `realId`, so a V tapped on a row typed a heartbeat ago still
 * lands on the right row.
 */
export function ProjectTrackers({ projectId, initial }: { projectId: string; initial: TrackerDTO[] }) {
  const { toast } = useToast();
  const [trackers, setTrackers] = useState<ClientTracker[]>(() => toClient(initial));
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const [noteRequest, setNoteRequest] = useState<{ tracker: string; cell: string; n: number } | null>(null);
  const [celebrate, setCelebrate] = useState<{ tracker: string; kind: 'day' | 'row'; key: string; n: number } | null>(null);
  const ids = useRef(new Map<string, Promise<string | null>>());
  const pendingDeletes = useRef(new Map<string, () => void>());
  const area = useRef<HTMLDivElement>(null);
  const latest = useRef(trackers);
  latest.current = trackers;

  const realId = useCallback(async (id: string) => (ids.current.has(id) ? ids.current.get(id)! : id), []);

  useEffect(() => {
    const open = () => {
      setCreating(true);
      requestAnimationFrame(() => area.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    };
    window.addEventListener(NEW_TRACKER_EVENT, open);
    return () => window.removeEventListener(NEW_TRACKER_EVENT, open);
  }, []);

  // A deletion still inside its undo window is committed when the page goes.
  useEffect(() => {
    const flush = () => pendingDeletes.current.forEach((commit) => commit());
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  const patch = useCallback((key: string, change: (tracker: ClientTracker) => ClientTracker) => {
    setTrackers((current) => current.map((tracker) => (tracker.key === key ? change(tracker) : tracker)));
  }, []);

  const patchRow = useCallback(
    (trackerKey: string, rowKey: string, change: (row: ClientRow) => ClientRow) => {
      patch(trackerKey, (tracker) => ({ ...tracker, rows: tracker.rows.map((row) => (row.key === rowKey ? change(row) : row)) }));
    },
    [patch],
  );

  function fail(message?: string) {
    toast({ message: message ?? 'השינוי לא נשמר. אפשר לנסות שוב.', tone: 'error' });
  }

  /* ── Tables ── */

  function create(settings: TrackerSettings) {
    const key = tempId('tracker');
    const tracker: ClientTracker = { key, id: key, ...settings, rows: [] };
    setTrackers((current) => [...current, tracker]);
    setCreating(false);
    setFresh(key);
    playTrackerCue('create');
    toast({ message: `הטבלה ״${settings.name}״ נוצרה. עכשיו מוסיפים פריטים.`, tone: 'success', group: 'tracker' });
    const pending = createTrackerAction(projectId, settings).then((result) => {
      if (result.ok && result.id) {
        patch(key, (t) => ({ ...t, id: result.id! }));
        return result.id;
      }
      setTrackers((current) => current.filter((t) => t.key !== key));
      fail(result.error);
      return null;
    });
    ids.current.set(key, pending);
  }

  function handlersFor(tracker: ClientTracker): TrackerHandlers {
    return {
      update(settings) {
        patch(tracker.key, (t) => ({ ...t, ...settings }));
        toast({ message: 'הטבלה עודכנה', tone: 'success', group: 'tracker' });
        void realId(tracker.key).then((id) => (id ? updateTrackerAction(id, settings).then((r) => !r.ok && fail(r.error)) : null));
      },
      remove() {
        const index = latest.current.findIndex((t) => t.key === tracker.key);
        setTrackers((current) => current.filter((t) => t.key !== tracker.key));
        playTrackerCue('uncheck');
        const commit = () => {
          pendingDeletes.current.delete(tracker.key);
          void realId(tracker.key).then((id) => (id ? deleteTrackerAction(id) : null));
        };
        const timer = setTimeout(commit, UNDO_MS);
        pendingDeletes.current.set(tracker.key, () => {
          clearTimeout(timer);
          commit();
        });
        toast({
          message: `הטבלה ״${tracker.name}״ נמחקה`,
          group: 'tracker',
          duration: UNDO_MS,
          action: {
            label: 'ביטול',
            onClick: () => {
              clearTimeout(timer);
              pendingDeletes.current.delete(tracker.key);
              setTrackers((current) => {
                const next = [...current];
                next.splice(Math.min(index, next.length), 0, tracker);
                return next;
              });
            },
          },
        });
      },
      addRow(title) {
        const key = tempId('row');
        patch(tracker.key, (t) => ({ ...t, rows: [...t.rows, { key, id: key, title, checks: {} }] }));
        playTrackerCue('add');
        const pending = realId(tracker.key).then(async (trackerId) => {
          if (!trackerId) return null;
          const result = await addTrackerRowAction(trackerId, title);
          if (result.ok && result.id) {
            patchRow(tracker.key, key, (row) => ({ ...row, id: result.id! }));
            return result.id;
          }
          patch(tracker.key, (t) => ({ ...t, rows: t.rows.filter((row) => row.key !== key) }));
          fail(result.error);
          return null;
        });
        ids.current.set(key, pending);
      },
      renameRow(row, title) {
        patchRow(tracker.key, row.key, (r) => ({ ...r, title }));
        void realId(row.key).then((id) => (id ? renameTrackerRowAction(id, title).then((r) => !r.ok && fail(r.error)) : null));
      },
      deleteRow(row) {
        const current = latest.current.find((t) => t.key === tracker.key);
        const index = current?.rows.findIndex((r) => r.key === row.key) ?? 0;
        patch(tracker.key, (t) => ({ ...t, rows: t.rows.filter((r) => r.key !== row.key) }));
        playTrackerCue('uncheck');
        const commit = () => {
          pendingDeletes.current.delete(row.key);
          void realId(row.key).then((id) => (id ? deleteTrackerRowAction(id) : null));
        };
        const timer = setTimeout(commit, UNDO_MS);
        pendingDeletes.current.set(row.key, () => {
          clearTimeout(timer);
          commit();
        });
        toast({
          message: `״${row.title}״ הוסר מהטבלה`,
          group: 'tracker',
          duration: UNDO_MS,
          action: {
            label: 'ביטול',
            onClick: () => {
              clearTimeout(timer);
              pendingDeletes.current.delete(row.key);
              patch(tracker.key, (t) => {
                const rows = [...t.rows];
                rows.splice(Math.min(index, rows.length), 0, row);
                return { ...t, rows };
              });
            },
          },
        });
      },
      setCell(row, day, checked) {
        patchRow(tracker.key, row.key, (r) => {
          const checks = { ...r.checks };
          if (checked) checks[day] = checks[day] ?? '';
          else delete checks[day];
          return { ...r, checks };
        });
        if (checked) announceCheck(tracker, row, day);
        else {
          playTrackerCue('uncheck');
          toast({ message: 'הסימון הוסר', group: 'tracker-cell', duration: 2200 });
        }
        void realId(row.key).then((id) =>
          !id
            ? null
            : setTrackerCheckAction(id, day, checked).then((result) => {
              if (result.ok) return;
              patchRow(tracker.key, row.key, (r) => {
                const checks = { ...r.checks };
                if (checked) delete checks[day];
                else checks[day] = '';
                return { ...r, checks };
              });
              fail(result.error);
            }),
        );
      },
      saveNote(row, day, note) {
        patchRow(tracker.key, row.key, (r) => ({ ...r, checks: { ...r.checks, [day]: note.trim() } }));
        toast({ message: note.trim() ? 'ההערה נשמרה' : 'ההערה הוסרה', tone: 'success', group: 'tracker-cell', duration: 2200 });
        void realId(row.key).then((id) => (id ? setTrackerNoteAction(id, day, note).then((r) => !r.ok && fail(r.error)) : null));
      },
    };
  }

  /**
   * The V itself is the feedback; the toast offers the note. A row that
   * just filled its whole period, or a day where every row is now checked,
   * gets the bigger moment instead.
   */
  function announceCheck(tracker: ClientTracker, row: ClientRow, day: string) {
    const fresh = latest.current.find((t) => t.key === tracker.key) ?? tracker;
    const rowNow = fresh.rows.find((r) => r.key === row.key) ?? row;
    const checks = { ...rowNow.checks, [day]: rowNow.checks[day] ?? '' };
    const anchor = new Date(`${day}T00:00:00.000Z`);
    const periodKeys = trackerDays(fresh.period, anchor, fresh.weekdays).map(dayKey);
    const rowFull = periodKeys.every((key) => checks[key] !== undefined);
    const dayFull = fresh.rows.length > 1 && fresh.rows.every((r) => (r.key === row.key ? true : r.checks[day] !== undefined));
    const isToday = day === dayKey(today());
    const n = Date.now();

    if (rowFull) {
      playTrackerMilestone();
      setCelebrate({ tracker: tracker.key, kind: 'row', key: row.key, n });
      toast({ message: `״${row.title}״ — כל הימים בתקופה סומנו`, tone: 'success', group: 'tracker-cell', duration: 3500 });
      return;
    }
    if (dayFull) {
      playTrackerMilestone();
      setCelebrate({ tracker: tracker.key, kind: 'day', key: day, n });
      toast({ message: isToday ? `יום מלא ב״${tracker.name}״. כל הפריטים של היום סומנו.` : `כל הפריטים של היום הזה סומנו`, tone: 'success', group: 'tracker-cell', duration: 3500 });
      return;
    }
    playTrackerCue('check');
    toast({
      message: `סומן: ${row.title}`,
      group: 'tracker-cell',
      duration: 2600,
      action: { label: 'הוספת הערה', onClick: () => setNoteRequest({ tracker: tracker.key, cell: `${row.key}|${day}`, n }) },
    });
  }

  return (
    <div ref={area} className={cn('scroll-mt-24 space-y-5', (trackers.length > 0 || creating) && 'mb-8')}>
      {trackers.map((tracker) => (
        <TrackerTable
          key={tracker.key}
          tracker={tracker}
          fresh={fresh === tracker.key}
          handlers={handlersFor(tracker)}
          noteRequest={noteRequest?.tracker === tracker.key ? `${noteRequest.cell}#${noteRequest.n}` : null}
          celebrate={celebrate?.tracker === tracker.key ? celebrate : null}
        />
      ))}

      {creating ? (
        <div className="tracker-in rounded-2xl border border-accent/40 bg-surface p-4 shadow-pop ring-4 ring-accent/10 sm:p-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-bold text-accent">
            <Table2 className="size-4" aria-hidden />
            טבלת מעקב חדשה
          </p>
          <TrackerForm submitLabel="יצירת טבלה" onSubmit={create} onCancel={() => setCreating(false)} />
        </div>
      ) : (
        trackers.length > 0 && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong/70 py-3 text-sm font-semibold text-muted',
              'transition-colors hover:border-accent/60 hover:bg-accent-soft/40 hover:text-accent',
            )}
          >
            <Plus className="size-4" aria-hidden />
            טבלת מעקב נוספת
          </button>
        )
      )}
    </div>
  );
}
