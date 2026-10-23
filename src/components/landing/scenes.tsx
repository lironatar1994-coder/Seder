'use client';

import { CalendarDays, Check, Flag, Folder, Inbox, LayoutGrid, Plus, Search, Send, Star, Users } from 'lucide-react';
import { cn } from '@/lib/cn';
import { swatchVar } from '@/lib/constants';
import { buildWeekGrid } from '@/lib/calendar';
import { addDays, today } from '@/lib/dates';
import { between, Burst, Cursor, Ltr, SceneFrame, typed, useSceneClock, type SceneProps } from './scene-kit';

/* Scenes are composed on a fixed width of 100cqw. A scene's height in cqw is
   100 / aspect, so a vertical position in cqw becomes a percentage with: */
const pctY = (cqw: number, aspect: number) => (cqw * aspect);

/* ── Shared pieces ──────────────────────────────────────────────────────── */

function Circle({ priority = 4, done = false, className }: { priority?: number; done?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'relative grid shrink-0 place-items-center rounded-full border-[0.45cqw] transition-[background-color,border-color,transform] duration-200',
        done && 'scale-110 border-accent bg-accent',
        className,
      )}
      style={done ? undefined : { borderColor: `var(--p${priority})` }}
    >
      <Check className={cn('size-[62%] text-[var(--on-accent)] transition-opacity duration-150', done ? 'opacity-100' : 'opacity-0')} strokeWidth={3.5} />
    </span>
  );
}

function Dot({ color }: { color: string }) {
  return <span className="inline-block size-[1.6cqw] shrink-0 rounded-full" style={{ background: swatchVar(color) }} />;
}

