import type { ReactNode, ReactElement } from 'react';

import { cn } from '@/lib/utils';

type RadioRowProps = {
  name: string;
  value: string;
  checked: boolean;
  disabled?: boolean;
  compact?: boolean;
  onChange: () => void;
  children: ReactNode;
  description?: ReactNode;
};

export function RadioRow({
  name,
  value,
  checked,
  disabled,
  compact = false,
  onChange,
  children,
  description,
}: RadioRowProps): ReactElement {
  return (
    <label
      data-slot="radio-row"
      className={cn(
        'flex cursor-pointer items-start gap-2 rounded-md px-2 text-sm transition-colors hover:bg-muted has-[:disabled]:cursor-default has-[:disabled]:opacity-60 has-[:disabled]:hover:bg-transparent',
        compact ? 'py-0.5' : 'py-1.5 has-[:checked]:bg-muted',
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="mt-1 shrink-0 accent-primary"
      />
      <span className="flex min-w-0 flex-col">
        <span className="text-foreground leading-5">{children}</span>
        {Boolean(description) && (
          <span className="text-muted-foreground text-xs">{description}</span>
        )}
      </span>
    </label>
  );
}
