'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { rescheduleOverdueAction } from '@/server/tasks/actions';
import type { TaskDTO } from '@/server/tasks/queries';

export function OverdueReschedule({ tasks }: { tasks: TaskDTO[] }) {
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  function reschedule() {
    const ids = tasks.map(task => task.id);
    startTransition(async () => {
      try {
        const result = await rescheduleOverdueAction(ids);
        if (!result.ok) toast({ message: result.error ?? 'התזמון לא נשמר. אפשר לנסות שוב.', tone: 'error' });
        else toast({ message: result.count === 1 ? 'המשימה תוזמנה מחדש' : `${result.count} משימות תוזמנו מחדש` });
      } catch {
        toast({ message: 'התזמון לא נשמר. אפשר לנסות שוב.', tone: 'error' });
      }
    });
  }

  return <Button variant="ghost" size="sm" disabled={pending || !tasks.length}
        onClick={reschedule}
        title="כל משימה לפי הבחירה המקורית שלה: היום, מחר או שבוע הבא"
        aria-label="תזמון מחדש של המשימות שבאיחור"
        className="h-8 px-2 text-sm font-semibold text-accent hover:bg-accent-soft hover:text-accent">
        {pending ? 'מתזמנים…' : 'תזמון מחדש'}
      </Button>;
}
