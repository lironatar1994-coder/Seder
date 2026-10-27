'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pencil, Plus, Settings2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { today, WEEKDAY_SHORT } from '@/lib/dates';
import { monthName } from '@/lib/calendar';
import { hebrewDay, hebrewDayMonth } from '@/lib/hebrew-date';
import { dayKey, PERIOD_LABELS, periodLabel, shiftPeriod, trackerDays } from '@/lib/tracker';
import type { TrackerDTO, TrackerRowDTO } from '@/lib/tracker-types';
import { Menu, MenuContent, MenuItem, MenuTrigger, Popover, PopoverAnchor, PopoverContent } from '@/components/ui/overlays';
import { Button } from '@/components/ui/button';
import { TrackerForm, type TrackerSettings } from './tracker-form';

export type ClientRow = TrackerRowDTO & { key: string };
export type ClientTracker = Omit<TrackerDTO, 'rows'> & { key: string; rows: ClientRow[] };

export interface TrackerHandlers {
  setCell: (row: ClientRow, day: string, checked: boolean) => void;
  saveNote: (row: ClientRow, day: string, note: string) => void;
  addRow: (title: string) => void;
  renameRow: (row: ClientRow, title: string) => void;
  deleteRow: (row: ClientRow) => void;
  update: (settings: TrackerSettings) => void;
  remove: () => void;
}

/** A pending effect on one cell: the V's pop, ring and sparks. */
interface Flash {
  cell: string;
  n: number;
}

