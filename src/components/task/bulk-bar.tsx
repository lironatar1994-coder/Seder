'use client';

import { Check, CircleCheck, FolderInput, Flag, Inbox, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { PRIORITIES, PRIORITY_LABELS, swatchVar, type Priority } from '@/lib/constants';
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from '@/components/ui/overlays';
import { WhenMenuItems, type WhenSelection } from './when-menu';

export interface BulkBarProps {
  count: number;
  projects: { id: string; name: string; color: string }[];
  onComplete: () => void;
  onSchedule: (when: WhenSelection) => void;
  onPriority: (priority: Priority) => void;
  onMove: (projectId: string | null) => void;
  onDelete: () => void;
  onClear: () => void;
}

/**
 * The bar that appears once more than one task is selected.
 *
 * It floats over the list rather than pushing it down: the selection is a
 * transient mode, and reflowing the rows under the cursor mid-selection is
 * exactly when a misclick costs the most.
 *
 * Centred with `justify-center` inside a full-width row rather than a
 * translate, so it sits in the same place in both directions.
 */
export function BulkBar({
  count,
  projects,
  onComplete,
  onSchedule,
  onPriority,
  onMove,
  onDelete,
  onClear,
}: BulkBarProps) {
  return (
    <div
      // Sits above the phone's tab bar rather than over it: the bar is how you
      // leave the selection, and covering it would trap you in the mode.
      className="pointer-events-none fixed inset-be-[var(--tab-bar)] inset-s-0 inset-e-0 z-30 flex justify-center p-4"
      aria-live="polite"
    >
      <div
        data-testid="bulk-bar"
        className={cn(
          'pointer-events-auto flex items-center gap-1 rounded-xl',
          'border border-line bg-surface p-1.5 ps-3.5 shadow-pop',
          'animate-fade-up',
        )}
      >
        <span className="me-1 whitespace-nowrap text-sm text-ink">
          <span className="num font-bold">{count}</span> נבחרו
        </span>

        <span aria-hidden className="mx-1 h-5 w-px bg-line" />

        <BarButton onClick={onComplete} label="השלמה">
          <CircleCheck className="size-4" aria-hidden />
        </BarButton>

        <Menu>
          <MenuTrigger asChild>
            <BarButton label="מתי">
              <CalendarGlyph />
            </BarButton>
          </MenuTrigger>
          <MenuContent className="w-52" side="top">
            <MenuLabel>מתי</MenuLabel>
            <WhenMenuItems onSelect={onSchedule} />
          </MenuContent>
        </Menu>

        <Menu>
          <MenuTrigger asChild>
            <BarButton label="עדיפות">
              <Flag className="size-4" aria-hidden />
            </BarButton>
          </MenuTrigger>
          <MenuContent className="w-52" side="top">
            <MenuLabel>עדיפות</MenuLabel>
            {PRIORITIES.map((p) => (
              <MenuItem key={p} onSelect={() => onPriority(p)}>
                <PriorityDot priority={p} />
                <span className="flex-1">{PRIORITY_LABELS[p]}</span>
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>

        <Menu>
          <MenuTrigger asChild>
            <BarButton label="העברה לפרויקט">
              <FolderInput className="size-4" aria-hidden />
            </BarButton>
          </MenuTrigger>
          <MenuContent className="w-56" side="top">
            <MenuLabel>העברה לפרויקט</MenuLabel>
            <MenuItem onSelect={() => onMove(null)}>
              <Inbox className="size-4 text-muted" aria-hidden />
              <span className="flex-1">תיבה נכנסת</span>
            </MenuItem>
            {projects.length > 0 && <MenuSeparator />}
            {projects.map((project) => (
              <MenuItem key={project.id} onSelect={() => onMove(project.id)}>
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: swatchVar(project.color) }}
                />
                <span className="flex-1 truncate">{project.name}</span>
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>

        <BarButton onClick={onDelete} label="מחיקה" tone="danger">
          <Trash2 className="size-4" aria-hidden />
        </BarButton>

        <span aria-hidden className="mx-1 h-5 w-px bg-line" />

        <BarButton onClick={onClear} label="ביטול הבחירה">
          <X className="size-4" aria-hidden />
        </BarButton>
      </div>
    </div>
  );
}

/**
 * Icon-only, but the label is the accessible name *and* the tooltip — a bar of
 * six unlabelled glyphs is unusable otherwise, and this is a destructive
 * neighbourhood.
 */
function BarButton({
  label,
  tone = 'default',
  children,
  ...props
}: React.ComponentPropsWithoutRef<'button'> & {
  label: string;
  tone?: 'default' | 'danger';
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-lg transition-colors duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        tone === 'danger'
          ? 'text-muted hover:bg-p1/10 hover:text-p1'
          : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
        'data-[state=open]:bg-surface-2 data-[state=open]:text-ink',
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** The same calendar mark the row menu uses, at bar size. */
function CalendarGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" strokeWidth="2" />
      <path d="M3 10h18M8 3v4M16 3v4" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PriorityDot({ priority }: { priority: Priority }) {
  const color =
    priority === 1
      ? 'bg-p1'
      : priority === 2
        ? 'bg-p2'
        : priority === 3
          ? 'bg-p3'
          : 'bg-line-strong';
  return <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full', color)} />;
}

/** Kept next to the bar because it only exists to guard the bar's one
 *  irreversible action. Bulk delete has no undo: restoring N rows means
 *  recreating their labels and checklists, and a half-restored batch is worse
 *  than a confirm step. */
export function bulkDeleteCopy(count: number) {
  return {
    title: `למחוק ${count} משימות?`,
    body:
      count === 1
        ? 'המשימה תימחק לצמיתות, יחד עם תת-המשימות שלה.'
        : `${count} המשימות יימחקו לצמיתות, יחד עם תת-המשימות שלהן. אי אפשר לבטל את הפעולה.`,
  };
}
