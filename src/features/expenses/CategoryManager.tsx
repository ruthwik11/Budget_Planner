import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Dialog, ConfirmDialog } from '@/components/ui/Overlay';
import { Button, IconButton } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Controls';
import { CategoryGlyph, ICON_NAMES } from '@/components/ui/Icon';
import { useUserData } from '@/hooks/useData';
import { useFinance } from '@/store/finance';
import { useUI } from '@/store/ui';
import { categoryForm, type CategoryFormValues } from '@/schemas';
import { CATEGORY_PALETTE } from '@/constants/palette';
import { cn } from '@/utils/cn';
import type { Category, CategoryKind, IconName } from '@/types';

function CategoryDialog({ open, onClose, editing, kind }: { open: boolean; onClose: () => void; editing: Category | null; kind: CategoryKind }) {
  const add = useFinance((s) => s.addCategory);
  const update = useFinance((s) => s.updateCategory);
  const { cats } = useUserData();
  const toast = useUI((s) => s.toast);
  const { register, handleSubmit, reset, control, watch, formState, setError } = useForm<CategoryFormValues>({ resolver: zodResolver(categoryForm) });
  useEffect(() => {
    if (open) reset({ name: editing?.name ?? '', kind: editing?.kind ?? kind, icon: editing?.icon ?? 'tag', color: editing?.color ?? CATEGORY_PALETTE[cats.length % CATEGORY_PALETTE.length] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);
  const color = watch('color');
  const submit = handleSubmit((v) => {
    const dup = cats.some((c) => c.id !== editing?.id && c.kind === v.kind && c.name.toLowerCase() === v.name.toLowerCase() && !c.archived);
    if (dup) {
      setError('name', { message: 'A category with this name exists' });
      return;
    }
    if (editing) update(editing.id, { name: v.name, icon: v.icon as IconName, color: v.color });
    else add({ name: v.name, kind: v.kind, icon: v.icon as IconName, color: v.color });
    toast({ tone: 'success', title: editing ? 'Category updated' : 'Category created', body: v.name });
    onClose();
  });
  return (
    <Dialog open={open} onClose={onClose} title={editing ? 'Edit category' : `New ${kind} category`} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="cat-form">Save</Button></>}>
      <form id="cat-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <div className="flex items-end gap-3">
          <CategoryGlyph icon={watch('icon')} color={color} size={40} />
          <Field label="Name" error={formState.errors.name?.message} className="flex-1">{(p) => <Input {...p} {...register('name')} maxLength={40} data-autofocus />}</Field>
        </div>
        <Controller control={control} name="color" render={({ field }) => (
          <fieldset>
            <legend className="mb-2 text-xs font-medium text-fg-2">Colour</legend>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_PALETTE.map((c) => <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={field.value === c} onClick={() => field.onChange(c)} className={cn('size-7 rounded-full transition-transform', field.value === c ? 'scale-110 ring-2 ring-fg ring-offset-2 ring-offset-surface' : 'hover:scale-110')} style={{ background: c }} />)}
            </div>
          </fieldset>
        )} />
        <Controller control={control} name="icon" render={({ field }) => (
          <fieldset>
            <legend className="mb-2 text-xs font-medium text-fg-2">Icon</legend>
            <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
              {ICON_NAMES.map((ic) => (
                <button key={ic} type="button" aria-label={ic} aria-pressed={field.value === ic} onClick={() => field.onChange(ic)} className={cn('grid place-items-center rounded-[9px] p-1 transition-all', field.value === ic ? 'bg-surface-3 ring-1 ring-line-strong' : 'opacity-55 hover:opacity-100')}>
                  <CategoryGlyph icon={ic} color={color} size={26} />
                </button>
              ))}
            </div>
          </fieldset>
        )} />
      </form>
    </Dialog>
  );
}

/** List + CRUD for categories of one kind. Used categories are archived instead of deleted. */
export function CategoryManager({ kind, usage }: { kind: CategoryKind; usage: Map<string, number> }) {
  const { cats } = useUserData();
  const del = useFinance((s) => s.deleteCategory);
  const update = useFinance((s) => s.updateCategory);
  const toast = useUI((s) => s.toast);
  const [editing, setEditing] = useState<Category | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const list = cats.filter((c) => c.kind === kind);
  return (
    <>
      <ul className="-mx-2 flex flex-col">
        {list.map((c) => (
          <li key={c.id} className={cn('group flex items-center gap-3 rounded-[10px] px-2 py-1.5 hover:bg-surface-2', c.archived && 'opacity-50')}>
            <CategoryGlyph icon={c.icon} color={c.color} size={28} />
            <span className="flex-1 truncate text-sm">{c.name}</span>
            {c.archived ? (
              <button className="text-xs text-accent-fg" onClick={() => update(c.id, { archived: false })}>Restore</button>
            ) : (
              <>
                <Badge className="num">{usage.get(c.id) ?? 0}</Badge>
                <span className="flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <IconButton label={`Edit ${c.name}`} size="sm" onClick={() => { setEditing(c); setOpen(true); }}><Pencil size={13} /></IconButton>
                  <IconButton label={`Delete ${c.name}`} size="sm" tone="danger" onClick={() => setDeleting(c)}><Trash2 size={13} /></IconButton>
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
      <Button variant="ghost" size="sm" className="mt-2 w-full" icon={<Plus size={14} />} onClick={() => { setEditing(null); setOpen(true); }}>Add category</Button>
      <CategoryDialog open={open} onClose={() => setOpen(false)} editing={editing} kind={kind} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete “${deleting?.name}”?`}
        body="If transactions use it, the category is archived instead so history stays intact. Its budgets are removed."
        onConfirm={() => {
          if (!deleting) return;
          const r = del(deleting.id);
          toast({ tone: 'info', title: r === 'archived' ? 'Category archived' : 'Category deleted' });
        }}
      />
    </>
  );
}