const WEEKDAY_FULL = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export function TrackerTable({
  tracker,
  fresh,
  handlers,
  noteRequest,
  celebrate,
}: {
  tracker: ClientTracker;
  fresh: boolean;
  handlers: TrackerHandlers;
  /** Set from outside (the toast's "add a note") to open one cell's note. */
  noteRequest: string | null;
  /** Bumped when a whole day or row is done, to replay the celebration. */
  celebrate: { kind: 'day' | 'row'; key: string; n: number } | null;
}) {
  const now = today();
  const todayKey = dayKey(now);
  const [anchor, setAnchor] = useState(now);
  const [editing, setEditing] = useState(false);
  const [noteCell, setNoteCell] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [focusCell, setFocusCell] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [stick, setStick] = useState(0);
  const addInput = useRef<HTMLInputElement>(null);

  const days = useMemo(() => trackerDays(tracker.period, anchor, tracker.weekdays), [tracker.period, tracker.weekdays, anchor]);
  const keys = useMemo(() => days.map(dayKey), [days]);
  const onCurrent = periodLabel(tracker.period, anchor) === periodLabel(tracker.period, now);
  const compact = tracker.period !== 'WEEK';

  // A new table is ready for its first row.
  useEffect(() => {
    if (fresh) addInput.current?.focus({ preventScroll: true });
  }, [fresh]);

  // Long tables open on today, not on the first of the month.
  useEffect(() => {
    const box = scroller.current;
    if (!box) return;
    const column = box.querySelector<HTMLElement>(`[data-day="${todayKey}"]`);
    if (!column) return;
    // Measured visually, so the sign convention of scrollLeft in a
    // right-to-left box never comes into it: move by however far today's
    // column sits from the middle of the space the sticky name column leaves.
    const stick = box.querySelector<HTMLElement>('[data-sticky-start]')?.offsetWidth ?? 0;
    const boxRect = box.getBoundingClientRect();
    const colRect = column.getBoundingClientRect();
    const middle = boxRect.left + (boxRect.width - stick) / 2;
    box.scrollBy({ left: colRect.left + colRect.width / 2 - middle, behavior: 'instant' as ScrollBehavior });
  }, [todayKey, keys]);

  useEffect(() => {
    const measure = () => setStick(scroller.current?.querySelector<HTMLElement>('[data-sticky-start]')?.offsetWidth ?? 0);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    // "row|day#nonce": the nonce lets the same cell be asked for twice.
    if (noteRequest) setNoteCell(noteRequest.split('#')[0]);
  }, [noteRequest]);

  function clickCell(row: ClientRow, day: string) {
    const id = `${row.key}|${day}`;
    if (row.checks[day] === undefined) {
      setFlash({ cell: id, n: Date.now() });
      handlers.setCell(row, day, true);
    } else {
      setNoteCell(id);
    }
  }

  // Arrow keys walk the grid. In a right-to-left table "forward" is left.
  function onGridKey(event: React.KeyboardEvent) {
    const target = event.target as HTMLElement;
    const at = target.dataset.cell;
    if (!at) return;
    const [r, c] = at.split(':').map(Number);
    const step: Record<string, [number, number]> = { ArrowLeft: [0, 1], ArrowRight: [0, -1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
    const move = step[event.key];
    if (!move) return;
    event.preventDefault();
    const next = scroller.current?.querySelector<HTMLElement>(`[data-cell="${r + move[0]}:${c + move[1]}"]`);
    if (next) {
      next.focus();
      next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      setFocusCell(next.dataset.cell ?? null);
    }
  }

  const tabbable = focusCell ?? `0:${Math.max(0, keys.indexOf(todayKey))}`;
  const months = tracker.period === 'QUARTER' || tracker.period === 'YEAR' ? monthGroups(days) : [];
  const rowCelebrating = celebrate?.kind === 'row' ? celebrate.key : null;
  const dayCelebrating = celebrate?.kind === 'day' ? celebrate.key : null;

  return (
    <section
      aria-label={`טבלת מעקב ${tracker.name}`}
      className={cn('overflow-hidden rounded-2xl border border-line bg-surface shadow-row', fresh && 'tracker-in')}
    >
      {/* Header. On a phone: name and settings on one line, paging under it. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3 px-4 pb-3 pt-4 sm:px-5">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold text-ink">{tracker.name}</h2>
          <p className="truncate text-sm text-muted">
            טבלה {PERIOD_LABELS[tracker.period]} · {tracker.weekdays.length === 7 ? 'כל השבוע' : tracker.weekdays.map((d) => WEEKDAY_SHORT[d]).join(' ')}
          </p>
        </div>
        <button
          type="button"
          aria-label="הגדרות הטבלה"
          aria-expanded={editing}
          onClick={() => setEditing((v) => !v)}
          className={cn('grid size-10 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-ink sm:order-last', editing && 'bg-surface-2 text-ink')}
        >
          <Settings2 className="size-[1.125rem]" aria-hidden />
        </button>
        <div className="flex w-full items-center gap-1 sm:w-auto">
          <div className="flex flex-1 items-center justify-between rounded-xl border border-line sm:flex-none">
            <NavButton label="התקופה הקודמת" onClick={() => setAnchor((a) => shiftPeriod(tracker.period, a, -1))}>
              <ChevronRight className="size-4" aria-hidden />
            </NavButton>
            <span className="min-w-[7.5rem] px-1 text-center text-sm font-semibold text-ink" aria-live="polite">
              <PeriodLabel text={periodLabel(tracker.period, anchor)} />
            </span>
            <NavButton label="התקופה הבאה" onClick={() => setAnchor((a) => shiftPeriod(tracker.period, a, 1))}>
              <ChevronLeft className="size-4" aria-hidden />
            </NavButton>
          </div>
          {!onCurrent && (
            <button type="button" onClick={() => setAnchor(now)} className="tracker-in rounded-xl px-3 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent-soft">
              היום
            </button>
          )}
        </div>
      </div>

      {/* Settings, opened in place */}
      <div className="tracker-expand" style={{ gridTemplateRows: editing ? '1fr' : '0fr', opacity: editing ? 1 : 0 }}>
        <div className="min-h-0 overflow-hidden">
          {editing && (
            <div className="mx-4 mb-4 rounded-xl border border-line bg-surface-2/50 p-4 sm:mx-5">
              <TrackerForm
                initial={{ name: tracker.name, period: tracker.period, weekdays: tracker.weekdays }}
                submitLabel="שמירה"
                onCancel={() => setEditing(false)}
                onSubmit={(settings) => {
                  handlers.update(settings);
                  setEditing(false);
                }}
                extra={
                  <Button type="button" size="sm" variant="danger" onClick={handlers.remove}>
                    <Trash2 className="size-4" aria-hidden />
                    מחיקת הטבלה
                  </Button>
                }
              />
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      <div ref={scroller} className="tracker-scroll overflow-x-auto border-t border-line" style={{ '--stick': `${stick}px` } as React.CSSProperties} onKeyDown={onGridKey}>
        <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            {months.length > 0 && (
              <tr>
                <th data-sticky-start className="sticky start-0 z-20 bg-surface" />
                {months.map((group) => (
                  <th key={group.key} colSpan={group.count} className="border-b border-s border-line bg-surface px-0 pb-1 pt-2 text-start text-xs font-bold text-ink-2">
                    {/* Sticky inside its own month, so the name stays readable
                        beside the frozen item column until the month scrolls by. */}
                    <span className="sticky start-[calc(var(--stick)+0.5rem)] px-2">{group.label}</span>
                  </th>
                ))}
                <th className="sticky end-0 z-20 hidden bg-surface sm:table-cell" />
              </tr>
            )}
            <tr>
              <th data-sticky-start className="sticky start-0 z-20 w-[32vw] min-w-[32vw] border-b border-e border-line bg-surface px-3 py-2 text-start text-xs font-semibold text-muted sm:w-48 sm:min-w-48 sm:px-5">
                {tracker.rows.length ? `${tracker.rows.length} פריטים` : ''}
              </th>
              {days.map((day, c) => {
                const key = keys[c];
                const isToday = key === todayKey;
                const weekend = day.getUTCDay() >= 5;
                return (
                  <th
                    key={key}
                    data-day={key}
                    title={`${WEEKDAY_FULL[day.getUTCDay()]} · ${hebrewDayMonth(day)}`}
                    className={cn(
                      'relative border-b border-line px-0.5 py-2 text-center font-normal',
                      weekend && 'bg-surface-sunk/60',
                      isToday && 'bg-accent-soft/70',
                    )}
                  >
                    {dayCelebrating === key && <span key={celebrate!.n} aria-hidden className="tracker-glow absolute inset-0" />}
                    <span className={cn('block text-[0.7rem] font-bold', isToday ? 'text-accent' : 'text-muted')}>{WEEKDAY_SHORT[day.getUTCDay()]}</span>
                    <span
                      className={cn(
                        'num mx-auto mt-0.5 grid place-items-center rounded-full font-bold',
                        compact ? 'size-6 text-xs' : 'size-7 text-sm',
                        isToday ? 'bg-accent text-[var(--on-accent)]' : 'text-ink',
                      )}
                    >
                      {day.getUTCDate()}
                    </span>
                    {!compact && <span className="mt-0.5 block text-[0.65rem] text-muted">{hebrewDay(day)}</span>}
                  </th>
                );
              })}
              <th className="sticky end-0 z-20 hidden border-b border-s border-line bg-surface px-3 py-2 text-center text-xs font-semibold text-muted sm:table-cell">התקדמות</th>
            </tr>
          </thead>

          <tbody>
            {tracker.rows.map((row, r) => (
              <Row
                key={row.key}
                row={row}
                r={r}
                days={days}
                keys={keys}
                todayKey={todayKey}
                compact={compact}
                flash={flash}
                tabbable={tabbable}
                noteCell={noteCell}
                setNoteCell={setNoteCell}
                onCell={clickCell}
                onFocusCell={setFocusCell}
                handlers={handlers}
                celebrating={rowCelebrating === row.key ? celebrate!.n : 0}
              />
            ))}
          </tbody>

          <tfoot>
            <tr>
              <td data-sticky-start className="sticky start-0 z-10 border-e border-line bg-surface px-2 py-1.5 sm:px-3" colSpan={1}>
                <AddRow inputRef={addInput} onAdd={handlers.addRow} />
              </td>
              <td colSpan={days.length + 1} className="bg-surface">
                {!tracker.rows.length && <p className="px-3 text-sm text-muted">למשל: ״לשתות 8 כוסות מים״, ״20 דקות קריאה״.</p>}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

/** "25–31 באוקטובר": the en dash is neutral, so the range gets its own
 *  left-to-right island or a right-to-left line reads it as 31–25. */
function PeriodLabel({ text }: { text: string }) {
  const match = text.match(/^(\d+–\d+)(.*)$/);
  if (!match) return <>{text}</>;
  return (
    <>
      <span dir="ltr" className="num">{match[1]}</span>
      {match[2]}
    </>
  );
}

function NavButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="grid size-9 place-items-center rounded-xl text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink active:scale-95">
      {children}
    </button>
  );
}

function monthGroups(days: Date[]) {
  const groups: { key: string; label: string; count: number }[] = [];
  for (const day of days) {
    const key = `${day.getUTCFullYear()}-${day.getUTCMonth()}`;
    const last = groups.at(-1);
    if (last?.key === key) last.count += 1;
    else groups.push({ key, label: monthName(day.getUTCMonth()), count: 1 });
  }
  return groups;
}

/* ── Row ─────────────────────────────────────────────────────────────────── */

const Row = memo(function Row({
  row,
  r,
  days,
  keys,
  todayKey,
  compact,
  flash,
  tabbable,
  noteCell,
  setNoteCell,
  onCell,
  onFocusCell,
  handlers,
  celebrating,
}: {
  row: ClientRow;
  r: number;
  days: Date[];
  keys: string[];
  todayKey: string;
  compact: boolean;
  flash: Flash | null;
  tabbable: string;
  noteCell: string | null;
  setNoteCell: (cell: string | null) => void;
  onCell: (row: ClientRow, day: string) => void;
  onFocusCell: (cell: string) => void;
  handlers: TrackerHandlers;
  celebrating: number;
}) {
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(row.title);
  const done = keys.filter((key) => row.checks[key] !== undefined).length;
  const total = keys.length;

  return (
    <tr className="tracker-row-in group/row">
      <th
        scope="row"
        data-sticky-start
        className="sticky start-0 z-10 border-b border-e border-line bg-surface px-3 py-1 text-start font-normal sm:px-5"
      >
        {renaming ? (
          <input
            autoFocus
            value={title}
            maxLength={120}
            aria-label="שם הפריט"
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => {
              setRenaming(false);
              if (title.trim() && title.trim() !== row.title) handlers.renameRow(row, title.trim());
              else setTitle(row.title);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
              if (event.key === 'Escape') {
                setTitle(row.title);
                setRenaming(false);
              }
            }}
            className="w-full rounded-md bg-surface-2 px-2 py-1.5 text-[0.95rem] text-ink outline-none ring-2 ring-accent/40"
          />
        ) : (
          <Menu>
            {/* The name is the handle: tap it for rename and delete. No
                separate "…" button competing for a narrow column. */}
            <MenuTrigger
              className="relative block w-full rounded-md py-1.5 text-start outline-none transition-colors hover:text-accent focus-visible:ring-2 focus-visible:ring-accent/40"
              title={row.title}
            >
              <span className="line-clamp-2 text-sm leading-snug text-ink sm:text-[0.95rem]">{row.title}</span>
              <span className="relative mt-1 flex items-center gap-1.5 sm:hidden" aria-hidden>
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-line">
                  <span className="block h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
                </span>
                <span className="num text-[0.7rem] font-bold text-muted">
                  {done}/{total}
                </span>
                {celebrating > 0 && <Confetti n={celebrating} />}
              </span>
            </MenuTrigger>
            <MenuContent align="start">
              <MenuItem onSelect={() => setRenaming(true)}>
                <Pencil className="size-4" aria-hidden />
                שינוי שם
              </MenuItem>
              <MenuItem tone="danger" onSelect={() => handlers.deleteRow(row)}>
                <Trash2 className="size-4" aria-hidden />
                מחיקת הפריט
              </MenuItem>
            </MenuContent>
          </Menu>
        )}
      </th>

      {days.map((day, c) => {
        const key = keys[c];
        const id = `${row.key}|${key}`;
        const note = row.checks[key];
        return (
          <td
            key={key}
            className={cn(
              'border-b border-line p-0 text-center',
              day.getUTCDay() >= 5 && 'bg-surface-sunk/60',
              key === todayKey && 'bg-accent-soft/50',
            )}
          >
            <Cell
              row={row}
              day={day}
              dayKey={key}
              checked={note !== undefined}
              note={note ?? ''}
              future={key > todayKey}
              compact={compact}
              flash={flash?.cell === id ? flash.n : 0}
              coords={`${r}:${c}`}
              tabbable={tabbable === `${r}:${c}`}
              open={noteCell === id}
              onOpenChange={(open) => setNoteCell(open ? id : null)}
              onClick={() => onCell(row, key)}
              onFocus={() => onFocusCell(`${r}:${c}`)}
              handlers={handlers}
            />
          </td>
        );
      })}

      <td className="sticky end-0 z-10 hidden border-b border-s border-line bg-surface px-3 py-1 sm:table-cell">
        <Progress done={done} total={total} celebrating={celebrating} />
      </td>
    </tr>
  );
});

/* ── Cell ────────────────────────────────────────────────────────────────── */

function Cell({
  row,
  day,
  dayKey: key,
  checked,
  note,
  future,
  compact,
  flash,
  coords,
  tabbable,
  open,
  onOpenChange,
  onClick,
  onFocus,
  handlers,
}: {
  row: ClientRow;
  day: Date;
  dayKey: string;
  checked: boolean;
  note: string;
  future: boolean;
  compact: boolean;
  flash: number;
  coords: string;
  tabbable: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClick: () => void;
  onFocus: () => void;
  handlers: TrackerHandlers;
}) {
  const [draft, setDraft] = useState(note);
  useEffect(() => {
    if (open) setDraft(note);
  }, [open, note]);

  const label = `${row.title}, ${WEEKDAY_FULL[day.getUTCDay()]} ${day.getUTCDate()}.${day.getUTCMonth() + 1}: ${checked ? 'סומן' : 'לא סומן'}${note ? `. הערה: ${note}` : ''}`;

  function save() {
    handlers.saveNote(row, key, draft);
    onOpenChange(false);
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>
        <div className={cn('relative mx-auto grid place-items-center', compact ? 'size-10' : 'size-12')}>
          <button
            type="button"
            data-cell={coords}
            tabIndex={tabbable ? 0 : -1}
            aria-pressed={checked}
            aria-label={label}
            title={note || undefined}
            onClick={onClick}
            onFocus={onFocus}
            className={cn(
              'group/cell relative grid place-items-center rounded-[0.6rem] transition-[background-color,border-color,transform,opacity] duration-150 active:scale-90',
              compact ? 'size-8' : 'size-9',
              checked
                ? 'bg-accent text-[var(--on-accent)] shadow-row'
                : cn('border-2 border-line-strong/70 bg-surface hover:border-accent hover:bg-accent-soft', future && 'opacity-55'),
            )}
          >
            {checked ? (
              <span key={flash} className={cn('grid place-items-center', flash && 'tracker-check-pop')}>
                <CheckMark className={compact ? 'size-4' : 'size-5'} />
              </span>
            ) : (
              <CheckMark className={cn('text-accent opacity-0 transition-opacity group-hover/cell:opacity-40', compact ? 'size-4' : 'size-5')} />
            )}
            {note && <span aria-hidden className="absolute -end-0.5 -top-0.5 size-2.5 rounded-full border-2 border-surface bg-flag" />}
          </button>
          {flash > 0 && <Sparks key={flash} />}
        </div>
      </PopoverAnchor>
      <PopoverContent
        side="bottom"
        align="center"
        className="w-72 p-3"
      >
        <p className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
          <span className="grid size-5 place-items-center rounded-md bg-accent text-[var(--on-accent)]">
            <CheckMark className="size-3.5" />
          </span>
          {row.title}
          <span className="font-normal text-muted">
            · {WEEKDAY_FULL[day.getUTCDay()]} <span className="num">{day.getUTCDate()}.{day.getUTCMonth() + 1}</span>
          </span>
        </p>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              save();
            }
          }}
          maxLength={500}
          rows={3}
          placeholder="הערה קצרה, למשל: 5 ק״מ, 30 דקות…"
          aria-label="הערה"
          className="w-full resize-none rounded-lg border border-line-strong bg-surface px-3 py-2 text-[0.95rem] text-ink outline-none transition-shadow placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/25"
        />
        <div className="mt-2 flex items-center gap-2">
          <Button size="sm" onClick={save}>
            שמירה
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="ms-auto text-muted"
            onClick={() => {
              handlers.setCell(row, key, false);
              onOpenChange(false);
            }}
          >
            הסרת הסימון
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CheckMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path className="tracker-check-path" d="M4.5 10.5l3.6 3.6L15.5 6.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const SPARK_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

function Sparks() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
      <span className="tracker-ring absolute inset-[6px] rounded-[0.7rem]" />
      {SPARK_ANGLES.map((deg) => (
        <span
          key={deg}
          className="tracker-spark"
          style={{ '--dx': `${Math.cos((deg * Math.PI) / 180) * 22}px`, '--dy': `${Math.sin((deg * Math.PI) / 180) * 22}px` } as React.CSSProperties}
        />
      ))}
    </span>
  );
}

