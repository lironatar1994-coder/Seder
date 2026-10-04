'use client';

import { memo } from 'react';
import {
  Check,
  FolderInput,
  GripVertical,
  Inbox,
  MoreHorizontal,
  Trash2,
  UserRound,
} from 'lucide-react';
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
import { Avatar } from '@/components/ui/avatar';
import type { Collaborator } from '@/server/access';
import {
  DeadlineChip,
  LabelChip,
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
  /** Just added from the composer: holds the accent for a moment so you can see
   *  where the task you typed went. */
  landed?: boolean;
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
  /** Everyone in this task's project. Empty unless the project is shared, in
   *  which case the row gains an assignee. */
  collaborators?: Collaborator[];
  onAssign?: (task: TaskDTO, assigneeId: string | null) => void;
}

export const TaskRow = memo(function TaskRow({
  task,
  completing = false,
  landed = false,
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
  collaborators = [],
  onAssign,
}: TaskRowProps) {
  // Only worth showing where there is somebody to hand work to.
  const shared = collaborators.length > 1 && Boolean(onAssign);
  const done = task.status !== 'TODO';
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !draggable || completing,
  });

  const subtasksDone = task.subtasks.filter((s) => s.status !== 'TODO').length;

  return (
    <li
      ref={setNodeRef}
      style={{
        /* The lift has to be composed into dnd-kit's own transform, not
           declared in CSS: this inline `transform` would win over any class
           and the scale would silently never apply. */
        transform:
          isDragging && transform
            ? CSS.Transform.toString({ ...transform, scaleX: 1.012, scaleY: 1.012 })
            : CSS.Translate.toString(transform),
        transition,
      }}
      data-task-id={task.id}
      data-checked={checked || undefined}
      className={cn(
        'task-row group relative flex items-start gap-3 border border-transparent py-3',
        'transition-colors duration-120',
        checked
          ? 'border-accent/40 bg-accent-soft'
          : selected
            ? 'border-line bg-surface'
            : 'hover:bg-surface',
        isDragging && 'row-lift z-10',
        completing && 'row-collapse',
        landed && 'row-landed',
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
        // Compact rows retain a full touch target, including one-line tasks.
        className={cn(
          'relative min-w-0 flex-1 text-start',
          '[@media(pointer:coarse)]:min-h-11',
          "before:absolute before:inset-x-0 before:content-['']",
          '[@media(pointer:coarse)]:before:-inset-y-2',
        )}
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

        <span className="task-metadata mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          {task.scheduledFor && (
            <WhenChip date={task.scheduledFor} time={task.scheduledTime} muted={done} compact />
          )}
          {task.deadline && <DeadlineChip date={task.deadline} muted={done} />}
          {task.recurrence && <RepeatChip rule={task.recurrence} compact />}
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
        {shared && task.assignee && (
          <Avatar
            name={task.assignee.name}
            size="sm"
            title={`מוקצה ל${task.assignee.name}`}
            className="me-0.5"
          />
        )}
        <Menu>
          <MenuTrigger asChild>
            <IconButton
              label="אפשרויות למשימה"
              // Revealed on hover only where hover exists. On a touch screen
              // there is no hover, so this used to be a permanently invisible
              // button — and it is the only way to schedule, move, prioritise
              // or delete a task from the list.
              className={cn(
                'hidden md:inline-flex transition-opacity data-[state=open]:opacity-100 focus-visible:opacity-100',
                '[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100',
              )}
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
            {shared && (
              <>
                <MenuSeparator />
                <MenuLabel>אחראי</MenuLabel>
                <MenuItem onSelect={() => onAssign!(task, null)}>
                  <UserRound className="size-4 text-muted" aria-hidden />
                  <span className="flex-1">בלי אחראי</span>
                  {!task.assigneeId && <Check className="size-3.5 text-accent" aria-hidden />}
                </MenuItem>
                {collaborators.map((person) => (
                  <MenuItem key={person.id} onSelect={() => onAssign!(task, person.id)}>
                    <Avatar name={person.name} size="sm" decorative />
                    <span className="flex-1 truncate">{person.name}</span>
                    {task.assigneeId === person.id && (
                      <Check className="size-3.5 text-accent" aria-hidden />
                    )}
                  </MenuItem>
                ))}
              </>
            )}

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
        'relative mt-1 inline-flex size-4 shrink-0 items-center justify-center rounded-sm border',
        'transition-colors duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        "before:absolute before:content-[''] [@media(pointer:coarse)]:before:-inset-3.5",
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
          : 'border-p4';

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={filled}
      aria-label={filled ? `ביטול השלמה: ${task.title}` : `סימון כהושלם: ${task.title}`}
      aria-description={`עדיפות: ${PRIORITY_LABELS[task.priority]}`}
      title={PRIORITY_LABELS[task.priority]}
      onClick={() => onToggle(task, !done)}
      className={cn(
        'relative mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-[1.5px]',
        'transition-colors duration-120',
        // A 20px box is right for the row's density and wrong for a thumb. The
        // target extends past it on touch only; completing the wrong task is
        // the most annoying mistake this list can produce.
        "before:absolute before:content-[''] [@media(pointer:coarse)]:before:-inset-3",
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
