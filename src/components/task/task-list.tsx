'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { TaskDTO, TaskGroup } from '@/server/tasks/queries';
import type { Priority } from '@/lib/constants';
import { addDays, relativeDayLabel, today, weekdayName, formatShortDate } from '@/lib/dates';
import { Button, IconButton } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { TaskRow } from './task-row';
import { TaskDetail } from './task-detail';
import { OverdueReschedule } from './overdue-reschedule';
import { Composer } from './composer';
import type { Collaborator } from '@/server/access';
import {
  assignTaskAction,
  bulkCompleteAction,
  bulkDeleteAction,
  bulkMoveAction,
  bulkPriorityAction,
  bulkScheduleAction,
  bulkUndoCompleteAction,
  deleteTaskAction,
  reorderTaskAction,
  scheduleTaskAction,
  setPriorityAction,
  toggleTaskAction,
  undoRepeatAction,
  updateTaskAction,
  type QuickAddContext,
} from '@/server/tasks/actions';
import { Dialog, DialogContent, DialogFooter, Popover, PopoverTrigger, PopoverContent, PopoverClose } from '@/components/ui/overlays';
import { BulkBar, bulkDeleteCopy } from './bulk-bar';
import { useIsPhone } from '@/components/ui/use-is-phone';
import { registerComposer } from './compose-bus';
import type { WhenSelection } from './when-menu';
import { todayTaskGroups } from '@/lib/today-tasks';
import { useTaskNow } from './task-clock';
import { updateNavigation, useNavigationParam, useNavigationTask } from '@/components/nav/navigation-state';

/** How long the completion animation runs before the row is actually removed
 *  and the write is sent. Matches .strike-line + .row-collapse in globals.css. */
const COMPLETE_ANIMATION_MS = 440;

export interface TaskListProps {
  groups: TaskGroup[];
  context: QuickAddContext;
  projects: { id: string; name: string; color: string }[];
  labels: { id: string; name: string; color: string }[];
  hideProject?: boolean;
  /** Group titles are ISO days in the upcoming view and want a date heading. */
  dayHeadings?: boolean;
  empty: { title: string; body: string };
  reorderable?: boolean;
  /** The Logbook is a record, not a place to add work. */
  showComposer?: boolean;
  /** Saved-filter screens already provide their own search and filter controls. */
  showTools?: boolean;
  /** Off in the Logbook: most of the bar's verbs — complete, reschedule,
   *  prioritise — mean nothing to a task that is already done. */
  selectable?: boolean;
  /** Everyone in this view's project. Only a project view has one, and only a
   *  shared one has more than a single name in it. */
  collaborators?: Collaborator[];
  /** Rendered under the last group — the Logbook's "load more" lives here. */
  footer?: React.ReactNode;
}

