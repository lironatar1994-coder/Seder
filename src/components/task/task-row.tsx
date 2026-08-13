'use client';

import { memo } from 'react';
import { Check, FolderInput, GripVertical, Inbox, MoreHorizontal, Trash2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/cn';
import type { TaskDTO } from '@/server/tasks/queries';
import { PRIORITIES, PRIORITY_LABELS, swatchVar, type Priority } from '@/lib/constants';
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from '@/components/ui/overlays';
import { IconButton } from '@/components/ui/button';
import {
  DeadlineChip,
  LabelChip,
  PriorityFlag,
  ProjectChip,
  RepeatChip,
  SubtaskChip,
  WhenChip,
} from './task-chips';
import { WhenMenuItems } from './when-menu';

export interface TaskRowProps {
  task: TaskDTO;
  /** Mid-completion: plays the strike and collapse before the row leaves. */
  completing?: boolean;
  /** The keyboard cursor — one row at a time, independent of the selection. */
  selected?: boolean;
  /** A selection exists, so every row offers a way into it. */
  selecting?: boolean;
  /** This row is part of that selection. */
  checked?: boolean;
  /** `range` extends from the cursor; `toggle` flips this row alone. */
  onSelect?: (task: TaskDTO, mode: 'toggle' | 'range') => void;
  /** Hide the project chip inside a project view — it is the same for every row. */
  hideProject?: boolean;
  draggable?: boolean;
  onToggle: (task: TaskDTO, done: boolean) => void;
  onOpen: (task: TaskDTO) => void;
  onDelete: (task: TaskDTO) => void;
  onPriority: (task: TaskDTO, priority: Priority) => void;
  onSchedule: (task: TaskDTO, when: { bucket: string; date?: string | null }) => void;
  /** Filing is the most common action on an Inbox row, so it lives one click
   *  deep in the row menu rather than behind opening the task. */
  onMove: (task: TaskDTO, projectId: string | null) => void;
  projects: { id: string; name: string; color: string }[];
}

export const TaskRow = memo(function TaskRow({
  task,
  completing = false,
  selected = false,
  selecting = false,
  checked = false,
  onSelect,
  hideProject = false,
  draggable = true,
  onToggle,
  onOpen,
  onDelete,
  onPriority,
  onSchedule,
  onMove,
  projects,
}: TaskRowProps) {
  const done = task.status !== 'TODO';
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !draggable || completing,
  });

  const subtasksDone = task.subtasks.filter((s) => s.status !== 'TODO').length;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-task-id={task.id}
      data-checked={checked || undefined}
      className={cn(
        'group relative flex items-start gap-3 rounded-lg border border-transparent px-2 py-2.5',
        'transition-colors duration-120',
        checked
          ? 'border-accent/40 bg-accent-soft'
          : selected
            ? 'border-line bg-surface'
            : 'hover:bg-surface',
        isDragging && 'z-10 opacity-60 shadow-pop',
        completing && 'row-collapse',
      )}
    >
      {selecting && onSelect && (
        <SelectBox task={task} checked={checked} onSelect={onSelect} />
      )}

      {draggable && !selecting && (
        <button
          type="button"
          aria-label="גרירה לסידור מחדש"
          {...attributes}
          {...listeners}
          className="absolute inset-s-[-1.25rem] inset-bs-3 hidden cursor-grab text-line-strong opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 md:block"
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
      )}

      <Checkbox task={task} done={done} completing={completing} onToggle={onToggle} />

      <button
        type="button"
        onClick={(event) => {
          // Modifier-click selects instead of opening. This is how the
          // selection is *started* — the visible checkboxes only appear once
          // one exists, so there has to be a way in from a plain list.
          if (onSelect && (event.metaKey || event.ctrlKey)) {
            onSelect(task, 'toggle');
            return;
          }
          if (onSelect && event.shiftKey) {
            onSelect(task, 'range');
            return;
          }
          onOpen(task);
        }}
        className="min-w-0 flex-1 text-start"
        aria-label={`פתיחת ${task.title}`}
      >
        <span className="relative inline-block max-w-full align-top">
          {/* dir="auto" so a task typed in English resolves its own direction
              instead of inheriting Hebrew and reordering its punctuation. */}
          <span
            dir="auto"
            className={cn(
              'block break-words text-base leading-snug',
              done || completing ? 'text-muted' : 'text-ink',
            )}
          >
            {task.title}
          </span>
          {(done || completing) && (
            <span
              aria-hidden
              className={cn(
                'absolute inset-bs-1/2 inset-s-0 h-px w-full bg-muted',
                completing && 'strike-line',
              )}
            />
          )}
        </span>

        {task.notes && (
          <span dir="auto" className="mt-0.5 line-clamp-1 block text-sm text-muted">
            {task.notes}
          </span>
        )}

        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          {task.scheduledFor && (
            <WhenChip date={task.scheduledFor} time={task.scheduledTime} muted={done} />
          )}
          {task.deadline && <DeadlineChip date={task.deadline} muted={done} />}
          {task.recurrence && <RepeatChip rule={task.recurrence} />}
          {!hideProject && task.project && (
            <ProjectChip name={task.project.name} color={task.project.color} />
          )}
          {task.subtasks.length > 0 && (
            <SubtaskChip done={subtasksDone} total={task.subtasks.length} />
          )}
          {task.labels.map((label) => (
            <LabelChip key={label.id} name={label.name} color={label.color} />
          ))}
        </span>
      </button>

      <div className="flex shrink-0 items-center gap-1 pt-0.5">
        <PriorityFlag priority={task.priority} />
        <Menu>
          <MenuTrigger asChild>
            <IconButton
              label="אפשרויות למשימה"
              className="opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100 focus-visible:opacity-100"
            >
              <MoreHorizontal className="size-4" aria-hidden />
            </IconButton>
          </MenuTrigger>
          <MenuContent className="w-56">
            <MenuLabel>מתי</MenuLabel>
            <WhenMenuItems
              onSelect={(when) => onSchedule(task, when)}
              onMore={() => onOpen(task)}
            />
            <MenuSeparator />
            <MenuSub>
              <MenuSubTrigger>
                <FolderInput className="size-4 text-muted" aria-hidden />
                <span>העברה לפרויקט</span>
              </MenuSubTrigger>
              <MenuSubContent>
                <MenuItem onSelect={() => onMove(task, null)}>
                  <Inbox className="size-4 text-muted" aria-hidden />
                  <span className="flex-1">תיבה נכנסת</span>
                  {task.projectId === null && (
                    <Check className="size-3.5 text-accent" aria-hidden />
                  )}
                </MenuItem>
                {projects.length > 0 && <MenuSeparator />}
                {projects.map((project) => (
                  <MenuItem key={project.id} onSelect={() => onMove(task, project.id)}>
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: swatchVar(project.color) }}
                    />
                    <span className="flex-1 truncate">{project.name}</span>
                    {task.projectId === project.id && (
                      <Check className="size-3.5 text-accent" aria-hidden />
                    )}
                  </MenuItem>
                ))}
              </MenuSubContent>
            </MenuSub>
            <MenuSeparator />
            <MenuLabel>עדיפות</MenuLabel>
            {PRIORITIES.map((p) => (
              <MenuItem key={p} onSelect={() => onPriority(task, p)}>
                <PriorityDot priority={p} />
                <span className="flex-1">{PRIORITY_LABELS[p]}</span>
                {task.priority === p && <Check className="size-3.5 text-accent" aria-hidden />}
              </MenuItem>
            ))}
            <MenuSeparator />
            <MenuItem onSelect={() => onDelete(task)} tone="danger">
              <Trash2 className="size-4" aria-hidden />
              מחיקה
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </li>
  );
});

