'use client';

import { useState, useTransition } from 'react';
import { MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { SWATCHES, SWATCH_LABELS, swatchVar, type Swatch } from '@/lib/constants';
import { IconButton, Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from '@/components/ui/overlays';
import { useToast } from '@/components/ui/toast';
import {
  createSectionAction,
  deleteProjectAction,
  renameProjectAction,
} from '@/server/organization/actions';

export function ProjectMenu({
  project,
}: {
  project: { id: string; name: string; color: string };
}) {
  const [sectionOpen, setSectionOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sectionName, setSectionName] = useState('');
  const [name, setName] = useState(project.name);
  const [color, setColor] = useState<Swatch>((project.color as Swatch) ?? 'teal');
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) after?.();
      else toast({ message: result.error ?? 'הפעולה נכשלה', tone: 'error' });
    });

  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <IconButton label="אפשרויות לפרויקט">
            <MoreHorizontal className="size-4" aria-hidden />
          </IconButton>
        </MenuTrigger>
        <MenuContent align="end" className="w-52">
          <MenuItem
            onSelect={() => {
              setName(project.name);
              setColor((project.color as Swatch) ?? 'teal');
              setRenameOpen(true);
            }}
          >
            <Pencil className="size-4" aria-hidden />
            שינוי שם וצבע
          </MenuItem>
          <MenuItem onSelect={() => setSectionOpen(true)}>
            <Plus className="size-4" aria-hidden />
            קטע חדש
          </MenuItem>
          <MenuSeparator />
          <MenuItem tone="danger" onSelect={() => setConfirmOpen(true)}>
            <Trash2 className="size-4" aria-hidden />
            מחיקת הפרויקט
          </MenuItem>
        </MenuContent>
      </Menu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent title="שינוי שם וצבע" description={`הפרויקט ״${project.name}״.`}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              run(() => renameProjectAction(project.id, { name, color }), () =>
                setRenameOpen(false),
              );
            }}
            className="space-y-5"
          >
            <div className="space-y-1.5">
              <Label htmlFor="project-rename">שם</Label>
              <Input
                id="project-rename"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-ink-2">צבע</legend>
              <div className="flex flex-wrap gap-2">
                {SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    onClick={() => setColor(swatch)}
                    aria-pressed={color === swatch}
                    aria-label={SWATCH_LABELS[swatch]}
                    title={SWATCH_LABELS[swatch]}
                    className={cn(
                      'size-7 rounded-full ring-offset-2 ring-offset-[var(--surface)] transition-shadow',
                      color === swatch && 'ring-2 ring-ink',
                    )}
                    style={{ backgroundColor: swatchVar(swatch) }}
                  />
                ))}
              </div>
            </fieldset>

            <DialogFooter>
              <Button type="submit" disabled={!name.trim() || pending}>
                שמירה
              </Button>
              <Button variant="ghost" onClick={() => setRenameOpen(false)}>
                ביטול
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={sectionOpen} onOpenChange={setSectionOpen}>
        <DialogContent title="קטע חדש" description="כותרת שמחלקת את הפרויקט לשלבים.">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              run(() => createSectionAction({ projectId: project.id, name: sectionName }), () => {
                setSectionOpen(false);
                setSectionName('');
              });
            }}
            className="space-y-5"
          >
            <div className="space-y-1.5">
              <Label htmlFor="section-name">שם הקטע</Label>
              <Input
                id="section-name"
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                placeholder="למשל: לפני ההשקה"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={!sectionName.trim() || pending}>
                הוספת קטע
              </Button>
              <Button variant="ghost" onClick={() => setSectionOpen(false)}>
                ביטול
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent
          title={`למחוק את ״${project.name}״?`}
          description="הפרויקט וכל המשימות שבתוכו יימחקו. אי אפשר לשחזר."
        >
          <DialogFooter>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() => run(() => deleteProjectAction(project.id))}
            >
              {pending ? 'מוחקים…' : 'מחיקה'}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
