import { CalendarDays, Flag, Folder, Repeat, Tag } from 'lucide-react';
import type { ComposerField } from '@/lib/composer-preferences';

export const COMPOSER_FIELD_DETAILS = {
  date: { label: 'תאריך', icon: CalendarDays },
  project: { label: 'פרויקט', icon: Folder },
  priority: { label: 'עדיפות', icon: Flag },
  deadline: { label: 'מועד הגשה', icon: Flag },
  labels: { label: 'תוויות', icon: Tag },
  repeat: { label: 'חזרה', icon: Repeat },
} satisfies Record<ComposerField, { label: string; icon: typeof CalendarDays }>;