/**
 * The multi-select control, shown on every row once a selection exists.
 *
 * A circle, deliberately: completion is a rounded square of the same size, and
 * it sits immediately next to this one. Marking a row for a batch and finishing
 * it are not recoverable from one another, so the two controls differ in shape
 * and size rather than only in colour.
 */
function SelectBox({
  task,
  checked,
  onSelect,
}: {
  task: TaskDTO;
  checked: boolean;
  onSelect: (task: TaskDTO, mode: 'toggle' | 'range') => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={`בחירת ${task.title}`}
      onClick={(event) => onSelect(task, event.shiftKey ? 'range' : 'toggle')}
      className={cn(
        'mt-1 inline-flex size-4 shrink-0 items-center justify-center rounded-full border',
        'transition-colors duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        checked
          ? 'border-accent bg-accent text-on-accent'
          : 'border-line-strong hover:border-accent',
      )}
    >
      {checked && <Check className="size-3" strokeWidth={3} aria-hidden />}
    </button>
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

/**
 * The completion moment.
 *
 * The fill wipes in from the inline-start — the same edge the eye starts from —
 * rather than scaling from the centre, so the gesture reads as "sweeping the
 * task away" in the reading direction.
 */
function Checkbox({
  task,
  done,
  completing,
  onToggle,
}: {
  task: TaskDTO;
  done: boolean;
  completing: boolean;
  onToggle: (task: TaskDTO, done: boolean) => void;
}) {
  const filled = done || completing;
  const ring =
    task.priority === 1
      ? 'border-p1'
      : task.priority === 2
        ? 'border-p2'
        : task.priority === 3
          ? 'border-p3'
          : 'border-line-strong';

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={filled}
      aria-label={filled ? `ביטול השלמה: ${task.title}` : `סימון כהושלם: ${task.title}`}
      onClick={() => onToggle(task, !done)}
      className={cn(
        'relative mt-0.5 grid size-5 shrink-0 place-items-center overflow-hidden rounded-md border-2',
        'transition-colors duration-120',
        filled ? 'border-accent bg-accent' : `${ring} hover:border-accent`,
      )}
    >
      <Check
        className={cn(
          'size-3 text-[var(--on-accent)] transition-opacity duration-150',
          filled ? 'opacity-100' : 'opacity-0',
        )}
        strokeWidth={3.5}
        aria-hidden
      />
    </button>
  );
}
