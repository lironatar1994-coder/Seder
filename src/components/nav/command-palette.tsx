'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import {
  BookCheck,
  CalendarDays,
  CalendarRange,
  Check,
  Folder,
  Inbox,
  Layers,
  Moon,
  Sun,
  Tag,
} from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/cn';
import { VIEWS, swatchVar, type ViewSlug } from '@/lib/constants';
import { relativeDayLabel, today } from '@/lib/dates';
import { deleteTaskAction, searchTasksAction } from '@/server/tasks/actions';
import type { TaskDTO } from '@/server/tasks/queries';
import { TaskDetail } from '@/components/task/task-detail';
import { useToast } from '@/components/ui/toast';

const VIEW_ICONS: Record<ViewSlug, typeof Inbox> = {
  inbox: Inbox,
  today: Sun,
  upcoming: CalendarDays,
  anytime: Layers,
  someday: Moon,
  logbook: BookCheck,
};

interface Destination {
  key: string;
  label: string;
  hint?: string;
  href: string;
  icon: typeof Inbox;
  color?: string;
}

/** Ctrl/Cmd+K — find a task by name, or jump to any view, project or label.
 *  Ctrl+1…6 go straight to the six standing views. */
export function CommandPalette({
  projects,
  labels,
}: {
  projects: { id: string; name: string; color: string }[];
  labels: { id: string; name: string; color: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TaskDTO[]>([]);
  const [searching, setSearching] = useState(false);
  const [openTask, setOpenTask] = useState<TaskDTO | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const search = () => setOpen(true);
    window.addEventListener('seder:search', search);
    function onKeyDown(event: KeyboardEvent) {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (mod && /^[1-6]$/.test(event.key)) {
        event.preventDefault();
        router.push(`/app/${VIEWS[Number(event.key) - 1].slug}`);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('seder:search', search); };
  }, [router]);

  // Reset on close, so the palette never reopens showing a stale search.
  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  // Debounced: typing a word should not fire one query per keystroke.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      const found = await searchTasksAction(term);
      // A slow earlier request must not overwrite a newer one's results.
      if (cancelled) return;
      setResults(found);
      setSearching(false);
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const destinations: Destination[] = useMemo(
    () => [
      ...VIEWS.map((view) => ({
        key: view.slug,
        label: view.label,
        hint: view.hint,
        href: `/app/${view.slug}`,
        icon: VIEW_ICONS[view.slug],
      })),
      {
        key: 'calendar',
        label: 'לוח שנה',
        hint: 'תצוגת חודש',
        href: '/app/calendar',
        icon: CalendarRange,
      },
      {
        key: 'calendar-week',
        label: 'לוח שנה — שבוע',
        hint: 'שבעה ימים',
        href: '/app/calendar?v=week',
        icon: CalendarRange,
      },
      ...projects.map((p) => ({
        key: `project-${p.id}`,
        label: p.name,
        href: `/app/project/${p.id}`,
        icon: Folder,
        color: swatchVar(p.color),
      })),
      ...labels.map((l) => ({
        key: `label-${l.id}`,
        label: l.name,
        href: `/app/label/${l.id}`,
        icon: Tag,
        color: swatchVar(l.color),
      })),
    ],
    [projects, labels],
  );

  // cmdk's own filtering is switched off: it would also filter the task
  // results, which the server already matched — including matches inside notes,
  // whose text does not appear in the item label at all.
  const term = query.trim().toLowerCase();
  const matchingDestinations = term
    ? destinations.filter((d) => d.label.toLowerCase().includes(term))
    : destinations;

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  const nothingFound =
    term.length > 0 && matchingDestinations.length === 0 && results.length === 0 && !searching;

  return (
    <>
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-70 bg-scrim" />
          <DialogPrimitive.Content className="fixed inset-bs-24 inset-s-0 inset-e-0 z-70 mx-auto h-fit w-[min(34rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-surface shadow-pop animate-pop-in">
            <DialogPrimitive.Title className="sr-only">חיפוש ומעבר</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              הקלידו כדי לחפש משימות או לעבור בין תצוגות
            </DialogPrimitive.Description>

            <Command loop shouldFilter={false} label="חיפוש ומעבר">
              <div className="border-be border-line px-4">
                <Command.Input
                  dir="auto"
                  value={query}
                  onValueChange={setQuery}
                  placeholder="חיפוש משימה, או מעבר לתצוגה…"
                  className="h-12 w-full bg-transparent text-base text-ink outline-none placeholder:text-muted"
                />
              </div>

              <Command.List
                data-testid="palette-list"
                className="scroll-quiet max-h-96 overflow-y-auto p-2"
              >
                {nothingFound && (
                  <div className="px-3 py-8 text-center text-sm text-muted">לא נמצא כלום.</div>
                )}

                {results.length > 0 && (
                  <Group heading="משימות">
                    {results.map((task) => (
                      <Item
                        key={task.id}
                        value={`task-${task.id}`}
                        onSelect={() => {
                          setOpen(false);
                          setOpenTask(task);
                        }}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            'grid size-4 shrink-0 place-items-center rounded border-2',
                            task.status !== 'TODO'
                              ? 'border-accent bg-accent'
                              : 'border-line-strong',
                          )}
                        >
                          {task.status !== 'TODO' && (
                            <Check
                              className="size-2.5 text-[var(--on-accent)]"
                              strokeWidth={4}
                              aria-hidden
                            />
                          )}
                        </span>
                        <span
                          dir="auto"
                          className={cn(
                            'min-w-0 flex-1 truncate',
                            task.status !== 'TODO' && 'text-muted line-through',
                          )}
                        >
                          {task.title}
                        </span>
                        <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                          {task.project && (
                            <span className="inline-flex items-center gap-1">
                              <span
                                aria-hidden
                                className="size-1.5 rounded-full"
                                style={{ backgroundColor: swatchVar(task.project.color) }}
                              />
                              {task.project.name}
                            </span>
                          )}
                          {task.scheduledFor && (
                            <span>{relativeDayLabel(task.scheduledFor, today())}</span>
                          )}
                        </span>
                      </Item>
                    ))}
                  </Group>
                )}

                {searching && results.length === 0 && (
                  <div className="px-3 py-6 text-center text-sm text-muted">מחפשים…</div>
                )}

                {matchingDestinations.length > 0 && (
                  <Group heading={term ? 'מעבר אל' : 'תצוגות'}>
                    {matchingDestinations.map((destination) => {
                      const Icon = destination.icon;
                      return (
                        <Item
                          key={destination.key}
                          value={destination.key}
                          onSelect={() => go(destination.href)}
                        >
                          <Icon
                            className="size-4 shrink-0 text-muted"
                            style={destination.color ? { color: destination.color } : undefined}
                            aria-hidden
                          />
                          <span className="flex-1">{destination.label}</span>
                          {destination.hint && (
                            <span className="text-xs text-muted">{destination.hint}</span>
                          )}
                        </Item>
                      );
                    })}
                  </Group>
                )}
              </Command.List>
            </Command>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Opened from a search result, so it lives here rather than inside
          whichever list happens to be on screen — the task may well not be in
          that list at all. */}
      <TaskDetail
        task={openTask}
        openId={openTask?.id ?? null}
        projects={projects}
        labels={labels}
        onClose={() => setOpenTask(null)}
        onDelete={(task) => {
          setOpenTask(null);
          startTransition(async () => {
            const result = await deleteTaskAction(task.id);
            if (result.ok) toast({ message: `נמחק: ${task.title}` });
            else toast({ message: result.error ?? 'המחיקה נכשלה', tone: 'error' });
          });
        }}
      />
    </>
  );
}

function Group({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <Command.Group
      heading={heading}
      className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:text-muted"
    >
      {children}
    </Command.Group>
  );
}

function Item({
  value,
  onSelect,
  children,
}: {
  value: string;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-ink data-[selected=true]:bg-surface-2"
    >
      {children}
    </Command.Item>
  );
}
