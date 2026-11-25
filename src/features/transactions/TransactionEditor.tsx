import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Dialog } from '@/components/ui/Overlay';
import { Button } from '@/components/ui/Button';
import { Field, Input, MoneyInput, Select, Textarea } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Controls';
import { CategoryGlyph } from '@/components/ui/Icon';
import { transactionForm, type TransactionFormValues } from '@/schemas';
import { useUI } from '@/store/ui';
import { useFinance } from '@/store/finance';
import { useUserData } from '@/hooks/useData';
import { useMoney } from '@/hooks/useMoney';
import { PAYMENT_METHODS, FREQUENCIES } from '@/constants/options';
import { minorToDecimalString, parseMoney } from '@/utils/money';
import { todayISO } from '@/utils/dates';
import { cn } from '@/utils/cn';
import type { TxType } from '@/types';

const TYPE_TONE: Record<TxType, string> = { expense: 'var(--neg)', income: 'var(--pos)', transfer: 'var(--info)' };

/**
 * One editor for income, expenses and transfers. Amount is typed in the *display*
 * currency and converted to the base currency on save (integer minor units).
 */
export function TransactionEditor() {
  const { open, editing, draft } = useUI((s) => s.txEditor);
  const close = useUI((s) => s.closeTxEditor);
  const toast = useUI((s) => s.toast);
  const { cats, accts } = useUserData();
  const { symbol, toDisplay, fromDisplay, fmt } = useMoney();
  const add = useFinance((s) => s.addTransaction);
  const update = useFinance((s) => s.updateTransaction);
  const addRecurring = useFinance((s) => s.addRecurring);
  const pushEvent = useFinance((s) => s.pushEvent);

  const activeAccts = accts.filter((a) => !a.archived);
  const defaults = useMemo<TransactionFormValues>(() => {
    const src = editing ?? draft;
    return {
      type: src?.type ?? 'expense',
      title: src?.title ?? '',
      amount: src?.amount ? minorToDecimalString(toDisplay(src.amount)) : '',
      date: src?.date ?? todayISO(),
      categoryId: src?.categoryId ?? '',
      accountId: src?.accountId ?? activeAccts[0]?.id ?? '',
      toAccountId: src?.toAccountId ?? '',
      paymentMethod: src?.paymentMethod ?? 'card',
      tags: src?.tags?.join(', ') ?? '',
      notes: src?.notes ?? '',
      repeat: 'none',
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, draft]);

  const { register, handleSubmit, control, watch, reset, setValue, formState } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionForm),
    defaultValues: defaults,
    mode: 'onTouched',
  });
  useEffect(() => {
    if (open) reset(defaults);
  }, [open, defaults, reset]);

  const type = watch('type');
  const categoryId = watch('categoryId');
  const kindCats = cats.filter((c) => !c.archived && c.kind === (type === 'income' ? 'income' : 'expense'));
  const e = formState.errors;

  const onSubmit = handleSubmit((v) => {
    const amount = fromDisplay(parseMoney(v.amount)!);
    const tags = (v.tags ?? '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 12);
    const payload = {
      type: v.type,
      title: v.title,
      amount,
      date: v.date,
      categoryId: v.type === 'transfer' ? null : v.categoryId!,
      accountId: v.accountId,
      toAccountId: v.type === 'transfer' ? v.toAccountId : undefined,
      paymentMethod: v.paymentMethod,
      tags,
      notes: v.notes || undefined,
    };
    if (editing) {
      update(editing.id, payload);
      toast({ tone: 'success', title: 'Transaction updated', body: v.title });
    } else if (v.repeat !== 'none' && v.type !== 'transfer') {
      addRecurring({
        type: v.type, title: v.title, amount, categoryId: v.categoryId!, accountId: v.accountId, paymentMethod: v.paymentMethod,
        frequency: v.repeat, interval: 1, startDate: v.date, endDate: null, autoPost: true, active: true,
      });
      toast({ tone: 'success', title: 'Recurring schedule created', body: `${v.title} repeats ${v.repeat}. Due items were posted.` });
    } else {
      add(payload);
      pushEvent({
        kind: 'transaction', severity: v.type === 'income' ? 'success' : 'info', href: '/transactions',
        title: `${v.type === 'income' ? 'Income' : v.type === 'transfer' ? 'Transfer' : 'Expense'} recorded`,
        body: `${v.title}: ${fmt(amount)}`,
      });
      toast({ tone: 'success', title: `${v.type === 'income' ? 'Income' : v.type === 'transfer' ? 'Transfer' : 'Expense'} added`, body: `${v.title}: ${fmt(amount)}` });
    }
    close();
  });

  return (
    <Dialog
      open={open}
      onClose={close}
      title={editing ? 'Edit transaction' : 'New transaction'}
      description={editing ? undefined : 'Record money in, money out, or a move between accounts.'}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="tx-form" iconRight={<ArrowRight size={15} />}>
            {editing ? 'Save changes' : 'Add transaction'}
          </Button>
        </>
      }
    >
      <form id="tx-form" onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <Segmented
              label="Transaction type"
              value={field.value}
              onChange={(v) => {
                field.onChange(v);
                setValue('categoryId', '');
              }}
              className="w-full"
              options={[
                { value: 'expense', label: 'Expense', tone: TYPE_TONE.expense },
                { value: 'income', label: 'Income', tone: TYPE_TONE.income },
                { value: 'transfer', label: 'Transfer', tone: TYPE_TONE.transfer },
              ]}
            />
          )}
        />

        <Field label="Amount" error={e.amount?.message}>
          {(p) => <MoneyInput {...p} {...register('amount')} large symbol={symbol} placeholder="0.00" data-autofocus />}
        </Field>

        <Field label="Description" error={e.title?.message}>
          {(p) => <Input {...p} {...register('title')} placeholder={type === 'income' ? 'e.g. March salary' : type === 'transfer' ? 'e.g. Move to savings' : 'e.g. Groceries at DMart'} maxLength={120} />}
        </Field>

        <AnimatePresence mode="wait" initial={false}>
          {type !== 'transfer' ? (
            <motion.div key="cat" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}>
              <fieldset>
                <legend className="mb-2 text-xs font-medium text-fg-2">Category</legend>
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4" role="radiogroup" aria-label="Category">
                  {kindCats.map((c) => {
                    const on = categoryId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setValue('categoryId', c.id, { shouldValidate: true })}
                        className={cn(
                          'flex flex-col items-center gap-1.5 rounded-[10px] border px-1 py-2.5 text-[11.5px] transition-all duration-200',
                          on ? 'border-transparent bg-surface-3 text-fg' : 'border-line text-fg-3 hover:border-line-strong hover:text-fg-2',
                        )}
                        style={on ? { boxShadow: `inset 0 0 0 1.5px ${c.color}` } : undefined}
                      >
                        <CategoryGlyph icon={c.icon} color={c.color} size={26} />
                        <span className="w-full truncate px-1 text-center">{c.name}</span>
                      </button>
                    );
                  })}
                </div>
                <AnimatePresence>{e.categoryId && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="alert" className="mt-1.5 text-xs text-neg">{e.categoryId.message}</motion.p>}</AnimatePresence>
              </fieldset>
            </motion.div>
          ) : (
            <motion.div key="xfer" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} />
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={type === 'transfer' ? 'From account' : 'Account'} error={e.accountId?.message}>
            {(p) => (
              <Select {...p} {...register('accountId')}>
                {activeAccts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {type === 'transfer' ? (
            <Field label="To account" error={e.toAccountId?.message}>
              {(p) => (
                <Select {...p} {...register('toAccountId')}>
                  <option value="">Choose…</option>
                  {activeAccts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : (
            <Field label="Payment method">
              {(p) => (
                <Select {...p} {...register('paymentMethod')}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          <Field label="Date" error={e.date?.message}>
            {(p) => <Input {...p} type="date" {...register('date')} />}
          </Field>
          {!editing && type !== 'transfer' ? (
            <Field label="Repeat" error={e.repeat?.message} hint={watch('repeat') !== 'none' ? 'Creates a schedule; past due dates post now.' : undefined}>
              {(p) => (
                <Select {...p} {...register('repeat')}>
                  <option value="none">Does not repeat</option>
                  {FREQUENCIES.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : (
            <Field label="Tags" optional hint="Comma separated">
              {(p) => <Input {...p} {...register('tags')} placeholder="travel, work" />}
            </Field>
          )}
        </div>
        {!editing && type !== 'transfer' && (
          <Field label="Tags" optional hint="Comma separated">
            {(p) => <Input {...p} {...register('tags')} placeholder="travel, work" />}
          </Field>
        )}
        <Field label="Notes" optional error={e.notes?.message}>
          {(p) => <Textarea {...p} {...register('notes')} maxLength={500} placeholder="Anything worth remembering" />}
        </Field>
      </form>
    </Dialog>
  );
}
