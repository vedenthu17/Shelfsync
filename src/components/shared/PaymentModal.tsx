import { useEffect, useState, type FormEvent } from 'react';
import type { Fine, PaymentMethod } from '@/types';
import { useLibrary } from '@/context/LibraryContext';
import { useAttempt } from '@/context/ToastContext';
import { recordPayment } from '@/domain/actions';
import { fineBalance } from '@/domain/selectors';
import { useLookups } from '@/hooks/useLookups';
import { formatCurrency, today } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { DatePicker, Input, Select } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Overlay';

const methods: PaymentMethod[] = ['Cash', 'UPI', 'Card', 'Bank Transfer'];

/** How a fine's amount was arrived at, in words. */
export function fineCalculation(fine: Fine): string {
  return fine.reason === 'damage'
    ? 'Damage charge (repair cost)'
    : `${fine.overdueDays} overdue day${fine.overdueDays === 1 ? '' : 's'} × ${formatCurrency(fine.rate)} per day`;
}

export function PaymentModal({ fine, onClose }: { fine: Fine | null; onClose: () => void }) {
  const { apply } = useLibrary();
  const attempt = useAttempt();
  const lookups = useLookups();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('Cash');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(today());

  const due = fine ? fineBalance(fine) : 0;

  useEffect(() => {
    if (!fine) return;
    setAmount(String(fineBalance(fine)));
    setMethod('Cash');
    setReference('');
    setDate(today());
  }, [fine]);

  const paying = Math.max(0, Number(amount) || 0);
  const remaining = Math.max(0, due - paying);
  const tooMuch = paying > due;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!fine) return;
    const result = attempt(
      () => apply((d) => recordPayment(d, { fineId: fine.id, amount: paying, method, reference, date })),
      (r) => `Payment of ${formatCurrency(r.payment.amount)} recorded (${r.payment.id}).`,
    );
    if (result) onClose();
  };

  return (
    <Modal
      open={!!fine}
      onClose={onClose}
      title="Record payment"
      description={fine ? `${lookups.memberName(fine.memberId)} · ${lookups.bookTitle(fine.bookId)}` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="payment-form" disabled={!paying || tooMuch}>
            Record Payment
          </Button>
        </>
      }
    >
      {fine && (
        <form id="payment-form" onSubmit={submit} className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
            <p className="eyebrow">Fine calculation</p>
            <p className="mt-1 text-sm text-slate-700">
              {fineCalculation(fine)} = <span className="font-semibold text-slate-900">{formatCurrency(fine.amount)}</span>
            </p>
            <dl className="mt-3 grid grid-cols-3 gap-3 border-t border-slate-200 pt-3 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Amount due</dt>
                <dd className="tabular font-semibold text-slate-900">{formatCurrency(due)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Paying now</dt>
                <dd className="tabular font-semibold text-emerald-700">{formatCurrency(Math.min(paying, due))}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Remaining balance</dt>
                <dd className="tabular font-semibold text-slate-900">{formatCurrency(remaining)}</dd>
              </div>
            </dl>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Amount paid (₹)"
              type="number"
              min={1}
              max={due}
              step="1"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              error={tooMuch ? `Cannot exceed ${formatCurrency(due)}.` : undefined}
              hint={fine.paid > 0 ? `${formatCurrency(fine.paid)} already paid.` : 'Enter less than the amount due for a part payment.'}
            />
            <Select label="Payment method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} options={methods} />
            <Input
              label="Transaction ID"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={method === 'Cash' ? 'Receipt number' : 'Reference number'}
            />
            <DatePicker label="Date" required value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </div>
        </form>
      )}
    </Modal>
  );
}