/** Height-collapsing wrapper: rows leave and arrive without jumping. */
function Collapse({ open, children, className }: { open: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn('grid transition-[grid-template-rows,opacity] duration-500 ease-[var(--ease-out-soft)]', className)}
      style={{ gridTemplateRows: open ? '1fr' : '0fr', opacity: open ? 1 : 0 }}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

/* ── 1. Capture: a Hebrew sentence becomes a task ───────────────────────── */

type Kind = 'date' | 'time' | 'project' | 'priority';
const SENTENCE: { kind: Kind | null; text: string; ltr?: boolean }[] = [
  { kind: null, text: 'לסיים מצגת' },
  { kind: 'date', text: ' מחר' },
  { kind: 'time', text: ' ב-14:30' },
  { kind: 'project', text: ' #עבודה' },
  { kind: 'priority', text: ' !1', ltr: true },
];
const TYPE_FROM = 500;
const TYPE_MS = 72;
const ENDS = SENTENCE.reduce<number[]>((acc, part, i) => [...acc, (acc[i - 1] ?? 0) + part.text.length], []);
const TOTAL = ENDS.at(-1)!;
const TYPED_AT = TYPE_FROM + TOTAL * TYPE_MS;
const SEND = TYPED_AT + 650;
const STRIP = SEND + 150;
const SAVED = STRIP + 750;
const CAPTURE_LOOP = SAVED + 2800;

export function CaptureScene({ active = true }: SceneProps) {
  const { ref, t } = useSceneClock(CAPTURE_LOOP, SAVED + 900, active);
  const count = Math.max(0, Math.min(TOTAL, Math.floor((t - TYPE_FROM) / TYPE_MS)));
  const lit = (i: number) => count >= ENDS[i];
  const stripped = t >= STRIP && t < SAVED;
  const cleared = t >= SAVED;
  const saved = t >= SAVED && t < CAPTURE_LOOP - 900;

  return (
    <SceneFrame
      sceneRef={ref}
      name="capture"
      loop={CAPTURE_LOOP}
      label="הדגמה: כותבים ״לסיים מצגת מחר ב-14:30 #עבודה !1״, סדר מזהה את התאריך, השעה, הפרויקט והעדיפות, ושומר משימה נקייה בשם ״לסיים מצגת״."
      className="aspect-square"
    >
      <div className="flex h-full flex-col gap-[4cqw] p-[6cqw]">
        {/* Composer */}
        <div className={cn('rounded-[3cqw] bg-surface p-[4cqw] shadow-pop ring-[0.3cqw] transition-[box-shadow] duration-300', cleared ? 'ring-line' : 'ring-accent/40')}>
          <p className="min-h-[7cqw] text-[4.7cqw] font-medium leading-[7cqw] text-ink">
            {count === 0 || cleared ? (
              <span className="text-muted">מה צריך לעשות?</span>
            ) : (
              SENTENCE.map((part, i) => {
                const start = i === 0 ? 0 : ENDS[i - 1];
                const shown = part.text.slice(0, Math.max(0, count - start));
                const on = part.kind && lit(i);
                const gone = part.kind && stripped;
                return (
                  <span
                    key={i}
                    className={cn(
                      'inline-block max-w-[60cqw] overflow-hidden whitespace-pre align-top transition-[max-width,opacity,background-color,color] duration-500',
                      on && !gone && 'rounded-[0.8cqw] bg-accent-soft text-accent',
                      gone && 'max-w-0 opacity-0',
                    )}
                  >
                    {/* The space stays outside the island, or it lands on the island's far side. */}
                    {part.ltr ? <>{shown.slice(0, 1)}<Ltr>{shown.slice(1)}</Ltr></> : shown}
                  </span>
                );
              })
            )}
            {!cleared && t < STRIP && <span className="animate-caret ms-[0.3cqw] inline-block h-[5.6cqw] w-[0.5cqw] translate-y-[0.8cqw] rounded-full bg-accent align-top" />}
          </p>

          <div className="mt-[3cqw] flex items-center gap-[1.6cqw]">
            <Chip on={lit(1) && !cleared} icon={<CalendarDays />} tone="accent">
              מחר{lit(2) && <> · <span className="num">14:30</span></>}
            </Chip>
            <Chip on={lit(3) && !cleared} icon={<Folder />} tone="ink">
              עבודה
            </Chip>
            <Chip on={lit(4) && !cleared} icon={<Flag className="fill-current" />} tone="p1">
              דחוף
            </Chip>
            <span
              className={cn(
                'ms-auto grid size-[8.5cqw] place-items-center rounded-full text-[var(--on-accent)] transition-[transform,background-color] duration-150',
                count === TOTAL && !cleared ? 'bg-accent' : 'bg-line-strong',
                between(t, SEND, SEND + 220) && 'scale-90',
              )}
            >
              <Send className="size-[4cqw] -scale-x-100" />
            </span>
          </div>
        </div>

        {/* Today list */}
        <div className="flex-1 rounded-[3cqw] bg-surface px-[4.5cqw] py-[3.5cqw] shadow-row ring-[0.3cqw] ring-line">
          <p className="flex items-baseline gap-[1.6cqw] text-[4.4cqw] font-extrabold text-ink">
            היום <span className="num text-[3cqw] font-semibold text-muted">{saved ? 3 : 2}</span>
          </p>
          <Collapse open={saved}>
            <div className={cn('mt-[1.5cqw] rounded-[1.6cqw] transition-colors duration-[1200ms]', between(t, SAVED, SAVED + 900) ? 'bg-accent-soft' : 'bg-transparent')}>
              <Row title="לסיים מצגת" priority={1} meta={<><CalendarDays className="size-[3cqw] text-accent" /><span className="text-accent">מחר <span className="num">14:30</span></span><Dot color="teal" />עבודה</>} flag />
            </div>
          </Collapse>
          <Row title="להתקשר למוסך" priority={3} meta={<><span className="text-[var(--swatch-moss)]">היום</span><Dot color="clay" />בית</>} />
          <Row title="לקנות חלב ולחם" priority={4} meta={<><span className="text-[var(--swatch-moss)]">היום</span><Dot color="clay" />בית</>} last />
        </div>
      </div>
    </SceneFrame>
  );
}

function Chip({ on, icon, tone, children }: { on: boolean; icon: React.ReactElement<{ className?: string }>; tone: 'accent' | 'ink' | 'p1'; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-[1cqw] rounded-[1.4cqw] border-[0.3cqw] px-[1.8cqw] py-[0.9cqw] text-[3.1cqw] font-semibold transition-[opacity,transform] duration-300 ease-[var(--ease-out-soft)] [&_svg]:size-[3.1cqw]',
        tone === 'accent' && 'border-accent/30 bg-accent-soft text-accent',
        tone === 'ink' && 'border-line-strong bg-surface text-ink-2',
        tone === 'p1' && 'border-[var(--p1)]/30 bg-surface text-[var(--p1)]',
        on ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-[1cqw] scale-90 opacity-0',
      )}
    >
      {icon}
      {children}
    </span>
  );
}

function Row({ title, priority, meta, flag = false, last = false }: { title: string; priority: number; meta: React.ReactNode; flag?: boolean; last?: boolean }) {
  return (
    <div className={cn('flex items-start gap-[2.6cqw] py-[2.6cqw]', !last && 'border-b-[0.25cqw] border-line')}>
      <Circle priority={priority} className="mt-[0.4cqw] size-[5.2cqw]" />
      <div className="min-w-0 flex-1">
        <p className="text-[4.1cqw] leading-tight text-ink">{title}</p>
        <p className="mt-[1cqw] flex items-center gap-[1.2cqw] text-[2.9cqw] text-muted">{meta}</p>
      </div>
      {flag && <Flag className="mt-[0.6cqw] size-[3.4cqw] fill-current text-[var(--p1)]" />}
    </div>
  );
}

/* ── 2. Focus: completing tasks ─────────────────────────────────────────── */

const FOCUS_ROWS = [
  { title: 'לשלוח הצעת מחיר', priority: 1, meta: '10:00', project: ['teal', 'עבודה'] },
  { title: 'להתקשר למוסך', priority: 3, meta: 'היום', project: ['clay', 'בית'] },
  { title: 'ריצה בפארק', priority: 4, meta: 'היום', project: ['moss', 'אישי'] },
  { title: 'לקנות מתנה לנועה', priority: 2, meta: 'היום', project: ['plum', 'אישי'] },
] as const;
const FOCUS_LOOP = 7600;
const FOCUS_ASPECT = 1.12;
/* Geometry (cqw): card top 6, header 15, rows 14.5 tall, circles 8cqw in from the card edge. */
const focusRowY = (index: number) => 6 + 15 + index * 14.5 + 6.6;
const TAPS = [
  { row: 0, slot: 0, at: 1300 },
  { row: 2, slot: 1, at: 3500 },
];

