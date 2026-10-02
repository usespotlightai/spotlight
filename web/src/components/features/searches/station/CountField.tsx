import { useId } from 'react';
import { FieldInput } from '@/components/shared/form/FieldInput';

type CountFieldProps = {
  label: string;
  hint: string;
  value: string;
  problem: string | null;
  disabled: boolean;
  onChange: (value: string) => void;
};

export function CountField({
  label,
  hint,
  value,
  problem,
  disabled,
  onChange,
}: CountFieldProps) {
  const id = useId();
  const hintId = useId();
  const problemId = useId();

  return (
    <div data-slot="count-field" className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="font-medium text-foreground text-xs">
        {label}
      </label>
      <FieldInput
        id={id}
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        aria-invalid={problem !== null}
        aria-describedby={problem ? `${hintId} ${problemId}` : hintId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <p id={hintId} className="text-muted-foreground text-xs leading-5">
        {hint}
      </p>
      {problem && (
        <p id={problemId} role="alert" className="text-destructive text-xs">
          {problem}
        </p>
      )}
    </div>
  );
}
