import { useId } from 'react';
import { FieldInput } from '@/components/shared/form/FieldInput';

type CeilingFieldProps = {
  amount: string;
  currency: string;
  problem: string | null;
  disabled: boolean;
  onAmount: (amount: string) => void;
  onCurrency: (currency: string) => void;
};

export function CeilingField({
  amount,
  currency,
  problem,
  disabled,
  onAmount,
  onCurrency,
}: CeilingFieldProps) {
  const amountId = useId();
  const currencyId = useId();
  const problemId = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-medium text-foreground text-xs">Ceiling</span>
      <div className="flex gap-2">
        <label htmlFor={amountId} className="sr-only">
          Most it may spend
        </label>
        <FieldInput
          id={amountId}
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="20.00"
          disabled={disabled}
          aria-invalid={problem !== null}
          aria-describedby={problem ? problemId : undefined}
          value={amount}
          onChange={(event) => onAmount(event.target.value)}
        />
        <label htmlFor={currencyId} className="sr-only">
          Currency
        </label>
        <FieldInput
          id={currencyId}
          name="currency"
          autoComplete="off"
          maxLength={3}
          className="w-20 uppercase"
          disabled={disabled}
          value={currency}
          onChange={(event) => onCurrency(event.target.value.toUpperCase())}
        />
      </div>
      <p className="text-muted-foreground text-xs leading-5">
        The most the whole search may spend: its replays and its agent’s runs.
      </p>
      {problem && (
        <p id={problemId} role="alert" className="text-destructive text-xs">
          {problem}
        </p>
      )}
    </div>
  );
}