export function TaskList({
  groups,
  context,
  projects,
  labels,
  hideProject = false,
  dayHeadings = false,
  empty,
  reorderable = true,
  showComposer = true,
  showTools = true,
  selectable = true,
  collaborators,
  footer,
}: TaskListProps) {
  const [completing, setCompleting] = useState<Set<string>>(new Set());
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  /** Where a shift-range measures from — the last row touched, not the cursor. */
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [openTaskId, setOpenTaskId] = useNavigationParam('task');
  const [composerOpen, setComposerOpen] = useState(false);
  const [searchParam] = useNavigationParam('listSearch');
  const search = searchParam ?? '';
  const [priorityParam, setPriorityParam] = useNavigationParam('listPriority');
  const priorityFilter = priorityParam && /^[1-4]$/.test(priorityParam) ? priorityParam : 'all';
  const [sortParam, setSortParam] = useNavigationParam('listSort');
  const sort = sortParam && ['priority', 'date', 'title'].includes(sortParam) ? sortParam : 'manual';
  const setPriorityFilter = (value: string) => setPriorityParam(value === 'all' ? null : value);
  const setSort = (value: string) => setSortParam(value === 'manual' ? null : value);
  // One search session is one history step, rather than one per letter.
  const searchSession = useRef(false);
  const setSearch = (value: string) => {
    updateNavigation({ listSearch: value || null }, searchSession.current && value !== '');
    searchSession.current = value !== '';
  };
  useEffect(() => {
    const reset = () => { searchSession.current = false; };
    window.addEventListener('popstate', reset);
    return () => window.removeEventListener('popstate', reset);
  }, []);
  const [controlsHost, setControlsHost] = useState<Element | null>(null);
  const [displayOpen, setDisplayOpen] = useState(false);
  const displaySummary = [
    search && `חיפוש: ${search}`,
    priorityFilter !== 'all' && `עדיפות: ${{ '1': 'דחוף', '2': 'חשוב', '3': 'רגיל', '4': 'ללא עדיפות' }[priorityFilter]}`,
    sort !== 'manual' && `מיון: ${{ priority: 'עדיפות', date: 'תאריך', title: 'שם' }[sort]}`,
  ].filter(Boolean).join(' · ');
  /** The row just added, while it is still tinted. */
  const [landedId, setLandedId] = useState<string | null>(null);
  /** A task saved but not yet returned by the server. */
  const pendingAdd = useRef<{ id: string; landedIn?: string } | null>(null);
  const [, startTransition] = useTransition();
  const isPhone = useIsPhone();
  const { toast } = useToast();
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const now = useTaskNow();
  const currentGroups = useMemo<TaskGroup[]>(() => context.view === 'today'
    ? todayTaskGroups(groups.flatMap(group => group.tasks), now) : groups, [groups, context.view, now]);

  // One task list owns the view header's display control. Keep its state beside
  // the list, while placing the control in the same row as the page title.
  useEffect(() => {
    if (showTools && showComposer) setControlsHost(document.querySelector('[data-list-controls-host]'));
  }, [showTools, showComposer]);

  useEffect(() => {
    const set = timers.current;
    return () => {
      set.forEach(clearTimeout);
      set.clear();
    };
  }, []);

  // The phone's add button lives in the tab bar, outside this tree.
  useEffect(() => {
    if (!showComposer) return;
    return registerComposer(() => setComposerOpen(true));
  }, [showComposer]);

  // Arriving from the tab bar on a route that had no list to ask.
  useEffect(() => {
    if (!showComposer) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('compose') !== '1') return;
    setComposerOpen(true);
    // Drop the parameter so a reload or a back-navigation does not reopen it.
    url.searchParams.delete('compose');
    window.history.replaceState(null, '', url.pathname + url.search);
  }, [showComposer]);

  // Server data is the source of truth; `removed` only bridges the gap between
  // the animation finishing and revalidation arriving.
  const visibleGroups = useMemo(
    () =>
      currentGroups.map((group) => ({
        ...group,
        tasks: group.tasks.filter((t) => !removed.has(t.id) && (priorityFilter === 'all' || t.priority === Number(priorityFilter)) && (!search || `${t.title} ${t.notes ?? ''}`.toLowerCase().includes(search.toLowerCase()))).sort((a, b) => sort === 'priority' ? a.priority - b.priority : sort === 'title' ? a.title.localeCompare(b.title, 'he') : sort === 'date' ? (a.scheduledFor?.getTime() ?? Infinity) - (b.scheduledFor?.getTime() ?? Infinity) : 0),
      })),
    [currentGroups, removed, search, priorityFilter, sort],
  );

  const vocabulary = useMemo(
    () => ({ projects: projects.map((p) => p.name), labels: labels.map((l) => l.name) }),
    [projects, labels],
  );

  const flat = useMemo(() => visibleGroups.flatMap((g) => g.tasks), [visibleGroups]);
  const isEmpty = flat.length === 0;
  const openTask = useNavigationTask(openTaskId, groups.flatMap((group) => group.tasks).find((t) => t.id === openTaskId) ?? null, groups);

  /* Stepping through the list from inside the editor. The list is the only
     thing that knows the order, so it hands the editor a step function rather
     than the editor reaching for the data. */
  const openIndex = openTaskId ? flat.findIndex((t) => t.id === openTaskId) : -1;
  const step = useCallback(
    (direction: -1 | 1) => {
      if (openIndex < 0) return;
      const next = flat[openIndex + direction];
      if (next) setOpenTaskId(next.id);
    },
    [flat, openIndex, setOpenTaskId],
  );

  // Drop ids that the server has since removed, so the sets cannot grow
  // unbounded across a long session.
  useEffect(() => {
    const live = new Set(groups.flatMap((g) => g.tasks.map((t) => t.id)));
    setRemoved((prev) => {
      const next = new Set([...prev].filter((id) => live.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [groups]);

  /* ------------------------------------------------------------ landing */

  /* A new task used to be announced by a toast naming the view it went to,
     because it might have gone anywhere — a task added from Today but dated
     next week is not in the list you are looking at. When it *is*, the row
     saying so beats a label saying so: it appears where it will live, tinted,
     and settles. The toast is what happens when it went somewhere else.

     Which of the two is not knowable at save time, only once the server sends
     the list back, so the add is held here until then. */
  const handleAdded = useCallback(
    (id: string, landedIn?: string) => {
      pendingAdd.current = { id, landedIn };
      const timer = setTimeout(() => {
        // Still waiting: the row is not in this view, so say where it is.
        if (pendingAdd.current?.id !== id) return;
        pendingAdd.current = null;
        toast({ message: landedIn ? `נוספה ל${landedIn}` : 'נוספה משימה' });
      }, 1200);
      timers.current.add(timer);
    },
    [toast],
  );

  useEffect(() => {
    const pending = pendingAdd.current;
    if (!pending) return;
    if (!groups.some((group) => group.tasks.some((task) => task.id === pending.id))) return;

    pendingAdd.current = null;
    setLandedId(pending.id);
    // New tasks are ordered to the top of their group, which can still be below
    // the fold in a long day.
    requestAnimationFrame(() =>
      document
        .querySelector(`[data-task-id="${pending.id}"]`)
        ?.scrollIntoView({ block: 'nearest' }),
    );

    const timer = setTimeout(
      () => setLandedId((current) => (current === pending.id ? null : current)),
      1300,
    );
    timers.current.add(timer);
  }, [groups]);

  /* ---------------------------------------------------------- selection */

  // A selected row that the server no longer returns must leave the selection
  // too, or a bulk action would act on ids that are not on screen.
  useEffect(() => {
    const live = new Set(groups.flatMap((g) => g.tasks.map((t) => t.id)));
    setCheckedIds((prev) => {
      const next = new Set([...prev].filter((id) => live.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [groups]);

  const clearSelection = useCallback(() => {
    setCheckedIds(new Set());
    setAnchorId(null);
  }, []);

  const handleSelect = useCallback(
    (task: TaskDTO, mode: 'toggle' | 'range') => {
      if (!selectable) return;
      const ids = flat.map((t) => t.id);

      if (mode === 'range' && anchorId) {
        const from = ids.indexOf(anchorId);
        const to = ids.indexOf(task.id);
        if (from >= 0 && to >= 0) {
          // The range adds; it never subtracts. Shift-clicking to widen a
          // selection must not silently drop what is already in it.
          const span = ids.slice(Math.min(from, to), Math.max(from, to) + 1);
          setCheckedIds((prev) => new Set([...prev, ...span]));
          setSelectedId(task.id);
          return;
        }
      }

      setCheckedIds((prev) => {
        const next = new Set(prev);
        if (next.has(task.id)) next.delete(task.id);
        else next.add(task.id);
        return next;
      });
      setAnchorId(task.id);
      setSelectedId(task.id);
    },
    [flat, anchorId, selectable],
  );

  const run = useCallback(
    (fn: () => Promise<{ ok: boolean; error?: string }>) =>
      startTransition(async () => {
        const result = await fn();
        if (!result.ok) toast({ message: result.error ?? 'הפעולה נכשלה', tone: 'error' });
      }),
    [toast],
  );

  const handleToggle = useCallback(
    (task: TaskDTO, done: boolean) => {
      if (!done) {
        run(() => toggleTaskAction(task.id, false));
        return;
      }

      // Play the strike, then remove the row and write — the animation is the
      // acknowledgement, so it must not be cut short by revalidation.
      setCompleting((prev) => new Set(prev).add(task.id));
      const timer = setTimeout(() => {
        setCompleting((prev) => {
          const next = new Set(prev);
          next.delete(task.id);
          return next;
        });
        setRemoved((prev) => new Set(prev).add(task.id));

        const restore = () =>
          setRemoved((prev) => {
            const next = new Set(prev);
            next.delete(task.id);
            return next;
          });

        startTransition(async () => {
          const result = await toggleTaskAction(task.id, true);
          if (!result.ok) {
            restore();
            toast({ message: result.error ?? 'הפעולה נכשלה', tone: 'error' });
            return;
          }

          // A repeating task did not finish — it moved on. Say where to, and
          // make undo roll back both the move and the logged copy.
          const repeat = result.repeat;
          toast({
            message: repeat ? `הושלם — חוזר ב${repeat.nextLabel}` : `הושלם: ${task.title}`,
            action: {
              label: 'ביטול',
              onClick: () => {
                restore();
                run(() =>
                  repeat
                    ? undoRepeatAction(task.id, repeat.snapshotId, repeat.previousDate)
                    : toggleTaskAction(task.id, false),
                );
              },
            },
          });
        });
      }, COMPLETE_ANIMATION_MS);
      timers.current.add(timer);
    },
    [run, toast],
  );

  const handleDelete = useCallback(
    (task: TaskDTO) => {
      setRemoved((prev) => new Set(prev).add(task.id));
      if (openTaskId === task.id) setOpenTaskId(null);
      run(() => deleteTaskAction(task.id));
      toast({ message: `נמחק: ${task.title}` });
    },
    [run, toast, openTaskId, setOpenTaskId],
  );

  const handlePriority = useCallback(
    (task: TaskDTO, priority: Priority) => run(() => setPriorityAction(task.id, priority)),
    [run],
  );

  const handleMove = useCallback(
    (task: TaskDTO, projectId: string | null) => {
      run(() => updateTaskAction({ id: task.id, projectId }));
      const target = projectId ? projects.find((p) => p.id === projectId)?.name : 'תיבה נכנסת';
      if (target) toast({ message: `הועבר ל${target}` });
    },
    [run, projects, toast],
  );

  const handleAssign = useCallback(
    (task: TaskDTO, assigneeId: string | null) => {
      run(() => assignTaskAction(task.id, assigneeId));
      const who = assigneeId
        ? collaborators?.find((c) => c.id === assigneeId)?.name
        : null;
      toast({ message: who ? `הוקצה ל${who}` : 'המשימה פנויה' });
    },
    [run, collaborators, toast],
  );

  const handleSchedule = useCallback(
    (task: TaskDTO, when: WhenSelection) =>
      run(() => scheduleTaskAction(task.id, { bucket: when.bucket as never, date: when.date, preset: when.preset })),
    [run],
  );

  /** Nudge a task's schedule by whole days. */
  const shiftSchedule = useCallback(
    (task: TaskDTO, days: number) => {
      const from = task.scheduledFor ?? today();
      const next = addDays(from, days);
      run(() =>
        scheduleTaskAction(task.id, {
          bucket: 'SCHEDULED',
          date: next.toISOString().slice(0, 10),
          time: task.scheduledTime,
        }),
      );
    },
    [run],
  );

  /* --------------------------------------------------------------- bulk */

  /** Every bulk action clears the selection and reports what the *server*
   *  changed, then hides the affected rows until revalidation catches up. */
  const runBulk = useCallback(
    (
      fn: (ids: string[]) => Promise<{ ok: boolean; error?: string; count: number }>,
      message: (count: number) => string,
      { hide = false }: { hide?: boolean } = {},
    ) => {
      const ids = [...checkedIds];
      if (!ids.length) return;
      clearSelection();
      if (hide) setRemoved((prev) => new Set([...prev, ...ids]));

      startTransition(async () => {
        const result = await fn(ids);
        if (!result.ok) {
          if (hide) {
            setRemoved((prev) => {
              const next = new Set(prev);
              ids.forEach((id) => next.delete(id));
              return next;
            });
          }
          toast({ message: result.error ?? 'הפעולה נכשלה', tone: 'error' });
          return;
        }
        toast({ message: message(result.count) });
      });
    },
    [checkedIds, clearSelection, toast],
  );

  const handleBulkComplete = useCallback(() => {
    const ids = [...checkedIds];
    if (!ids.length) return;
    clearSelection();
    setRemoved((prev) => new Set([...prev, ...ids]));

    const restore = () =>
      setRemoved((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });

    startTransition(async () => {
      const result = await bulkCompleteAction(ids);
      if (!result.ok) {
        restore();
        toast({ message: result.error ?? 'הפעולה נכשלה', tone: 'error' });
        return;
      }

      // Repeating tasks moved on rather than finished, and the count says so —
      // "12 completed" would be wrong if four of them are back next Tuesday.
      const moved = result.undo.repeats.length;
      toast({
        message: moved
          ? `${result.count} הושלמו · ${moved} חוזרות בהמשך`
          : `${result.count} משימות הושלמו`,
        action: {
          label: 'ביטול',
          onClick: () => {
            restore();
            run(() => bulkUndoCompleteAction(result.undo));
          },
        },
      });
    });
  }, [checkedIds, clearSelection, run, toast]);

  const handleBulkSchedule = useCallback(
    (when: WhenSelection) =>
      runBulk(
        (ids) => bulkScheduleAction(ids, { bucket: when.bucket as never, date: when.date, preset: when.preset }),
        (count) => `${count} משימות תוזמנו מחדש`,
      ),
    [runBulk],
  );

  const handleBulkPriority = useCallback(
    (priority: Priority) =>
      runBulk(
        (ids) => bulkPriorityAction(ids, priority),
        (count) => `העדיפות עודכנה ל־${count} משימות`,
      ),
    [runBulk],
  );

  const handleBulkMove = useCallback(
    (projectId: string | null) => {
      const target = projectId ? projects.find((p) => p.id === projectId)?.name : 'תיבה נכנסת';
      runBulk(
        (ids) => bulkMoveAction(ids, projectId),
        (count) => `${count} משימות הועברו ל${target}`,
      );
    },
    [runBulk, projects],
  );

  const handleBulkDelete = useCallback(() => {
    setConfirmDelete(false);
    runBulk(bulkDeleteAction, (count) => `${count} משימות נמחקו`, { hide: true });
  }, [runBulk]);

  /* ---------------------------------------------------------- keyboard */

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (typing) return;

      // Select-all is the one shortcut that wants the modifier, so it is
      // handled before the modifier guard below.
      if ((event.metaKey || event.ctrlKey) && (event.key === 'a' || event.key === 'A')) {
        if (!flat.length || !selectable) return;
        event.preventDefault();
        setCheckedIds(new Set(flat.map((t) => t.id)));
        setAnchorId(flat[0].id);
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const index = selectedId ? flat.findIndex((t) => t.id === selectedId) : -1;
      const current = index >= 0 ? flat[index] : null;

      switch (event.key) {
        case 'n':
        case 'N':
          event.preventDefault();
          setComposerOpen(true);
          break;
        case 'ArrowDown':
        case 'j':
          if (!flat.length) return;
          event.preventDefault();
          setSelectedId(flat[Math.min(index + 1, flat.length - 1)]?.id ?? flat[0].id);
          break;
        case 'ArrowUp':
        case 'k':
          if (!flat.length) return;
          event.preventDefault();
          setSelectedId(flat[Math.max(index - 1, 0)]?.id ?? flat[0].id);
          break;
        case 'ArrowLeft':
        case 'ArrowRight': {
          if (!current) return;
          event.preventDefault();
          // Horizontal arrows mean "earlier / later", and forward-in-time
          // follows the reading direction: left is forward in Hebrew.
          const rtl = document.documentElement.dir !== 'ltr';
          const forward = rtl ? event.key === 'ArrowLeft' : event.key === 'ArrowRight';
          shiftSchedule(current, forward ? 1 : -1);
          break;
        }
        case ' ':
          if (!current) return;
          event.preventDefault();
          handleToggle(current, current.status === 'TODO');
          break;
        case 'Enter':
          if (!current) return;
          event.preventDefault();
          setOpenTaskId(current.id);
          break;
        case 'Backspace':
        case 'Delete':
          if (!current) return;
          event.preventDefault();
          handleDelete(current);
          break;
        case 'x':
        case 'X':
          if (!current) return;
          event.preventDefault();
          handleSelect(current, event.shiftKey ? 'range' : 'toggle');
          break;
        case 'Escape':
          // A selection is the more recent, more surprising state to be in, so
          // Escape drops that first and leaves the cursor where it was.
          if (checkedIds.size) {
            clearSelection();
            return;
          }
          setSelectedId(null);
          setComposerOpen(false);
          break;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    flat,
    selectedId,
    checkedIds,
    handleToggle,
    handleDelete,
    handleSelect,
    clearSelection,
    shiftSchedule,
    selectable,
  ]);

  /* --------------------------------------------------------------- dnd */

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const ids = flat.map((t) => t.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;

    const reordered = [...flat];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    const at = reordered.findIndex((t) => t.id === moved.id);

    // Send neighbour ids rather than an index: the server recomputes the key
    // from whatever those rows hold now, so a stale client cannot corrupt order.
    run(() =>
      reorderTaskAction(
        moved.id,
        reordered[at - 1]?.id ?? null,
        reordered[at + 1]?.id ?? null,
      ),
    );
  }

  return (
    <div className="pb-24" data-testid="task-list">
      {controlsHost && createPortal(<Popover open={displayOpen} onOpenChange={setDisplayOpen}>
        <PopoverTrigger asChild><IconButton label="תצוגת הרשימה" className={priorityFilter !== 'all' || search || sort !== 'manual' ? 'text-accent' : undefined}><SlidersHorizontal className="size-[1.125rem]" aria-hidden /></IconButton></PopoverTrigger>
        <PopoverContent align="end" className="list-display-panel w-[min(20rem,calc(100vw-2rem))]">
          <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">תצוגת הרשימה</h2><PopoverClose asChild><IconButton label="סגירת אפשרויות התצוגה"><X className="size-4" aria-hidden /></IconButton></PopoverClose></div>
          <label className="task-search"><Search className="size-4 shrink-0" aria-hidden /><input dir="auto" value={search} onFocus={() => { searchSession.current = false; }} onBlur={() => { searchSession.current = false; }} onChange={(event) => setSearch(event.target.value)} aria-label="חיפוש ברשימה" placeholder="חיפוש ברשימה" />{search && <IconButton label="ניקוי חיפוש" onClick={() => setSearch('')}><X className="size-3.5" aria-hidden /></IconButton>}</label>
          <label className="list-display-field">סינון לפי עדיפות<select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option value="all">כל העדיפויות</option><option value="1">דחוף</option><option value="2">חשוב</option><option value="3">רגיל</option><option value="4">ללא עדיפות</option></select></label>
          <label className="list-display-field">מיון משימות<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="manual">סדר ידני</option><option value="priority">לפי עדיפות</option><option value="date">לפי תאריך</option><option value="title">לפי שם</option></select></label>
          <PopoverClose asChild><Button size="sm" className="mt-4 w-full">הצגת המשימות</Button></PopoverClose>
        </PopoverContent>
      </Popover>, controlsHost)}
      {displaySummary && <div className="mb-3 flex items-start justify-between gap-2 text-sm text-muted"><button type="button" className="min-w-0 flex-1 break-words py-2 text-start" onClick={() => setDisplayOpen(true)}>{displaySummary}</button><Button variant="ghost" size="sm" className="shrink-0" onClick={() => { searchSession.current = false; updateNavigation({ listSearch: null, listPriority: null, listSort: null }); }}>איפוס תצוגה</Button></div>}
      {showComposer &&
        (composerOpen ? (
          <ComposerSlot phone={isPhone} onClose={() => setComposerOpen(false)}>
            <Composer
              context={context}
              vocabulary={vocabulary}
              projects={projects}
              variant={isPhone ? 'sheet' : 'inline'}
              onClose={() => setComposerOpen(false)}
              onAdded={handleAdded}
            />
          </ComposerSlot>
        ) : (
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            // Hugs its content rather than spanning the column. Full width, it
            // was a 640px band with three small things at one end and a hover
            // state that lit up the whole empty stretch; the shortcut hint sat
            // 478px from the label it belongs to.
            //
            // Hidden on the phone: the tab bar owns capture there, and a second
            // add button would spend the fold repeating it.
            className="mb-3 hidden items-center gap-2 rounded-md px-0 py-2 text-start text-muted transition-colors hover:text-accent md:inline-flex"
          >
            <Plus className="size-5 shrink-0" aria-hidden />
            <span className="text-base">משימה חדשה</span>
            <kbd className="num rounded border border-line px-1.5 text-xs text-muted">N</kbd>
          </button>
        ))}

      {isEmpty ? (
        <EmptyState
          {...empty}
          onAdd={() => setComposerOpen(true)}
          // Not while the composer is already open: two buttons offering the
          // same thing, one of them under a field waiting for the answer.
          showAdd={showComposer && !composerOpen}
        />
      ) : (
        <DndContext
          // Stable id: dnd-kit's generated aria-describedby is otherwise
          // numbered from a module counter that differs between the server and
          // the client, which breaks hydration.
          id="seder-tasks"
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={flat.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            {visibleGroups.map((group) =>
              group.tasks.length === 0 && group.key === 'loose' ? null : (
                <section key={group.key} data-task-group={group.key} className="task-group mb-5">
                  {group.title && (
                    <GroupHeading
                      title={group.title}
                      subtitle={group.subtitle}
                      isDay={dayHeadings}
                      count={group.tasks.length}
                      action={group.key === 'overdue' && group.tasks.length > 0 ? <OverdueReschedule tasks={group.tasks} /> : undefined}
                    />
                  )}
                  {group.tasks.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-muted">אין כאן משימות.</p>
                  ) : (
                    <ul>
                      {group.tasks.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          completing={completing.has(task.id)}
                          landed={landedId === task.id}
                          selected={selectedId === task.id}
                          selecting={checkedIds.size > 0}
                          checked={checkedIds.has(task.id)}
                          onSelect={handleSelect}
                          hideProject={hideProject}
                          // Dragging and selecting compete for the same press.
                          draggable={reorderable && checkedIds.size === 0 && sort === 'manual' && !search && priorityFilter === 'all'}
                          onToggle={handleToggle}
                          onOpen={(t) => {
                            setSelectedId(t.id);
                            setOpenTaskId(t.id);
                          }}
                          onDelete={handleDelete}
                          onPriority={handlePriority}
                          onSchedule={handleSchedule}
                          onMove={handleMove}
                          projects={projects}
                          collaborators={collaborators}
                          onAssign={collaborators ? handleAssign : undefined}
                        />
                      ))}
                    </ul>
                  )}
                </section>
              ),
            )}
          </SortableContext>
        </DndContext>
      )}

      {footer}

      <TaskDetail
        task={openTask}
        openId={openTaskId}
        projects={projects}
        labels={labels}
        collaborators={collaborators}
        onStep={step}
        canStep={{ prev: openIndex > 0, next: openIndex >= 0 && openIndex < flat.length - 1 }}
        onClose={() => setOpenTaskId(null)}
        onDelete={handleDelete}
      />

      {checkedIds.size > 0 && (
        <BulkBar
          count={checkedIds.size}
          projects={projects}
          onComplete={handleBulkComplete}
          onSchedule={handleBulkSchedule}
          onPriority={handleBulkPriority}
          onMove={handleBulkMove}
          onDelete={() => setConfirmDelete(true)}
          onClear={clearSelection}
        />
      )}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent {...dialogCopy(checkedIds.size)}>
          <DialogFooter>
            <Button variant="danger" onClick={handleBulkDelete}>
              מחיקה
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Where the composer sits.
 *
 * On a desktop it belongs inline at the head of the list, in the place the new
 * task will appear. On a phone that is the wrong end of the screen twice over:
 * the thumb that opened it is at the bottom, and so is the keyboard about to
 * cover half the view. There it becomes a sheet on the same edge as both.
 */
function ComposerSlot({
  phone,
  onClose,
  children,
}: {
  phone: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!phone) return <div className="mb-4 animate-fade-up">{children}</div>;

  /* Portalled to the body, not merely `fixed`.
     `main` carries `view-transition-name`, which creates a stacking context —
     so a `z-50` sheet inside it is only z-50 *within main*, and the tab bar
     (a sibling of main, z-30) paints over the sheet's submit button. Escaping
     to the body is what the task editor and the day panel already do, for the
     same reason. Safe to reach for `document` here: this branch only renders
     once `useIsPhone` has resolved, which is after hydration. */
  return createPortal(
    <>
      <button
        type="button"
        aria-label="סגירת המשימה החדשה"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-scrim-soft md:hidden"
      />
      {/* No padding: the sheet goes flush to the three edges and carries the
          safe-area inset itself, so its own background covers the home
          indicator rather than leaving a strip of the dimmed page under it. */}
      <div className="animate-fade-up fixed inset-be-0 inset-s-0 inset-e-0 z-50 md:hidden">
        {children}
      </div>
    </>,
    document.body,
  );
}

function dialogCopy(count: number) {
  const { title, body } = bulkDeleteCopy(count);
  return { title, description: body };
}

function GroupHeading({
  title,
  subtitle,
  isDay,
  count,
  action,
}: {
  title: string;
  subtitle?: string | null;
  isDay: boolean;
  count: number;
  action?: React.ReactNode;
}) {
  let primary = title;
  let secondary: string | null = subtitle ?? null;

  if (isDay) {
    const date = new Date(`${title}T00:00:00.000Z`);
    const relative = relativeDayLabel(date, today());
    const weekday = weekdayName(date);
    const short = formatShortDate(date);

    // Beyond a week `relativeDayLabel` already returns the numeric date, and
    // using it as the heading would print the date twice.
    primary = relative === short ? weekday : relative;
    secondary = primary === weekday ? short : `${weekday} · ${short}`;
  }

  return (
    <div className="mb-1 flex items-baseline gap-2.5 border-be border-line px-2 pb-1.5">
      <h2 className="text-base font-semibold text-ink">{primary}</h2>
      {secondary && <span className="num text-xs text-muted">{secondary}</span>}
      <span className={cn('num text-xs text-muted', !action && 'ms-auto')}>{count}</span>
      {action && <div className="ms-auto shrink-0">{action}</div>}
    </div>
  );
}

function EmptyState({
  title,
  body,
  onAdd,
  showAdd = true,
}: {
  title: string;
  body: string;
  onAdd: () => void;
  showAdd?: boolean;
}) {
  return (
    // No box. An empty view is the page at that moment, not a missing widget,
    // and a dashed rectangle around it says the opposite — it reads as a slot
    // waiting to be filled by something that failed to load.
    //
    // It also sits on the page's own axis. The header, the group rules and
    // every task start at the inline edge; a centred block floats off that
    // spine and is the reason the screen looked unfinished rather than clear.
    <div className="py-2">
      {/* The same hairline that heads a group of tasks, so the empty view is
          built from the list's vocabulary rather than its own. */}
      <div className="border-be border-line" />
      <div className="max-w-sm py-10">
        <h2 className="display text-2xl leading-tight text-ink">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
        {showAdd && (
          <Button variant="secondary" size="sm" className="mt-6" onClick={onAdd}>
            הוספת משימה
          </Button>
        )}
      </div>
    </div>
  );
}