export function FocusScene({ active = true }: SceneProps) {
  const { ref, t } = useSceneClock(FOCUS_LOOP, 2100, active);
  const resetting = t >= FOCUS_LOOP - 700;
  const doneAt = (row: number) => TAPS.find((tap) => tap.row === row)?.at ?? Infinity;
  const isDone = (row: number) => t >= doneAt(row) && !resetting;
  const isGone = (row: number) => t >= doneAt(row) + 650 && !resetting;
  const left = FOCUS_ROWS.length - FOCUS_ROWS.filter((_, i) => isGone(i)).length;

  const tap = [...TAPS].reverse().find((item) => t >= item.at - 900) ?? TAPS[0];
  const cursorVisible = t >= 300 && t < 5000;
  const toast = TAPS.some((item) => between(t, item.at + 200, item.at + 1700));

  return (
    <SceneFrame sceneRef={ref} name="focus" loop={FOCUS_LOOP} label="הדגמה: במסך היום מסמנים שתי משימות כהושלמו בלחיצה על העיגול, והן יוצאות מהרשימה." className="aspect-[1.12]">
      <div className="absolute inset-x-[6cqw] top-[6cqw] rounded-[3cqw] bg-surface px-[5cqw] pb-[3cqw] shadow-pop ring-[0.3cqw] ring-line">
        <div className="flex h-[15cqw] items-center justify-between">
          <p className="text-[5.6cqw] font-extrabold text-ink">היום</p>
          <span className="num rounded-full bg-accent-soft px-[2cqw] py-[0.6cqw] text-[3cqw] font-bold text-accent transition-all">{left} משימות</span>
        </div>
        {FOCUS_ROWS.map((row, i) => (
          <Collapse key={row.title} open={!isGone(i)}>
            <div className="flex h-[14.5cqw] items-center gap-[3cqw] border-t-[0.25cqw] border-line">
              <span className="relative">
                <Circle priority={row.priority} done={isDone(i)} className="size-[6cqw]" />
                <Burst show={isDone(i) && !isGone(i)} />
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn('relative inline-block text-[4.3cqw] leading-tight transition-colors duration-200', isDone(i) ? 'text-muted' : 'text-ink')}>
                  {row.title}
                  <span className={cn('absolute start-0 top-1/2 h-[0.3cqw] origin-right bg-muted transition-[width] duration-300', isDone(i) ? 'w-full' : 'w-0')} />
                </p>
                <p className="mt-[0.8cqw] flex items-center gap-[1.2cqw] text-[3cqw] text-muted">
                  <span className={row.meta.includes(':') ? 'num text-accent' : 'text-[var(--swatch-moss)]'}>{row.meta}</span>
                  <Dot color={row.project[0]} />
                  {row.project[1]}
                </p>
              </div>
            </div>
          </Collapse>
        ))}
      </div>

      <div className={cn('absolute inset-x-0 bottom-[5cqw] flex justify-center transition-[opacity,transform] duration-300', toast ? 'translate-y-0 opacity-100' : 'translate-y-[3cqw] opacity-0')}>
        <span className="flex items-center gap-[3cqw] rounded-[2.4cqw] bg-ink px-[4cqw] py-[2.2cqw] text-[3.3cqw] font-semibold text-paper shadow-pop">
          <Check className="size-[3.6cqw]" strokeWidth={3} /> המשימה הושלמה
          <span className="text-[color-mix(in_oklch,var(--paper)_70%,var(--accent))] underline underline-offset-2">ביטול</span>
        </span>
      </div>

      <Cursor x={100 - 6 - 5 - 3} y={pctY(focusRowY(tap.slot), FOCUS_ASPECT)} pressed={between(t, tap.at - 120, tap.at + 120)} visible={cursorVisible} />
    </SceneFrame>
  );
}

/* ── 3. Plan: the two-calendar week ─────────────────────────────────────── */

const CAL_LOOP = 8600;
const CAL_ASPECT = 1.12;
/* Grid geometry (cqw): columns span 6..94, rows start at 31 and are 23 tall. */
const COL_W = 88 / 7;
const colLeft = (col: number) => 6 + (6 - col) * COL_W;
const ROW_TOP = 31;
const ROW_H = 23;

