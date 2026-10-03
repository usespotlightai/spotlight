import { type ReactNode, useId } from 'react';
import { FieldInput } from '@/components/shared/form/FieldInput';
import {
  CEILING_AMOUNT_LABEL,
  CEILING_LABEL,
  CURRENCY_LABEL,
} from '@/lib/form-words';

type CeilingFieldProps = {
  amount: string;
  currency: string;
  onAmount: (amount: string) => void;
  onCurrency: (currency: string) => void;
  placeholder: string;
  note: ReactNode;
  problem: string | null;
  disabled: boolean;
};

export function CeilingField({
  amount,
  currency,
  onAmount,
  onCurrency,
  placeholder,
  note,
  problem,
  disabled,
}: CeilingFieldProps) {
  const amountId = useId();
  const currencyId = useId();
  const problemId = useId();

  return (
    <div data-slot="ceiling-field" className="flex flex-col gap-1.5">
      <span className="font-medium text-foreground text-xs">
        {CEILING_LABEL}
      </span>
      <div className="flex gap-2">
        <label htmlFor={amountId} className="sr-only">
          {CEILING_AMOUNT_LABEL}
        </label>
        <FieldInput
          id={amountId}
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={problem !== null}
          aria-describedby={problem ? problemId : undefined}
          value={amount}
          onChange={(event) => onAmount(event.target.value)}
        />
        <label htmlFor={currencyId} className="sr-only">
          {CURRENCY_LABEL}
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
      <p className="text-muted-foreground text-xs leading-5">{note}</p>
      {problem && (
        <p id={problemId} role="alert" className="text-destructive text-xs">
          {problem}
        </p>
      )}
    </div>
  );
}
