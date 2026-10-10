import { useId } from 'react';
import { cn } from '@/lib/utils';

type InviteEmailsFieldProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  invalid: readonly string[];
  disabled: boolean;
};

export function InviteEmailsField({
  value,
  onChange,
  onBlur,
  invalid,
  disabled,
}: InviteEmailsFieldProps) {
  const fieldId = useId();
  const hintId = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="font-medium text-foreground text-xs">
        Email addresses
      </label>

      <textarea
        id={fieldId}
        name="emails"
        rows={3}
        spellCheck={false}
        autoComplete="off"
        placeholder="ada@example.com, grace@example.com"
        aria-describedby={hintId}
        aria-invalid={invalid.length > 0 || undefined}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        className="min-h-20 w-full resize-y rounded-md border-[0.5px] border-border bg-background px-2.5 py-1.5 text-foreground text-sm outline-none placeholder:text-muted-foreground focus-visible:border-input aria-invalid:border-destructive"
      />

      <p
        id={hintId}
        aria-live="polite"
        className={cn(
          'text-xs',
          invalid.length > 0 ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        {invalid.length > 0
          ? `Not an email address: ${invalid.join(', ')}`
          : 'Separate addresses with commas or new lines.'}
      </p>
    </div>
  );
}