export function CalendarScene({ active = true }: SceneProps) {
  const { ref, t } = useSceneClock(CAL_LOOP, 3600, active);
  const now = today();
  const weeks = [buildWeekGrid(now, now), buildWeekGrid(addDays(now, 7), now)];
  const header = weeks[0];

  // A meeting is dragged from Sunday to Tuesday of the first week; then a
  // deadline flag drops onto Thursday. The pair is the point: when you work on
  // something and when it is due are different days.
  const grabbed = t >= 1500 && t < 2900;
  const moved = t >= 2000 && t < CAL_LOOP - 500;
  const col = moved ? 2 : 0;
  const chipX = colLeft(col) + 1;
  const chipY = ROW_TOP + 9;
  // The pointer drifts in from the middle of the week before it takes the chip.
  const cursorX = t < 1000 ? colLeft(3) + 6 : chipX + 7;
  const cursorY = pctY(t < 1000 ? chipY + 26 : chipY + 3, CAL_ASPECT);
  const deadline = t >= 3500 && t < CAL_LOOP - 500;

  return (
    <SceneFrame sceneRef={ref} name="calendar" loop={CAL_LOOP} label="הדגמה: לוח שבועי עם תאריך לועזי ויום עברי בכל תא, שישי ושבת מוצללים. גוררים פגישה מיום ראשון ליום שלישי, ומועד הגשה מסומן ביום חמישי." className="aspect-[1.12]">
      <div className="absolute inset-x-[4cqw] top-[5cqw] bottom-[6cqw] rounded-[3cqw] bg-surface shadow-pop ring-[0.3cqw] ring-line" />
      <div className="absolute inset-x-[8cqw] top-[9cqw] flex items-baseline justify-between">
        <p className="text-[5.4cqw] font-extrabold text-ink">{rangeLabel(header.label)}</p>
        <p className="text-[3cqw] font-semibold text-muted">{header.hebrewRange}</p>
      </div>
      {['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'].map((day, i) => (
        <span key={day} className={cn('absolute top-[24cqw] text-center text-[2.8cqw] font-bold', i >= 5 ? 'text-muted' : 'text-ink-2')} style={{ left: `${colLeft(i)}cqw`, width: `${COL_W}cqw` }}>
          {day}
        </span>
      ))}
      {weeks.map((week, row) =>
        week.days.map((day, i) => (
          <div
            key={day.iso}
            className={cn('absolute border-[0.2cqw] border-line p-[1cqw]', day.isWeekend ? 'bg-surface-sunk' : 'bg-surface')}
            style={{ left: `${colLeft(i)}cqw`, top: `${ROW_TOP + row * ROW_H}cqw`, width: `${COL_W}cqw`, height: `${ROW_H}cqw` }}
          >
            <span className="flex items-center gap-[0.6cqw]">
              <span className={cn('num grid min-w-[5cqw] place-items-center rounded-full text-[3.4cqw] font-bold leading-[5cqw]', day.isToday ? 'bg-accent text-[var(--on-accent)]' : 'text-ink')}>{day.dayOfMonth}</span>
              <span className="text-[2.6cqw] text-muted">{day.hebrewDay}</span>
            </span>
            {day.hebrewMonthLabel && <span className="mt-[0.4cqw] block truncate text-[2.3cqw] font-bold text-accent">{day.hebrewMonthLabel}</span>}
          </div>
        )),
      )}

      {/* The dragged meeting */}
      <span
        className={cn(
          'absolute z-20 flex h-[6cqw] items-center gap-[0.8cqw] rounded-[1.2cqw] bg-accent-soft px-[1cqw] text-[2.7cqw] font-bold text-accent ring-[0.25cqw] ring-accent/30',
          grabbed ? 'scale-110 shadow-pop' : 'shadow-row',
        )}
        style={{
          left: `${chipX}cqw`,
          top: `${chipY}cqw`,
          width: `${COL_W - 2}cqw`,
          opacity: t >= CAL_LOOP - 500 ? 0 : 1,
          transition: 'left 700ms cubic-bezier(.45,.05,.25,1), transform 200ms, box-shadow 200ms, opacity 300ms',
        }}
      >
        <span className="size-[1.4cqw] shrink-0 rounded-full bg-accent" />
        פגישה
      </span>

      {/* The deadline */}
      <span
        className={cn(
          'absolute z-10 flex h-[6cqw] items-center gap-[0.8cqw] rounded-[1.2cqw] bg-flag-soft px-[1cqw] text-[2.7cqw] font-bold text-flag ring-[0.25cqw] ring-flag/30 transition-[opacity,transform] duration-300',
          deadline ? 'translate-y-0 opacity-100' : '-translate-y-[2cqw] opacity-0',
        )}
        style={{ left: `${colLeft(4) + 1}cqw`, top: `${chipY}cqw`, width: `${COL_W - 2}cqw` }}
      >
        <Flag className="size-[2.6cqw] shrink-0 fill-current" />
        דוח
      </span>

      <Cursor x={cursorX} y={cursorY} pressed={grabbed} visible={t >= 600 && t < 3300} />
    </SceneFrame>
  );
}

/** "18–24 באוקטובר": the en dash is neutral, so in a right-to-left line the
 *  range would read 24–18. The numbers get their own left-to-right island. */
function rangeLabel(label: string) {
  const match = label.match(/^([\d\s–-]+?)(\s+\D.*)$/);
  if (!match) return label;
  return (
    <>
      <Ltr className="num">{match[1]}</Ltr>
      {match[2]}
    </>
  );
}

/* ── 4. Together: a shared project board ────────────────────────────────── */

