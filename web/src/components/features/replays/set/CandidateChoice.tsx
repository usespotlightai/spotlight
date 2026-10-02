import { Fingerprint } from '@/components/shared/Fingerprint';
import { cn } from '@/lib/utils';

type CandidateChoiceProps = {
  value: string;
  name: string;
  detail?: string;
  fingerprint?: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
};

export function CandidateChoice({
  value,
  name,
  detail,
  fingerprint,
  checked,
  disabled,
  onChange,
}: CandidateChoiceProps) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors',
        checked ? 'border-input bg-accent' : 'border-border hover:bg-accent',
        disabled && 'cursor-default opacity-60',
      )}
    >
      <input
        type="radio"
        name="candidate"
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
        className="accent-foreground"
      />
      <span className="min-w-0 flex-1 truncate text-foreground">{name}</span>
      {fingerprint && (
        <Fingerprint
          fingerprint={fingerprint}
          className="shrink-0 text-muted-foreground text-xs"
        />
      )}
      {detail && (
        <span className="hidden shrink-0 text-muted-foreground text-xs sm:inline">
          {detail}
        </span>
      )}
    </label>
  );
}
