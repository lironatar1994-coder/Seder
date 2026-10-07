'use client';
import { Button } from '@/components/ui/button';

export default function AdminError({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-lg px-6 py-16"><h1 className="text-xl font-semibold">הנתונים לא נטענו</h1><p className="my-4 text-muted">אפשר לנסות לטעון אותם שוב.</p><Button onClick={reset}>טעינה מחדש</Button></main>;
}
