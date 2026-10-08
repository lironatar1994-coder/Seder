import Link from 'next/link';
import { Bookmark, CalendarOff, ChevronLeft, Clock3, Flag, ListTodo, Plus, Tag, UserRound, Users, type LucideIcon } from 'lucide-react';
import { FILTER_PRESETS } from '@/lib/task-filters';
import { swatchVar } from '@/lib/constants';
import type { SidebarData } from '@/server/tasks/queries';
import { NewLabelForm } from './new-label-form';

const icons: Record<string, LucideIcon> = { all: ListTodo, important: Flag, overdue: Clock3, assigned: UserRound, unplanned: CalendarOff, shared: Users };

export function FilterDirectory({ data }: { data: SidebarData }) {
  return <div className="filter-directory pb-8">
    <section aria-labelledby="saved-filters-heading">
      <div className="directory-section-heading"><h2 id="saved-filters-heading">המסננים שלי</h2><Link href="/app/filters?new=1" className="directory-create"><Plus className="size-4" aria-hidden />מסנן חדש</Link></div>
      <p className="directory-help">מסנן מרכז משימות לפי תנאים, גם מפרויקטים שונים.</p>
      {data.savedFilters.length > 0 && <ul>{data.savedFilters.map(filter => <li key={filter.id}><DirectoryLink href={`/app/filters?id=${filter.id}`} name={filter.name} icon={Bookmark} /></li>)}</ul>}
    </section>
    <section aria-labelledby="suggested-filters-heading">
      <div className="directory-section-heading"><h2 id="suggested-filters-heading">רשימות שימושיות</h2></div>
      <ul>{FILTER_PRESETS.map(preset => <li key={preset.id}><DirectoryLink href={`/app/filters?preset=${preset.id}`} name={preset.name} description={preset.description} icon={icons[preset.id]} /></li>)}</ul>
    </section>
    <section aria-labelledby="labels-heading">
      <div className="directory-section-heading"><h2 id="labels-heading">תוויות</h2><NewLabelForm /></div>
      <p className="directory-help">סימון משימות שקשורות לאותו נושא, בכל פרויקט.</p>
      {data.labels.length ? <ul>{data.labels.map(label => <li key={label.id}><DirectoryLink href={`/app/label/${label.id}`} name={label.name} icon={Tag} color={swatchVar(label.color)} /></li>)}</ul> : <p className="directory-empty">תווית כמו ״טלפון״ מרכזת את כל המשימות עם הסימון הזה.</p>}
    </section>
  </div>;
}

function DirectoryLink({ href, name, description, icon: Icon, color }: { href: string; name: string; description?: string; icon: LucideIcon; color?: string }) {
  return <Link href={href} className="directory-link"><Icon className="size-5 shrink-0 text-muted" style={color ? { color } : undefined} strokeWidth={1.7} aria-hidden /><span className="min-w-0 flex-1"><span dir="auto" className="block break-words font-semibold">{name}</span>{description && <span className="directory-description">{description}</span>}</span><ChevronLeft className="size-4 shrink-0 text-muted" aria-hidden /></Link>;
}
