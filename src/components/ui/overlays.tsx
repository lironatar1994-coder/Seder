'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { ChevronLeft, X } from 'lucide-react';
import { cn } from '@/lib/cn';

/* Radix portals mount at document.body. The DirectionProvider in the root
   layout is what makes these open on the correct side; without it every menu
   and popover would fly out to the left in an RTL page. */

/* ----------------------------------------------------------------- dialog */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  title,
  description,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  title: string;
  description?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim data-[state=open]:animate-pop-in" />
      <DialogPrimitive.Content
        className={cn(
          // `inset-0 + m-auto + h-fit` centres without transforms, so it
          // behaves identically in both directions.
          'fixed inset-0 z-50 m-auto h-fit w-[min(32rem,calc(100vw-2rem))]',
          'max-h-[calc(100dvh-2rem)] overflow-y-auto',
          'rounded-xl border border-line bg-surface p-6 shadow-pop',
          'data-[state=open]:animate-pop-in',
          className,
        )}
        {...props}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <DialogPrimitive.Title className="display text-xl text-ink">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-sm text-muted">
                {description}
              </DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
            )}
          </div>
          {/* Close sits at the inline-end: top-left in Hebrew. */}
          <DialogPrimitive.Close
            aria-label="סגירה"
            className="-me-1 -mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** Footer row. Primary sits at the inline-start, so it lands on the right in
 *  Hebrew — where the eye starts. */
export function DialogFooter({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 flex items-center gap-2">{children}</div>;
}

/* ------------------------------------------------------------------- menu */

export const Menu = DropdownPrimitive.Root;
export const MenuTrigger = DropdownPrimitive.Trigger;

export function MenuContent({
  className,
  align = 'start',
  sideOffset = 6,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-60 min-w-48 max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-pop',
          'data-[state=open]:animate-pop-in',
          className,
        )}
        {...props}
      />
    </DropdownPrimitive.Portal>
  );
}

export function MenuItem({
  className,
  tone,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Item> & { tone?: 'danger' }) {
  return (
    <DropdownPrimitive.Item
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm outline-none',
        'data-[highlighted]:bg-surface-2',
        tone === 'danger' ? 'text-p1' : 'text-ink',
        className,
      )}
      {...props}
    />
  );
}

/* Submenus. Radix flies these out toward the inline-start, which is the left in
   an LTR page and the right in Hebrew — correct in both without any help. */

export const MenuSub = DropdownPrimitive.Sub;

export function MenuSubTrigger({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.SubTrigger>) {
  return (
    <DropdownPrimitive.SubTrigger
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-ink outline-none',
        'data-[highlighted]:bg-surface-2 data-[state=open]:bg-surface-2',
        className,
      )}
      {...props}
    >
      {children}
      {/* Points the way the flyout opens — toward the inline-start, which is
          the left in Hebrew. Already the RTL glyph, so no `icon-flip`: that
          would turn it back around. */}
      <ChevronLeft className="ms-auto size-3.5 text-muted" aria-hidden />
    </DropdownPrimitive.SubTrigger>
  );
}

export function MenuSubContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.SubContent>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.SubContent
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(
          'z-60 max-h-72 min-w-44 overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-pop',
          'data-[state=open]:animate-pop-in',
          className,
        )}
        {...props}
      />
    </DropdownPrimitive.Portal>
  );
}

export function MenuSeparator() {
  return <DropdownPrimitive.Separator className="my-1 h-px bg-line" />;
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <DropdownPrimitive.Label className="px-2.5 pb-1 pt-2 text-xs font-semibold text-muted">
      {children}
    </DropdownPrimitive.Label>
  );
}

/* ---------------------------------------------------------------- popover */

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;

export function PopoverContent({
  className,
  align = 'start',
  sideOffset = 6,
  collisionPadding = 12,
  ...props
}: React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          'z-60 rounded-xl border border-line bg-surface p-3 shadow-pop',
          // Tall content — the date picker — must scroll inside the popover
          // rather than run off the bottom of the window. The custom property
          // is set by Radix from the measured space on the chosen side.
          'max-h-[var(--radix-popover-content-available-height)] overflow-y-auto',
          'data-[state=open]:animate-pop-in',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
