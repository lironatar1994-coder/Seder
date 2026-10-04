'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/overlays';
import { Button } from '@/components/ui/button';
import { WhatsappPreview } from '@/components/settings/whatsapp-preview';
import { markWhatsappIntroductionSeenAction } from '@/server/settings/whatsapp';

export function WhatsappIntroduction({ userId, eligible, available }: {
  userId: string; eligible: boolean; available: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const key = `seder:whatsapp-introduction:${userId}`;
  const settings = pathname.includes('/settings');

  useEffect(() => {
    if (!eligible || settings) return;
    let stopped = false;
    const timer = window.setInterval(() => {
      if (stopped || document.visibilityState !== 'visible' || document.querySelector('[role="dialog"]')) return;
      try { if (localStorage.getItem(key)) { window.clearInterval(timer); return; } } catch { /* Server preference still applies. */ }
      window.clearInterval(timer);
      try { localStorage.setItem(key, 'seen'); } catch { /* Some browsers disable storage. */ }
      setOpen(true);
      void markWhatsappIntroductionSeenAction().catch(() => {});
    }, 1200);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [eligible, settings, key]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent title="התזכורת הבאה, בוואטסאפ" description="שומרים מספר ומפעילים תזכורות — סדר יזכיר לכם כשמגיע הזמן." className="p-5 sm:p-6" data-testid="whatsapp-introduction">
        <WhatsappPreview />
        {!available && <p className="mt-3 text-xs text-ink-2">השירות ממתין כרגע לחיבור מחדש. אפשר לשמור את ההעדפות בינתיים.</p>}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link href="/app/settings/whatsapp" onClick={() => setOpen(false)} className="inline-flex h-11 min-h-11 shrink-0 items-center justify-center rounded-lg bg-accent px-4 font-semibold text-[var(--on-accent)] hover:bg-accent-hover sm:flex-1">להגדרות וואטסאפ</Link>
          <Button variant="ghost" onClick={() => setOpen(false)}>לא עכשיו</Button>
        </div>
        <p className="mt-2 text-center text-xs text-muted">ההפעלה לבחירתכם. אפשר לכבות בכל רגע בהגדרות.</p>
      </DialogContent>
    </Dialog>
  );
}