const BOARD_LOOP = 8800;
const BOARD_ASPECT = 1.12;
const BCOL_W = 27.3;
const bcolLeft = (col: number) => 94 - (col + 1) * BCOL_W - col * 3;
const CARD_H = 15;
const cardTop = (slot: number) => 34 + slot * (CARD_H + 2.4);
const NOA = 'var(--swatch-plum)';

export function TogetherScene({ active = true }: SceneProps) {
  const { ref, t } = useSceneClock(BOARD_LOOP, 4200, active);
  const grabbed = t >= 1400 && t < 2900;
  const moved = t >= 1900 && t < BOARD_LOOP - 500;
  const comment = t >= 3400 && t < BOARD_LOOP - 700;
  const pos = moved ? { col: 1, slot: 1 } : { col: 0, slot: 0 };
  const x = bcolLeft(pos.col) + 1.5;
  const y = cardTop(pos.slot);

  const columns = [
    { title: 'לביצוע', count: moved ? 1 : 2 },
    { title: 'בתהליך', count: moved ? 2 : 1 },
    { title: 'הושלם', count: 1 },
  ];

  return (
    <SceneFrame sceneRef={ref} name="together" loop={BOARD_LOOP} label="הדגמה: בפרויקט משותף ״טיול ליוון״ נועה גוררת את ״להזמין טיסות״ לעמודה בתהליך ומוסיפה תגובה." className="aspect-[1.12]">
      <div className="absolute inset-x-[6cqw] top-[6cqw] flex h-[14cqw] items-center justify-between">
        <p className="flex items-center gap-[1.6cqw] text-[5.4cqw] font-extrabold text-ink">
          <span className="text-[var(--swatch-plum)]">#</span>טיול ליוון
        </p>
        <span className="flex items-center gap-[2cqw]">
          <span className="flex -space-x-[1.6cqw] rtl:space-x-reverse">
            <Avatar letter="ד" color="var(--swatch-clay)" />
            <Avatar letter="נ" color={NOA} />
          </span>
          <span className="flex items-center gap-[1cqw] rounded-[1.4cqw] border-[0.3cqw] border-line-strong bg-surface px-[2cqw] py-[1cqw] text-[2.9cqw] font-bold text-ink-2">
            <Users className="size-[3cqw]" /> שיתוף
          </span>
        </span>
      </div>

      {columns.map((column, i) => (
        <div key={column.title} className="absolute rounded-[2.4cqw] bg-surface-2/90 ring-[0.25cqw] ring-line" style={{ left: `${bcolLeft(i)}cqw`, width: `${BCOL_W}cqw`, top: '22cqw', bottom: '6cqw' }}>
          <p className="flex items-center gap-[1.2cqw] px-[2.4cqw] pt-[2.6cqw] text-[3.3cqw] font-bold text-ink">
            {column.title} <span className="num text-[2.6cqw] font-semibold text-muted">{column.count}</span>
          </p>
        </div>
      ))}

      <BoardCard col={0} slot={moved ? 0 : 1} title="ביטוח" />
      <BoardCard col={1} slot={0} title="דרכון" who={['ד', 'var(--swatch-clay)']} />
      <BoardCard col={2} slot={0} title="מלון" done who={['נ', NOA]} />

      {/* The card Noa moves */}
      <div
        className={cn('absolute z-20 rounded-[2cqw] bg-surface p-[2.2cqw] ring-[0.3cqw] ring-line', grabbed ? 'rotate-[-3deg] scale-105 shadow-pop' : 'shadow-row')}
        style={{
          left: `${x}cqw`,
          top: `${y}cqw`,
          width: `${BCOL_W - 3}cqw`,
          height: `${CARD_H}cqw`,
          opacity: t >= BOARD_LOOP - 500 ? 0 : 1,
          transition: 'left 800ms cubic-bezier(.45,.05,.25,1), top 800ms cubic-bezier(.45,.05,.25,1), transform 200ms, box-shadow 200ms, opacity 300ms',
        }}
      >
        <p className="flex items-center gap-[1.6cqw] text-[3.8cqw] font-semibold text-ink">
          <Circle priority={2} className="size-[4cqw]" />
          טיסות
        </p>
        <span className="mt-[2.4cqw] flex justify-end">
          <Avatar letter="נ" color={NOA} small />
        </span>
      </div>

      {/* Noa's comment */}
      <div
        className={cn('absolute z-30 flex items-start gap-[1.6cqw] transition-[opacity,transform] duration-300', comment ? 'translate-y-0 opacity-100' : 'translate-y-[2cqw] opacity-0')}
        style={{ left: `${bcolLeft(1) - 14}cqw`, top: `${cardTop(1) + CARD_H + 3}cqw`, width: '44cqw' }}
      >
        <span className="rounded-[2.4cqw] rounded-ss-[0.6cqw] bg-surface px-[2.6cqw] py-[1.8cqw] text-[3cqw] leading-snug text-ink shadow-pop ring-[0.3cqw] ring-line">
          <b className="block text-[2.6cqw]" style={{ color: NOA }}>נועה</b>
          הזמנתי, טסים ב־<span className="num">12.11</span>
        </span>
        <Avatar letter="נ" color={NOA} />
      </div>

      <Cursor x={x + 13} y={pctY(y + 9, BOARD_ASPECT)} pressed={grabbed} visible={t >= 500 && t < 3200} name="נועה" color={NOA} ms={800} />
    </SceneFrame>
  );
}

