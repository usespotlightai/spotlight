import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ChoiceCardProps = {
  group: string;
  value: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
  note?: ReactNode;
  children: ReactNode;
};

export function ChoiceCard({
  group,
  value,
  checked,
  disabled,
  onChange,
  note,
  children,
}: ChoiceCardProps) {
  return (
    <label
      data-slot="choice-card"
      className={cn(
        'flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors',
        checked ? 'border-input bg-accent' : 'border-border hover:bg-accent',
        disabled && 'cursor-default opacity-60 hover:bg-transparent',
      )}
    >
      <input
        type="radio"
        name={group}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
        className="mt-1 accent-foreground"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-2">{children}</span>
        {note && <span className="text-muted-foreground text-xs">{note}</span>}
      </span>
    </label>
  );
}
