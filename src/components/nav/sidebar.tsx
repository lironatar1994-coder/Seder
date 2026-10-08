'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Bookmark, CalendarRange, ChevronDown, ChevronLeft, Hash, FolderKanban, LogOut, PanelRightClose, PanelRightOpen, Plus, Search, Settings, SlidersHorizontal, Tag, Timer, Users, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { swatchVar } from '@/lib/constants';
import type { SidebarData } from '@/server/tasks/queries';
import { IconButton } from '@/components/ui/button';
import { BrandMark } from '@/components/brand/brand-mark';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/overlays';
import { RollingNumber } from '@/components/ui/rolling-number';
import { useRail } from './use-rail';
import { ThemeToggle } from './theme-toggle';
import { NewProjectDialog } from './new-project-dialog';
import { requestCompose } from '@/components/task/compose-bus';
import { COLLECTIONS_LABEL, NAVIGATION_VIEWS, taskCountLabel } from './navigation-model';

type SectionKey = 'projects' | 'filters' | 'labels';
const STORAGE_KEY = 'seder-nav-sections';
const DEFAULT_SECTIONS = { projects: true, filters: true, labels: false };

/* navigation-20261008: Daily lists lead; projects provide context; utilities stay
   secondary. Assistant, neutral surfaces, semantic icons and a quiet selected
   row inherit Seder. Desktop pins the daily lists while collections scroll.
   Mobile keeps Inbox/Today/Upcoming/Browse and separate capture. Disclosure is
   persistent and the active collection opens on navigation. */