function BoardCard({ col, slot, title, who, done = false }: { col: number; slot: number; title: string; who?: [string, string]; done?: boolean }) {
  return (
    <div
      className="absolute rounded-[2cqw] bg-surface p-[2.2cqw] shadow-row ring-[0.3cqw] ring-line transition-[top] duration-500"
      style={{ left: `${bcolLeft(col) + 1.5}cqw`, top: `${cardTop(slot)}cqw`, width: `${BCOL_W - 3}cqw`, height: `${CARD_H}cqw` }}
    >
      <p className={cn('flex items-center gap-[1.6cqw] text-[3.8cqw] font-semibold', done ? 'text-muted line-through' : 'text-ink')}>
        <Circle done={done} className="size-[4cqw]" />
        {title}
      </p>
      {who && (
        <span className="mt-[2cqw] flex justify-end">
          <Avatar letter={who[0]} color={who[1]} small />
        </span>
      )}
    </div>
  );
}

function Avatar({ letter, color, small = false }: { letter: string; color: string; small?: boolean }) {
  return (
    <span className={cn('grid shrink-0 place-items-center rounded-full font-bold text-white ring-[0.4cqw] ring-surface', small ? 'size-[4.4cqw] text-[2.4cqw]' : 'size-[6.4cqw] text-[3.2cqw]')} style={{ background: color }}>
      {letter}
    </span>
  );
}

/* ── 5. Phone: capture on the go, reminded on WhatsApp ──────────────────── */

const PHONE_LOOP = 11600;
const PHONE_TEXT = [
  { text: 'לאסוף את הילדים', kind: null },
  { text: ' היום', kind: 'date' },
  { text: ' ב־16:30', kind: 'time' },
] as const;
const P_TYPE_FROM = 1600;
const P_TYPE_MS = 80;
const P_ENDS = PHONE_TEXT.reduce<number[]>((acc, part, i) => [...acc, (acc[i - 1] ?? 0) + part.text.length], []);
const P_TOTAL = P_ENDS.at(-1)!;
const P_SEND = P_TYPE_FROM + P_TOTAL * P_TYPE_MS + 700;

