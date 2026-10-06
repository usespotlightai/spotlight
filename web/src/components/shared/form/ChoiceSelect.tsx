import { ChevronsUpDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type Choice = {
  readonly value: string;
  readonly label: string;
};

type ChoiceSelectProps = {
  label: string;
  choices: readonly Choice[];
  value: string | null;
  placeholder: string;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
};

const NONE = '';

export function ChoiceSelect({
  label,
  choices,
  value,
  placeholder,
  onChange,
  disabled = false,
  compact = false,
  className,
}: ChoiceSelectProps) {
  const chosen = choices.find((each) => each.value === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${label}: ${chosen?.label ?? placeholder}`}
        disabled={disabled}
        className={cn(
          'flex min-w-0 items-center rounded-full border border-border bg-card text-left outline-none transition-colors hover:bg-accent disabled:opacity-50 data-[popup-open]:bg-accent',
          compact ? 'h-6 gap-1 px-2 text-[0.7rem]' : 'h-8 gap-2 px-3 text-xs',
          className,
        )}
      >
        <span
          className={cn(
            'truncate',
            chosen ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {chosen?.label ?? placeholder}
        </span>
        <ChevronsUpDown
          aria-hidden
          className={cn(
            'ml-auto shrink-0 text-muted-foreground',
            compact ? 'size-2.5' : 'size-3',
          )}
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={6} className="min-w-48">
        <DropdownMenuRadioGroup
          value={value ?? NONE}
          onValueChange={(next) =>
            onChange(String(next) === NONE ? null : String(next))
          }
        >
          <DropdownMenuRadioItem value={NONE}>
            {placeholder}
          </DropdownMenuRadioItem>
          {choices.map((choice) => (
            <DropdownMenuRadioItem key={choice.value} value={choice.value}>
              <span className="truncate">{choice.label}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
