'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookCheck,
  CalendarDays,
  CalendarRange,
  Inbox,
  Layers,
  LogOut,
  Menu as MenuIcon,
  Moon,
  Plus,
  Settings,
  Sun,
  PanelRightClose,
  PanelRightOpen,
  Tag,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { VIEWS, swatchVar, type ViewSlug } from '@/lib/constants';
import type { SidebarData } from '@/server/tasks/queries';
import { IconButton } from '@/components/ui/button';
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from '@/components/ui/overlays';
import { useRail } from './use-rail';
import { ThemeToggle } from './theme-toggle';
import { NewProjectDialog } from './new-project-dialog';

const VIEW_ICONS: Record<ViewSlug, typeof Inbox> = {
  inbox: Inbox,
  today: Sun,
  upcoming: CalendarDays,
  anytime: Layers,
  someday: Moon,
  logbook: BookCheck,
};

interface SidebarProps {
  data: SidebarData;
  user: { name: string; email: string };
  /** Server action, invoked as a form action. */
  onLogout: () => Promise<void>;
}

export function Sidebar({ data, user, onLogout }: SidebarProps) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const pathname = usePathname();
  const { collapsed, toggle } = useRail();

  return (
    <>
      {/* Mobile trigger — sits at the inline-start, the same edge the drawer
          enters from.

          It carries the current view rather than the wordmark. The wordmark is
          already on the drawer it opens, and a phone screen is too short to
          spend a line telling you which app you are in; where you are inside it
          is the thing that stops being obvious once the header scrolls away. */}
      <div className="sticky inset-bs-0 z-30 flex items-center gap-1 border-be border-line bg-paper/90 px-2 py-1.5 backdrop-blur md:hidden">
        <IconButton label="תפריט" onClick={() => setOpen(true)}>
          <MenuIcon className="size-5" aria-hidden />
        </IconButton>
        <span className="min-w-0 flex-1 truncate px-1 text-sm font-semibold text-ink-2">
          {currentPlace(pathname, data)}
        </span>
        <ThemeToggle />
      </div>

      {open && (
        <button
          type="button"
          aria-label="סגירת התפריט"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-scrim md:hidden"
        />
      )}

      <aside
        data-open={open}
        // Closed, this is hidden from the tab order and the accessibility tree
        // by `.drawer[data-open='false']` in globals.css — in CSS rather than
        // here, because the rule is already scoped to phone widths and an
        // attribute would have to wait for an effect to learn the same thing.
        className={cn(
          'rail drawer z-50 flex shrink-0 flex-col border-e text-[var(--rail-ink)]',
          'border-[var(--rail-line)] bg-[var(--rail)]',
          // Desktop: a static column at the inline-start edge (the right in
          // Hebrew). Mobile: a drawer sliding in from that same edge — the
          // physical direction of that slide is handled in globals.css, since
          // `translate-x` is physical and would not mirror on its own.
          'max-md:fixed max-md:inset-bs-0 max-md:inset-be-0 max-md:inset-s-0',
        )}
      >
        <div className="rail-header flex items-center justify-between gap-1 px-4 pb-2 pt-4">
          <Link
            href="/app"
            className="rail-label display truncate text-2xl font-bold text-[var(--rail-ink)]"
          >
            סדר
          </Link>
          <div className="flex items-center gap-1">
            <span className="rail-only-open contents">
              <ThemeToggle />
            </span>
            <IconButton label="סגירה" className="md:hidden" onClick={() => setOpen(false)}>
              <X className="size-4" aria-hidden />
            </IconButton>
            {/* Desktop only: on a phone the rail is a drawer, and a drawer that
                can also be narrow is two mental models for one panel. */}
            <IconButton
              label={collapsed ? 'פתיחת הסרגל' : 'צמצום הסרגל'}
              aria-expanded={!collapsed}
              onClick={toggle}
              className="hidden md:inline-flex"
            >
              {collapsed ? (
                <PanelRightOpen className="size-4" aria-hidden />
              ) : (
                <PanelRightClose className="size-4" aria-hidden />
              )}
            </IconButton>
          </div>
        </div>

        <nav
          aria-label="ניווט ראשי"
          className="scroll-quiet flex-1 overflow-y-auto px-2 pb-4"
          onClick={() => setOpen(false)}
        >
          <ul className="space-y-0.5">
            {VIEWS.map((view) => {
              const Icon = VIEW_ICONS[view.slug];
              const href = `/app/${view.slug}`;
              const count = data.counts[view.slug];
              return (
                <li key={view.slug}>
                  <NavLink href={href} active={pathname === href}>
                    <Icon className="size-4 shrink-0 text-[var(--rail-muted)]" aria-hidden />
                    <span className="rail-label flex-1 truncate">{view.label}</span>
                    {count > 0 && <Count value={count} />}
                  </NavLink>
                  {/* The calendar sits directly under "בקרוב": both answer
                      "when", one as a list and one as a grid. It is kept out of
                      VIEWS because it has no open-task count of its own and no
                      Ctrl+1…6 slot. */}
                  {view.slug === 'upcoming' && (
                    <div className="mt-0.5">
                      <NavLink href="/app/calendar" active={pathname.startsWith('/app/calendar')}>
                        <CalendarRange className="size-4 shrink-0 text-[var(--rail-muted)]" aria-hidden />
                        <span className="rail-label flex-1 truncate">לוח שנה</span>
                      </NavLink>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <Section
            title="פרויקטים"
            action={
              <NewProjectDialog
                trigger={
                  <IconButton label="פרויקט חדש" className="size-6">
                    <Plus className="size-3.5" aria-hidden />
                  </IconButton>
                }
              />
            }
          />
          <ul className="space-y-0.5">
            {data.projects.map((project) => {
                const href = `/app/project/${project.id}`;
                return (
                  <li key={project.id}>
                    <NavLink href={href} active={pathname === href}>
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: swatchVar(project.color) }}
                      />
                      <span className="rail-label min-w-0 flex-1 truncate">{project.name}</span>
                      {/* A shared list is worth recognising before you open it:
                          its count is everyone's work, not just yours. */}
                      {project.memberCount > 0 && (
                        <Users
                          className="rail-label size-3.5 shrink-0 text-[var(--rail-muted)]"
                          aria-label={project.joined ? 'שותפו איתכם' : 'משותף'}
                        />
                      )}
                      {project.openCount > 0 && <Count value={project.openCount} />}
                    </NavLink>
                  </li>
                );
              })}
            {data.projects.length === 0 && (
              <li className="rail-label px-3 py-1.5 text-sm text-[var(--rail-muted)]">
                עוד אין פרויקטים.
              </li>
            )}
          </ul>

          {data.labels.length > 0 && (
            <>
              <Section title="תוויות" />
              <ul className="space-y-0.5">
                {data.labels.map((label) => {
                  const href = `/app/label/${label.id}`;
                  return (
                    <li key={label.id}>
                      <NavLink href={href} active={pathname === href}>
                        <Tag
                          className="size-3.5 shrink-0"
                          style={{ color: swatchVar(label.color) }}
                          aria-hidden
                        />
                        <span className="rail-label flex-1 truncate">{label.name}</span>
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </nav>

        <div className="border-bs border-[var(--rail-line)] p-2">
          <Menu>
            <MenuTrigger className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start transition-colors hover:bg-[var(--rail-hover)]">
              <span
                aria-hidden
                className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--rail-active)] text-sm font-bold text-[var(--rail-ink)]"
              >
                {user.name.trim().charAt(0) || '·'}
              </span>
              <span className="rail-label min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-[var(--rail-ink)]">
                  {user.name}
                </span>
                {/* An email is an LTR island inside an RTL block, and those are
                    two separate jobs. `dir="ltr"` on the block did both: it
                    fixed the character order and also moved the whole line to
                    the left edge, so the address sat under the name but flush
                    to the opposite side. The block stays RTL and aligns with
                    the name; the isolation happens on an inline `bdi` inside
                    it. */}
                <span className="block truncate text-xs text-[var(--rail-muted)]">
                  <bdi dir="ltr">{user.email}</bdi>
                </span>
              </span>
            </MenuTrigger>
            <MenuContent align="start" side="top" className="w-56">
              <MenuItem asChild>
                <Link href="/app/settings">
                  <Settings className="size-4 text-muted" aria-hidden />
                  הגדרות
                </Link>
              </MenuItem>
              <MenuSeparator />
              {/* The arrow matters: Radix hands `onSelect` its own event
                  object, and passing that straight to a server action sends an
                  unserializable argument across the boundary. */}
              <MenuItem
                tone="danger"
                onSelect={() => startTransition(() => void onLogout())}
              >
                <LogOut className="size-4 icon-flip" aria-hidden />
                יציאה
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </aside>
    </>
  );
}

/**
 * Where you are, from the URL alone.
 *
 * Read off the pathname rather than threaded down from the page, because the
 * bar is a sibling of the page and every alternative — context, a store, a
 * prop drilled through the layout — would make every view responsible for
 * announcing itself to chrome it does not know about.
 */
function currentPlace(pathname: string, data: SidebarData): string {
  const view = VIEWS.find((v) => pathname === `/app/${v.slug}`);
  if (view) return view.label;
  if (pathname.startsWith('/app/calendar')) return 'לוח שנה';
  if (pathname.startsWith('/app/settings')) return 'הגדרות';

  const projectId = pathname.match(/^\/app\/project\/([^/]+)/)?.[1];
  if (projectId) return data.projects.find((p) => p.id === projectId)?.name ?? 'פרויקט';

  const labelId = pathname.match(/^\/app\/label\/([^/]+)/)?.[1];
  if (labelId) return data.labels.find((l) => l.id === labelId)?.name ?? 'תווית';

  return 'סדר';
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-120',
        // The whole row lights up, not just the label — the icon and the count
        // used to stay grey on the selected row, which read as a highlighted
        // word rather than a row that was current. The descendant selectors
        // outrank the muted colour the icons set for themselves.
        active
          ? 'bg-[var(--rail-active)] font-semibold text-[var(--rail-ink)] [&_[data-count]]:text-[var(--rail-ink)] [&_svg]:text-[var(--rail-ink)]'
          : 'text-[var(--rail-muted)] hover:bg-[var(--rail-hover)] hover:text-[var(--rail-ink)]',
      )}
    >
      {children}
    </Link>
  );
}

function Count({ value }: { value: number }) {
  return (
    <span data-count className="rail-label num shrink-0 text-xs text-[var(--rail-muted)]">
      {value}
    </span>
  );
}

function Section({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 pb-1 pt-6">
      {/* No `uppercase`: Hebrew has no case, so it does nothing here and shouts
          at any project or label someone names in Latin. */}
      <h2 className="rail-label text-xs font-bold text-[var(--rail-muted)]">{title}</h2>
      {action}
    </div>
  );
}