export function Sidebar({ data, user, onLogout }: { data: SidebarData; user: { name: string; email: string }; onLogout: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { collapsed, toggle } = useRail();
  const drawerRef = useRef<HTMLElement>(null);
  const currentFilterId = searchParams.get('id');
  const activeSection: SectionKey | null = pathname.includes('/project/') ? 'projects' : pathname.includes('/label/') ? 'labels' : pathname === '/app/filters' && currentFilterId ? 'filters' : null;
  const [sections, setSections] = useState(() => ({ ...DEFAULT_SECTIONS, ...(activeSection ? { [activeSection]: true } : {}) }));
  const ownProjects = data.projects.filter(project => !project.joined);
  const sharedProjects = data.projects.filter(project => project.joined);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return;
      setSections(current => Object.fromEntries(Object.entries(current).map(([key, value]) => [key, key === activeSection ? true : typeof saved[key] === 'boolean' ? saved[key] : value])) as typeof DEFAULT_SECTIONS);
    } catch {}
    // Stored preferences are read once; route changes open their collection below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    setOpen(false);
    if (activeSection) setSections(current => ({ ...current, [activeSection]: true }));
  }, [pathname, activeSection, currentFilterId]);
  function toggleSection(key: SectionKey) {
    setSections(current => {
      const next = { ...current, [key]: !current[key] };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }
  function compose() {
    setOpen(false);
    if (!requestCompose()) router.push('/app/inbox?compose=1');
  }
  useEffect(() => {
    const browse = () => setOpen(value => !value);
    const close = () => setOpen(false);
    window.addEventListener('seder:browse', browse);
    window.addEventListener('seder:browse-close', close);
    return () => { window.removeEventListener('seder:browse', browse); window.removeEventListener('seder:browse-close', close); };
  }, []);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('seder:browse-state', { detail: open }));
    if (!open) return;
    const drawer = drawerRef.current;
    const main = document.querySelector<HTMLElement>('main');
    if (main) main.inert = true;
    drawer?.querySelector<HTMLButtonElement>('[aria-label="סגירה"]')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement | null)?.closest('[role=dialog],[role=menu]')) return;
      if (event.key === 'Escape') { setOpen(false); document.querySelector<HTMLButtonElement>('[data-browse-trigger]')?.focus(); }
      if (event.key !== 'Tab' || !drawer) return;
      const elements = [...drawer.querySelectorAll<HTMLElement>('a[href],button:not([disabled])'), ...document.querySelectorAll<HTMLElement>('.tab-bar a,.tab-bar button')].filter(item => item.getClientRects().length > 0 && getComputedStyle(item).visibility !== 'hidden');
      const first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); if (main) main.inert = false; };
  }, [open]);
  function projectRows(projects: SidebarData['projects']) {
    return <ul className="space-y-0.5">{projects.map(project => <li key={project.id}>
      <NavLink href={`/app/project/${project.id}`} label={project.name} active={pathname === `/app/project/${project.id}`} description={`${taskCountLabel(project.openCount)}${project.memberCount ? project.joined ? ", שותף איתכם" : ", פרויקט משותף" : ""}`}>
        <Hash className="size-5 shrink-0" style={{ color: swatchVar(project.color) }} strokeWidth={1.7} aria-hidden />
        <span dir="auto" className="rail-label min-w-0 flex-1 truncate">{project.name}</span>
        {project.memberCount > 0 && <Users className="rail-label size-3.5 shrink-0" aria-label={project.joined ? 'שותפו איתכם' : 'משותף'} />}
        {project.openCount > 0 && <Count value={project.openCount} />}
      </NavLink>
    </li>)}</ul>;
  }
  return <>
    {open && <button type="button" aria-label="סגירת הרשימות" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-scrim md:hidden" />}
    <aside ref={drawerRef} data-open={open} aria-label="ניווט בסדר" className="rail drawer z-50 flex min-h-0 shrink-0 flex-col overflow-hidden border-e border-[var(--rail-line)] bg-[var(--rail)] text-[var(--rail-ink)] max-md:fixed max-md:inset-bs-0 max-md:inset-be-0 max-md:inset-s-0">
      <div className="rail-header flex shrink-0 items-center justify-between gap-1 px-4 pb-2 pt-3">
        <Link href="/app" className="rail-label hidden min-w-0 items-center gap-2 text-xl font-bold md:flex"><BrandMark size={24} priority />סדר</Link>
        <h2 className="text-2xl font-bold md:hidden">{COLLECTIONS_LABEL}</h2>
        <div className="flex items-center gap-1">
          <span className="rail-only-open hidden md:contents"><ThemeToggle /></span>
          <Link href="/app/settings" title="הגדרות" aria-label="הגדרות" onClick={() => setOpen(false)} className="grid size-11 place-items-center rounded-lg text-muted hover:bg-surface-2 md:hidden"><Settings className="size-5" aria-hidden /></Link>
          <IconButton label="סגירה" className="md:hidden" onClick={() => { setOpen(false); document.querySelector<HTMLButtonElement>('[data-browse-trigger]')?.focus(); }}><X className="size-5" aria-hidden /></IconButton>
          <IconButton label={collapsed ? 'פתיחת הסרגל' : 'צמצום הסרגל'} aria-expanded={!collapsed} onClick={toggle} className="hidden md:inline-flex">{collapsed ? <PanelRightOpen className="size-4" aria-hidden /> : <PanelRightClose className="size-4" aria-hidden />}</IconButton>
        </div>
      </div>
      <div className="rail-capture shrink-0 px-3 pb-3 pt-1">
        <button type="button" aria-label="הוספת משימה" className="rail-add" onClick={compose}><Plus className="size-5 shrink-0" aria-hidden /><span className="rail-label">הוספת משימה</span></button>
        <button type="button" aria-label="חיפוש" className="rail-search" onClick={() => { setOpen(false); window.dispatchEvent(new Event('seder:search')); }}><Search className="size-5 shrink-0" aria-hidden /><span className="rail-label flex-1 text-start"><span className="md:hidden">חיפוש בסדר</span><span className="hidden md:inline">חיפוש</span></span><kbd className="rail-label num text-xs">Ctrl K</kbd></button>
      </div>
      <nav aria-label="ניווט ראשי" className="rail-nav scroll-quiet min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3" onClick={event => { if ((event.target as HTMLElement).closest('a')) setOpen(false); }}>
        <div className="rail-primary" data-testid="primary-navigation">
          <ul className="space-y-0.5">{NAVIGATION_VIEWS.map(view => <li key={view.slug} className={['inbox','today','upcoming'].includes(view.slug) ? 'mobile-tab-destination' : undefined}>
            <NavLink href={view.href} label={view.label} active={pathname === view.href} description={`${taskCountLabel(data.counts[view.slug])}, ${view.hint}`}>
              <view.icon className="size-5 shrink-0" strokeWidth={1.7} style={{ color: view.color }} aria-hidden />
              <span className="rail-label min-w-0 flex-1"><span className="block truncate">{view.label}</span><span className="rail-view-hint">{view.hint}</span></span>
              {data.counts[view.slug] > 0 && <Count value={data.counts[view.slug]} />}
            </NavLink>
          </li>)}</ul>
        </div>
        <div className="rail-organize">
          <NavLink href="/app/filters" label="מסננים ותוויות" active={pathname === '/app/filters' && !searchParams.get('id')} description="חיפוש לפי תנאים ושמירת רשימות מותאמות"><SlidersHorizontal className="size-5 shrink-0" aria-hidden /><span className="rail-label">מסננים ותוויות</span></NavLink>
        </div>
        <NavSection name="פרויקטים" expanded={sections.projects} onToggle={() => toggleSection('projects')} count={data.projects.length} actions={<NewProjectDialog trigger={<IconButton label="פרויקט חדש" className="size-8"><Plus className="size-4" aria-hidden /></IconButton>} />}>
          <NavLink href="/app/projects" label="כל הפרויקטים" active={pathname === '/app/projects'}><FolderKanban className="size-5 shrink-0" aria-hidden /><span className="rail-label">כל הפרויקטים</span></NavLink>
          {sharedProjects.length > 0 && ownProjects.length > 0 && <p className="rail-label px-3 pb-1 pt-2 text-xs text-[var(--rail-muted)]">הפרויקטים שלי</p>}
          {projectRows(ownProjects)}
          {sharedProjects.length > 0 && <><p className="rail-label px-3 pb-1 pt-3 text-xs text-[var(--rail-muted)]">שותפו איתי</p>{projectRows(sharedProjects)}</>}
        </NavSection>
        {data.savedFilters.length > 0 && <NavSection name="מסננים שמורים" expanded={sections.filters} onToggle={() => toggleSection('filters')} count={data.savedFilters.length}>
          <ul className="space-y-0.5">{data.savedFilters.map(filter => <li key={filter.id}><NavLink href={`/app/filters?id=${filter.id}`} label={filter.name} active={pathname === '/app/filters' && searchParams.get('id') === filter.id}><Bookmark className="size-5 shrink-0" aria-hidden /><span className="rail-label min-w-0 flex-1 truncate">{filter.name}</span></NavLink></li>)}</ul>
        </NavSection>}
        {data.labels.length > 0 && <NavSection name="תוויות" expanded={sections.labels} onToggle={() => toggleSection('labels')} count={data.labels.length}>
          <ul className="space-y-0.5">{data.labels.map(label => <li key={label.id}><NavLink href={`/app/label/${label.id}`} label={label.name} active={pathname === `/app/label/${label.id}`}><Tag className="size-5 shrink-0" style={{ color: swatchVar(label.color) }} aria-hidden /><span className="rail-label min-w-0 flex-1 truncate">{label.name}</span></NavLink></li>)}</ul>
        </NavSection>}
        <div className="rail-utilities mt-3 border-bs border-[var(--rail-line)] pt-3">
          <NavLink href="/app/calendar" label="לוח שנה" active={pathname.startsWith('/app/calendar')}><CalendarRange className="size-5 shrink-0" aria-hidden /><span className="rail-label">לוח שנה</span></NavLink>
          <NavLink href="/app/focus" label="מיקוד ותכנון" active={pathname === '/app/focus'}><Timer className="size-5 shrink-0" aria-hidden /><span className="rail-label">מיקוד ותכנון</span></NavLink>
        </div>
      </nav>
      <div className="rail-footer shrink-0 border-bs border-[var(--rail-line)]">
      <div className="rail-mobile-capture">
        <button type="button" aria-label="הוספת משימה" onClick={compose} className="rail-create"><Plus className="size-5 shrink-0" aria-hidden /><span>הוספת משימה</span></button>
      </div>
      <div className="rail-account flex min-w-0 items-center gap-1 p-2">
        <Menu><MenuTrigger aria-label={user.name} className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 py-2 text-start hover:bg-[var(--rail-hover)]">
          <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--rail-active)] text-sm font-bold">{user.name.trim().charAt(0) || '·'}</span>
          <span className="rail-label min-w-0 flex-1 truncate text-sm font-semibold">{user.name}</span>
          <ChevronDown className="rail-label size-4 shrink-0 text-[var(--rail-muted)]" aria-hidden />
        </MenuTrigger><MenuContent align="start" side="top" className="w-60">
          <p title={user.email} className="truncate px-3 py-2 text-sm text-muted"><bdi dir="ltr">{user.email}</bdi></p><MenuSeparator />
          <MenuItem asChild><Link href="/app/settings" onClick={() => setOpen(false)}><Settings className="size-4" aria-hidden />הגדרות</Link></MenuItem><MenuSeparator />
          <MenuItem tone="danger" onSelect={() => startTransition(() => void onLogout())}><LogOut className="size-4 icon-flip" aria-hidden />יציאה</MenuItem>
        </MenuContent></Menu>
        <Link href="/app/settings" title="הגדרות" aria-label="הגדרות" aria-current={pathname.startsWith('/app/settings') ? 'page' : undefined} onClick={() => setOpen(false)} className="rail-account-settings grid size-11 shrink-0 place-items-center rounded-lg text-[var(--rail-muted)] hover:bg-[var(--rail-hover)]"><Settings className="size-5" aria-hidden /></Link>
      </div>
      </div>
    </aside>
  </>;
}

