'use client';

import { useEffect, useState, useTransition } from 'react';
import { MessageSquare, Send, Trash2 } from 'lucide-react';
import { addCommentAction, deleteCommentAction, getCommentsAction } from '@/server/tasks/comments';
import { Avatar } from '@/components/ui/avatar';
import { Button, IconButton } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';

type Comment = { id: string; body: string; createdAt: Date; user: { id: string; name: string }; canDelete: boolean };

export function TaskComments({ taskId }: { taskId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    let active = true;
    setLoading(true);
    setBody(''); setError(''); setComments([]);
    getCommentsAction(taskId).then((result) => {
      if (!active) return;
      if (result.ok) setComments(result.comments);
      else setError(result.error);
    }).catch(() => { if (active) setError('טעינת התגובות נכשלה. אפשר לסגור את המשימה ולפתוח שוב.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [taskId]);
  async function reload() {
    const result = await getCommentsAction(taskId);
    if (result.ok) setComments(result.comments);
    else setError(result.error);
  }
  return <section className="mt-6 border-bs border-line pt-5" data-testid="task-comments">
    <h3 className="mb-4 flex items-center gap-2 text-sm font-bold"><MessageSquare className="size-4 text-muted" aria-hidden />תגובות {comments.length > 0 && <span className="num text-muted">{comments.length}</span>}</h3>
    {loading ? <p className="text-sm text-muted">טוענים תגובות…</p> : comments.length === 0 ? <p className="mb-4 text-sm text-muted">עדכונים, שאלות וכל מה שצריך כדי להתקדם.</p> : <ul className="mb-5 space-y-4">{comments.map((comment) => <li key={comment.id} className="flex items-start gap-2.5">
      <Avatar name={comment.user.name} size="sm" decorative />
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline gap-2"><bdi className="text-sm font-semibold">{comment.user.name}</bdi><time className="text-xs text-muted" dateTime={new Date(comment.createdAt).toISOString()}>{new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Jerusalem' }).format(new Date(comment.createdAt))}</time></div><p dir="auto" className="mt-1 whitespace-pre-wrap break-words text-sm text-ink-2">{comment.body}</p></div>
      {comment.canDelete && <IconButton label="מחיקת התגובה" disabled={pending} onClick={() => startTransition(async () => { const result = await deleteCommentAction(comment.id); if (!result.ok) setError(result.error ?? 'המחיקה נכשלה'); else await reload(); })}><Trash2 className="size-3.5" aria-hidden /></IconButton>}
    </li>)}</ul>}
    <form onSubmit={(event) => { event.preventDefault(); if (!body.trim() || pending) return; setError(''); startTransition(async () => { try { const result = await addCommentAction(taskId, body); if (!result.ok) setError(result.error ?? 'התגובה לא נשמרה'); else { setBody(''); await reload(); } } catch { setError('התגובה לא נשמרה. אפשר לנסות שוב.'); } }); }}>
      <Textarea aria-label="תגובה חדשה" dir="auto" value={body} onChange={(event) => setBody(event.target.value)} maxLength={4000} rows={2} placeholder="כתיבת תגובה…" disabled={pending || loading} />
      <div className="mt-2 flex items-center justify-between gap-3"><span className="text-xs text-muted">התגובות גלויות למשתתפים בפרויקט.</span><Button size="sm" type="submit" disabled={!body.trim() || pending || loading}><Send className="size-3.5 icon-flip" aria-hidden />{pending ? 'שומרים…' : 'הוספת תגובה'}</Button></div>
      {error && <p role="alert" className="mt-2 text-sm text-p1">{error}</p>}
    </form>
  </section>;
}
