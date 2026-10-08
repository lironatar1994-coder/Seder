import { cn } from '@/lib/cn';

/**
 * Settings layout primitives.
 *
 * Rows with hairline rules rather than a stack of cards: a card per setting
 * makes every option look like a separate destination, when what the eye wants
 * is one scannable column of label-and-control. Label and description sit on
 * the reading edge, the control on the far side, and they stack on a phone
 * where side-by-side would squeeze both.
 */

export function SettingsSection({
  title,
  description,
  hideTitle = false,
  children,
}: {
  title: string;
  description?: string;
  /** For a page already named by its h1; the section keeps an accessible label. */
  hideTitle?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={hideTitle ? title : undefined} className="pt-10 first:pt-2">
      {!hideTitle && <h2 className="text-base font-bold text-ink">{title}</h2>}
      {description && (
        <p className={cn('max-w-prose text-sm text-muted', hideTitle ? 'mb-1' : 'mt-1')}>
          {description}
        </p>
      )}
      <div className={cn(!hideTitle && 'border-bs border-line', hideTitle && !description ? '' : 'mt-4')}>
        {children}
      </div>
    </section>
  );
}

export function SettingRow({
  label,
  description,
  htmlFor,
  children,
  align = 'center',
  control = 'fixed',
}: {
  label: string;
  description?: React.ReactNode;
  /** Makes the whole label clickable for the control it names. */
  htmlFor?: string;
  children?: React.ReactNode;
  /** `start` for rows whose control is taller than one line. */
  align?: 'center' | 'start';
  /** Most controls share one column width so they line up down the page.
   *  `auto` is for the few that have their own natural size. */
  control?: 'fixed' | 'auto';
}) {
  const Label = htmlFor ? 'label' : 'div';

  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-be border-line py-4',
        'sm:flex-row sm:gap-6',
        align === 'center' ? 'sm:items-center' : 'sm:items-start',
      )}
    >
      <Label
        {...(htmlFor ? { htmlFor } : {})}
        className={cn('min-w-0 flex-1', htmlFor && 'cursor-pointer')}
      >
        <span className="block text-base font-semibold text-ink">{label}</span>
        {description && (
          <span className="mt-0.5 block max-w-prose text-sm leading-relaxed text-muted">
            {description}
          </span>
        )}
      </Label>
      {children && (
        <div className={cn('shrink-0', control === 'fixed' && 'sm:w-72')}>{children}</div>
      )}
    </div>
  );
}

/** The one place in the app where an action is irreversible, marked as such. */
export function DangerRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-p1/25 bg-p1/4 p-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-p1">{label}</p>
        <p className="mt-0.5 max-w-prose text-sm leading-relaxed text-muted">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/** Confirmation that a change landed, without a toast for something the user
 *  is already looking at. */
export function SavedNote({ show, children = 'נשמר' }: { show: boolean; children?: string }) {
  if (!show) return null;
  return (
    <span role="status" className="text-sm font-semibold text-[var(--notice)]">
      {children}
    </span>
  );
}