export function PhoneScene({ active = true }: SceneProps) {
  const { ref, t } = useSceneClock(PHONE_LOOP, 7000, active);
  const sheet = t >= 1150 && t < P_SEND + 150;
  const count = Math.max(0, Math.min(P_TOTAL, Math.floor((t - P_TYPE_FROM) / P_TYPE_MS)));
  const saved = t >= P_SEND + 350 && t < PHONE_LOOP - 800;
  const notice = t >= P_SEND + 2000 && t < P_SEND + 5600;

  const finger =
    t < P_SEND - 700
      ? { x: 13.5, y: 86.8, pressed: between(t, 900, 1150), visible: between(t, 300, 1500) }
      : { x: 10.5, y: 64.5, pressed: between(t, P_SEND - 150, P_SEND + 100), visible: between(t, P_SEND - 700, P_SEND + 450) };

  return (
    <div className="mx-auto w-[min(80vw,19rem)]">
      <div ref={ref} data-scene="phone" data-loop={PHONE_LOOP} role="img" aria-label="הדגמה בטלפון: לוחצים על כפתור ההוספה, כותבים ״לאסוף את הילדים היום ב־16:30״, המשימה נשמרת, ובהמשך מגיעה תזכורת בוואטסאפ." className="rounded-[3rem] bg-ink p-[0.6rem] shadow-pop">
        <div aria-hidden className="@container relative aspect-[9/19.5] select-none overflow-hidden rounded-[2.5rem] bg-paper">
          {/* Status bar and island */}
          <div className="flex h-[11cqw] items-center justify-between px-[8cqw] pt-[2cqw] text-[3.8cqw] font-bold text-ink">
            <span className="num">9:41</span>
            <span className="h-[6.5cqw] w-[26cqw] rounded-full bg-ink" />
            <span className="flex gap-[1cqw]">
              <span className="h-[3cqw] w-[5.5cqw] rounded-[1cqw] border-[0.5cqw] border-ink" />
            </span>
          </div>

          <div className="px-[6cqw] pt-[5cqw]">
            <p className="text-[9cqw] font-extrabold leading-none text-ink">היום</p>
            <p className="mt-[2cqw] text-[3.6cqw] text-muted">יום ראשון · {saved ? 4 : 3} משימות</p>
          </div>

          <div className="mt-[3cqw] px-[6cqw]">
            <Collapse open={saved}>
              <div className={cn('rounded-[2cqw] transition-colors duration-1000', between(t, P_SEND + 350, P_SEND + 1400) ? 'bg-accent-soft' : 'bg-transparent')}>
                <PhoneRow title="לאסוף את הילדים" meta={<span className="num font-semibold text-accent">16:30</span>} priority={1} />
              </div>
            </Collapse>
            <PhoneRow title="לשלוח הצעת מחיר" meta={<span className="num text-accent">10:00</span>} priority={1} />
            <PhoneRow title="להתקשר למוסך" meta={<span className="text-[var(--swatch-moss)]">היום</span>} priority={3} />
            <PhoneRow title="ריצה בפארק" meta={<span className="text-[var(--swatch-moss)]">היום</span>} priority={4} />
          </div>

          {/* Add button and tab bar */}
          <span className="absolute bottom-[21cqw] left-[6cqw] grid size-[15cqw] place-items-center rounded-full bg-accent text-[var(--on-accent)] shadow-pop">
            <Plus className="size-[7cqw]" strokeWidth={2.5} />
          </span>
          <div className="absolute inset-x-0 bottom-0 flex h-[17cqw] items-start justify-around border-t-[0.3cqw] border-line bg-paper pt-[2.4cqw] text-[2.7cqw] text-muted">
            {[
              [Inbox, 'תיבה'],
              [Star, 'היום'],
              [CalendarDays, 'בקרוב'],
              [LayoutGrid, 'רשימות'],
            ].map(([Icon, label], i) => {
              const I = Icon as typeof Inbox;
              return (
                <span key={label as string} className={cn('flex flex-col items-center gap-[0.6cqw]', i === 1 && 'font-bold text-accent')}>
                  <I className="size-[5.6cqw]" />
                  {label as string}
                </span>
              );
            })}
          </div>

          {/* Composer sheet with keyboard */}
          <div className={cn('absolute inset-0 bg-scrim transition-opacity duration-300', sheet ? 'opacity-100' : 'opacity-0')} />
          <div className={cn('absolute inset-x-0 bottom-0 rounded-t-[6cqw] bg-surface shadow-pop transition-transform duration-[400ms] ease-[var(--ease-out-soft)]', sheet ? 'translate-y-0' : 'translate-y-full')}>
            <div className="flex items-center gap-[3cqw] px-[5cqw] pt-[5cqw]">
              <p className="min-h-[7cqw] flex-1 text-[5cqw] leading-[7cqw] text-ink">
                {count === 0 ? (
                  <span className="text-muted">מה צריך לעשות?</span>
                ) : (
                  PHONE_TEXT.map((part, i) => {
                    const start = i === 0 ? 0 : P_ENDS[i - 1];
                    const shown = part.text.slice(0, Math.max(0, count - start));
                    return (
                      <span key={i} className={cn('whitespace-pre transition-colors duration-300', part.kind && count >= P_ENDS[i] && 'rounded-[1cqw] bg-accent-soft text-accent')}>
                        {shown}
                      </span>
                    );
                  })
                )}
                <span className="animate-caret ms-[0.3cqw] inline-block h-[5.4cqw] w-[0.6cqw] translate-y-[0.8cqw] rounded-full bg-accent align-top" />
              </p>
              <span className={cn('grid size-[10cqw] place-items-center rounded-full text-[var(--on-accent)] transition-colors', count === P_TOTAL ? 'bg-accent' : 'bg-line-strong')}>
                <Send className="size-[4.6cqw] -scale-x-100" />
              </span>
            </div>
            <div className="flex gap-[2cqw] px-[5cqw] pb-[4cqw] pt-[3cqw]">
              <span className={cn('inline-flex items-center gap-[1cqw] rounded-[1.6cqw] bg-accent-soft px-[2cqw] py-[1cqw] text-[3.3cqw] font-semibold text-accent transition-opacity duration-300', count >= P_ENDS[1] ? 'opacity-100' : 'opacity-0')}>
                <CalendarDays className="size-[3.4cqw]" />
                היום{count >= P_ENDS[2] && <> · <span className="num">16:30</span></>}
              </span>
            </div>
            {/* Keyboard */}
            <div className="grid gap-[1.6cqw] bg-surface-sunk px-[1.6cqw] pb-[9cqw] pt-[2.4cqw]">
              {[10, 9, 9].map((keys, row) => (
                <div key={row} className="flex justify-center gap-[1.4cqw]">
                  {Array.from({ length: keys }, (_, k) => (
                    <span key={k} className="h-[10cqw] w-[8.3cqw] rounded-[1.4cqw] bg-surface shadow-row" />
                  ))}
                </div>
              ))}
              <div className="flex justify-center gap-[1.4cqw]">
                <span className="h-[10cqw] w-[18cqw] rounded-[1.4cqw] bg-surface-2" />
                <span className="h-[10cqw] w-[48cqw] rounded-[1.4cqw] bg-surface shadow-row" />
                <span className="h-[10cqw] w-[18cqw] rounded-[1.4cqw] bg-surface-2" />
              </div>
            </div>
          </div>

          {/* WhatsApp reminder */}
          <div className={cn('absolute inset-x-[3cqw] top-[3cqw] z-20 flex items-start gap-[3cqw] rounded-[5cqw] bg-surface/95 p-[3.4cqw] shadow-pop ring-[0.3cqw] ring-line backdrop-blur transition-transform duration-500 ease-[var(--ease-out-soft)]', notice ? 'translate-y-0' : '-translate-y-[45cqw]')}>
            <span className="grid size-[10cqw] shrink-0 place-items-center rounded-[2.6cqw] bg-[#25d366] text-white">
              <svg viewBox="0 0 24 24" className="size-[6cqw]" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3Z" /></svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex justify-between text-[3.1cqw] text-muted">
                <b className="text-ink">סדר</b>עכשיו
              </span>
              <span className="mt-[0.6cqw] block text-[3.7cqw] font-bold leading-snug text-ink">תזכורת: לאסוף את הילדים</span>
              <span className="block text-[3.4cqw] text-ink-2">
                מתחיל בשעה <span className="num">16:30</span>
              </span>
            </span>
          </div>

          <Cursor x={finger.x} y={finger.y} pressed={finger.pressed} visible={finger.visible} touch ms={600} />
        </div>
      </div>
    </div>
  );
}

