'use client';

import { useEffect, useState, useTransition } from 'react';
import { Check, Copy, LogOut, UserMinus } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';
import { Avatar } from '@/components/ui/avatar';
import { Dialog, DialogContent } from '@/components/ui/overlays';
import { useToast } from '@/components/ui/toast';
import {
  createInviteAction,
  getShareStateAction,
  leaveProjectAction,
  removeMemberAction,
  revokeInvitesAction,
  type ShareState,
} from '@/server/sharing/actions';

/**
 * Who is in a project, and how to let somebody else in.
 *
 * The invitation is a link first and an email second. Mail may not be
 * configured at all on a given deployment, and the common case — sending it to
 * someone you are already talking to — wants a link you can paste into that
 * conversation, not a second inbox to check.
 */
export function ShareDialog({
  projectId,
  projectName,
  open,
  onOpenChange,
}: {
  projectId: string;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, setState] = useState<ShareState | null>(null);
  const [email, setEmail] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  // Loaded when the dialog opens rather than with the page: most project views
  // are never shared, and this is three queries.
  useEffect(() => {
    if (!open) return;
    let live = true;
    getShareStateAction(projectId).then((next) => {
      if (live) setState(next);
    });
    return () => {
      live = false;
    };
  }, [open, projectId]);

  // A copied link is stale the moment the dialog closes on a different project.
  useEffect(() => {
    if (!open) {
      setLink(null);
      setCopied(false);
      setEmail('');
    }
  }, [open]);

  const reload = () => getShareStateAction(projectId).then(setState);

  function invite() {
    startTransition(async () => {
      const result = await createInviteAction(projectId, email || undefined);
      if (!result.ok) {
        toast({ message: result.error ?? 'לא הצלחנו ליצור הזמנה', tone: 'error' });
        return;
      }
      setLink(result.link ?? null);
      if (result.mailed) toast({ message: `ההזמנה נשלחה ל־${email}` });
      setEmail('');
      await reload();
    });
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the link is on screen and selectable,
      // so say what to do rather than pretending it worked.
      toast({ message: 'אין גישה ללוח. אפשר לסמן את הקישור ולהעתיק ידנית.', tone: 'error' });
    }
  }

  function remove(memberId: string) {
    startTransition(async () => {
      const result = await removeMemberAction(projectId, memberId);
      if (!result.ok) {
        toast({ message: result.error ?? 'הפעולה נכשלה', tone: 'error' });
        return;
      }
      toast({ message: 'הוסר מהפרויקט' });
      await reload();
    });
  }

  function leave() {
    // Redirects out of the project on success, so there is nothing to reload.
    startTransition(async () => {
      const result = await leaveProjectAction(projectId);
      if (!result.ok) toast({ message: result.error ?? 'הפעולה נכשלה', tone: 'error' });
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="שיתוף הפרויקט"
        description={`מי שמצטרף ל״${projectName}״ יכול להוסיף, לערוך ולסמן משימות. התיבה הנכנסת והתוויות שלכם נשארות פרטיות.`}
      >
        {!state ? (
          <p className="py-6 text-sm text-muted">טוענים…</p>
        ) : (
          <div className="space-y-6">
            <section>
              <h3 className="mb-2 text-sm font-semibold text-ink-2">
                בפרויקט <span className="num text-muted">({state.members.length})</span>
              </h3>
              <ul className="space-y-1">
                {state.members.map((person) => (
                    <li
                      key={person.id}
                      className="flex items-center gap-2.5 rounded-lg px-1 py-1.5"
                    >
                      <Avatar name={person.name} decorative />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink">{person.name}</span>
                        <span className="block truncate text-xs text-muted">
                          <bdi dir="ltr">{person.email}</bdi>
                        </span>
                      </span>
                      {person.isOwner ? (
                        <span className="shrink-0 rounded-md bg-surface-2 px-2 py-0.5 text-xs text-muted">
                          יוצר הפרויקט
                        </span>
                      ) : (
                        state.isOwner && (
                          <IconButton
                            label={`הסרת ${person.name}`}
                            disabled={pending}
                            onClick={() => remove(person.id)}
                          >
                            <UserMinus className="size-4" aria-hidden />
                          </IconButton>
                        )
                      )}
                    </li>
                  ))}
              </ul>
            </section>

            {state.isOwner ? (
              <section className="space-y-3 border-bs border-line pt-5">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-email">הזמנה</Label>
                  <div className="flex gap-2">
                    <Input
                      id="invite-email"
                      type="email"
                      dir="ltr"
                      inputMode="email"
                      className="text-start"
                      placeholder="אימייל (אפשר גם בלי)"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <Button onClick={invite} disabled={pending} className="shrink-0">
                      {pending ? 'רגע…' : 'יצירת קישור'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted">
                    הקישור תקף לשבוע ואפשר לשלוח אותו לכמה אנשים.
                  </p>
                </div>

                {link && (
                  <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 p-2">
                    {/* Selectable, so the link is recoverable even when the
                        clipboard is blocked. */}
                    <code
                      dir="ltr"
                      className="min-w-0 flex-1 truncate text-start text-xs text-ink-2"
                    >
                      {link}
                    </code>
                    <Button size="sm" variant="secondary" onClick={copy} className="shrink-0">
                      {copied ? (
                        <>
                          <Check className="size-3.5" aria-hidden />
                          הועתק
                        </>
                      ) : (
                        <>
                          <Copy className="size-3.5" aria-hidden />
                          העתקה
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {state.hasInvite && (
                  <button
                    type="button"
                    onClick={() =>
                      startTransition(async () => {
                        await revokeInvitesAction(projectId);
                        setLink(null);
                        await reload();
                        toast({ message: 'ההזמנות בוטלו' });
                      })
                    }
                    className="text-xs text-muted underline transition-colors hover:text-p1"
                  >
                    ביטול ההזמנות הפתוחות
                  </button>
                )}
              </section>
            ) : (
              <section className="border-bs border-line pt-5">
                <Button
                  variant="danger"
                  disabled={pending}
                  onClick={leave}
                  className="gap-2"
                >
                  <LogOut className="size-4 icon-flip" aria-hidden />
                  עזיבת הפרויקט
                </Button>
                <p className="mt-2 text-xs text-muted">
                  המשימות יישארו בפרויקט. מה שהוקצה לכם יחזור להיות פנוי.
                </p>
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