function NavLink({ href, label, active, description, children }: { href: string; label: string; active: boolean; description?: string; children: React.ReactNode }) {
  const id = useId();
  return <Link href={href} title={label} aria-label={label} aria-describedby={description ? id : undefined} aria-current={active ? 'page' : undefined} className={cn('rail-link flex min-h-10 items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors duration-120', active ? 'bg-[var(--rail-hover)] font-semibold text-[var(--rail-ink)]' : 'text-[var(--rail-ink)] hover:bg-[var(--rail-hover)]')}>
    {children}{description && <span id={id} className="sr-only">{description}</span>}
  </Link>;
}
function Count({ value }: { value: number }) {
  return <span data-count aria-hidden className="rail-label num shrink-0 text-xs text-[var(--rail-muted)]"><RollingNumber value={value} /></span>;
}
function NavSection({ name, count, expanded, onToggle, actions, children }: { name: string; count?: number; expanded: boolean; onToggle: () => void; actions?: React.ReactNode; children: React.ReactNode }) {
  const id = useId();
  return <section className="rail-section mt-3">
    <div className="flex min-h-10 items-center gap-1">
      <button type="button" aria-label={name} aria-expanded={expanded} aria-controls={id} onClick={onToggle} className="rail-section-toggle flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-md px-3 text-start text-sm font-semibold text-[var(--rail-muted)] hover:text-[var(--rail-ink)]">
        {expanded ? <ChevronDown className="size-3.5 shrink-0" aria-hidden /> : <ChevronLeft className="size-3.5 shrink-0" aria-hidden />}<span className="rail-label truncate">{name}</span>{count !== undefined && <span aria-hidden className="rail-label num text-xs font-normal">{count}</span>}
      </button><span className="rail-section-actions">{actions}</span>
    </div>
    <div id={id} hidden={!expanded} data-nav-section-content>{children}</div>
  </section>;
}