function PhoneRow({ title, meta, priority }: { title: string; meta: React.ReactNode; priority: number }) {
  return (
    <div className="flex items-start gap-[3cqw] border-b-[0.3cqw] border-line py-[3.4cqw]">
      <Circle priority={priority} className="mt-[0.4cqw] size-[5.8cqw]" />
      <div className="min-w-0">
        <p className="text-[4.5cqw] leading-tight text-ink">{title}</p>
        <p className="mt-[1cqw] text-[3.3cqw]">{meta}</p>
      </div>
    </div>
  );
}

/* ── 6. Appearance: accents and dark mode ───────────────────────────────── */

const LOOKS = [
  { accent: 'red', dark: false },
  { accent: 'teal', dark: false },
  { accent: 'violet', dark: false },
  { accent: 'blue', dark: true },
  { accent: 'pink', dark: true },
] as const;
const SWATCHES = ['red', 'indigo', 'violet', 'blue', 'teal', 'green', 'pink', 'graphite'] as const;
const LOOK_MS = 1500;

export function ThemeScene({ active = true }: SceneProps) {
  const { ref, t } = useSceneClock(LOOKS.length * LOOK_MS, 0, active);
  const look = LOOKS[Math.floor(t / LOOK_MS) % LOOKS.length];

  return (
    <SceneFrame sceneRef={ref} name="theme" loop={LOOKS.length * LOOK_MS} label="הדגמה: אותו מסך בצבעים שונים ובמצב כהה." className="aspect-[1.4]">
      <div
        data-accent={look.accent}
        className="scene-accent absolute inset-x-[6cqw] top-[6cqw] flex h-[50cqw] overflow-hidden rounded-[3cqw] bg-paper shadow-pop ring-[0.3cqw] ring-line transition-colors duration-500"
        style={{ colorScheme: look.dark ? 'dark' : 'light' }}
      >
        <div className="w-[34cqw] shrink-0 space-y-[1.4cqw] border-e-[0.3cqw] border-line bg-surface-2 p-[3cqw] transition-colors duration-500">
          <p className="mb-[2.4cqw] text-[3.8cqw] font-extrabold text-ink">סדר</p>
          <p className="flex items-center gap-[1.4cqw] text-[3cqw] font-bold text-accent transition-colors duration-500">
            <Plus className="size-[3.4cqw]" /> הוספת משימה
          </p>
          {[
            [Search, 'חיפוש', false],
            [Inbox, 'תיבה נכנסת', false],
            [Star, 'היום', true],
            [CalendarDays, 'בקרוב', false],
          ].map(([Icon, label, on]) => {
            const I = Icon as typeof Inbox;
            return (
              <p key={label as string} className={cn('flex items-center gap-[1.4cqw] rounded-[1.4cqw] px-[1.2cqw] py-[1cqw] text-[2.9cqw] transition-colors duration-500', on ? 'bg-accent-soft font-bold text-accent' : 'text-ink-2')}>
                <I className="size-[3.2cqw]" /> {label as string}
              </p>
            );
          })}
        </div>
        <div className="flex-1 p-[3.4cqw]">
          <p className="text-[4.6cqw] font-extrabold text-ink">היום</p>
          {['לשלוח הצעת מחיר', 'להתקשר למוסך', 'ריצה בפארק'].map((title, i) => (
            <div key={title} className="flex items-center gap-[2cqw] border-b-[0.25cqw] border-line py-[2.2cqw]">
              <span className={cn('size-[3.8cqw] shrink-0 rounded-full border-[0.4cqw] transition-colors duration-500', i === 0 ? 'border-accent' : 'border-line-strong')} />
              <span className="text-[3.1cqw] text-ink">{title}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-[6cqw] flex justify-center gap-[2.2cqw]">
        {SWATCHES.map((accent) => (
          <span
            key={accent}
            data-accent={accent}
            className={cn('accent-swatch size-[6cqw] rounded-full ring-offset-[0.6cqw] ring-offset-paper transition-shadow duration-300', look.accent === accent ? 'ring-[0.6cqw] ring-ink' : '')}
          />
        ))}
      </div>
    </SceneFrame>
  );
}
