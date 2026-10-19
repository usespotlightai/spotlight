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
  clearable?: boolean;
  compact?: boolean;
  className?: string;
};

const NONE = '';

const COMPACT_ITEM = "py-0.5 pr-7 text-xs [&_svg:not([class*='size-'])]:size-3";

export function ChoiceSelect({
  label,
  choices,
  value,
  placeholder,
  onChange,
  disabled = false,
  clearable = true,
  compact = false,
  className,
}: ChoiceSelectProps) {
  const chosen = choices.find((each) => each.value === value);
  const item = compact ? COMPACT_ITEM : undefined;

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

      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className={
          compact
            ? 'w-max min-w-36 max-w-72'
            : 'w-max min-w-[max(var(--anchor-width),12rem)] max-w-(--available-width)'
        }
      >
        <DropdownMenuRadioGroup
          value={value ?? NONE}
          onValueChange={(next) =>
            onChange(String(next) === NONE ? null : String(next))
          }
        >
          {clearable && (
            <DropdownMenuRadioItem value={NONE} className={item}>
              {placeholder}
            </DropdownMenuRadioItem>
          )}
          {choices.map((choice) => (
            <DropdownMenuRadioItem
              key={choice.value}
              value={choice.value}
              className={item}
            >
              <span className="truncate">{choice.label}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