/* ── Progress ────────────────────────────────────────────────────────────── */

const CONFETTI_COLORS = ['var(--accent)', 'var(--swatch-teal)', 'var(--swatch-plum)', 'var(--flag)', 'var(--swatch-moss)'];

function Progress({ done, total, celebrating }: { done: number; total: number; celebrating: number }) {
  const ratio = total ? done / total : 0;
  const full = total > 0 && done === total;
  const c = 2 * Math.PI * 9;
  return (
    <div className="relative flex items-center justify-center gap-2">
      <svg viewBox="0 0 24 24" className="size-7 -rotate-90" aria-hidden>
        <circle cx="12" cy="12" r="9" fill="none" stroke="var(--line)" strokeWidth="3" />
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - ratio)}
          style={{ transition: 'stroke-dashoffset 500ms var(--ease-out-soft)' }}
        />
      </svg>
      <span className={cn('num min-w-[3ch] text-xs font-bold tabular-nums', full ? 'text-accent' : 'text-ink-2')}>
        {done}/{total}
      </span>
      {celebrating > 0 && <Confetti n={celebrating} />}
    </div>
  );
}

function Confetti({ n }: { n: number }) {
  return (
    <span key={n} aria-hidden className="pointer-events-none absolute inset-0">
      {Array.from({ length: 16 }, (_, i) => {
        const angle = (i / 16) * Math.PI * 2;
        const dist = 34 + (i % 3) * 12;
        return (
          <span
            key={i}
            className="tracker-confetti"
            style={
              {
                background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                '--dx': `${Math.cos(angle) * dist}px`,
                '--dy': `${Math.sin(angle) * dist - 10}px`,
                '--rot': `${(i % 2 ? 1 : -1) * (180 + i * 20)}deg`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </span>
  );
}

/* ── Add a row ───────────────────────────────────────────────────────────── */

function AddRow({ inputRef, onAdd }: { inputRef: React.RefObject<HTMLInputElement | null>; onAdd: (title: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!value.trim()) return;
        onAdd(value.trim());
        setValue('');
      }}
      className="flex items-center gap-1.5"
    >
      <Plus className="size-4 shrink-0 text-accent" aria-hidden />
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={120}
        placeholder="פריט חדש"
        aria-label="פריט חדש בטבלה"
        className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-2 text-[0.95rem] text-ink outline-none placeholder:text-muted focus:bg-surface-2"
      />
    </form>
  );
}
