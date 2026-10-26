import { ChevronDown, ChevronsUpDown } from 'lucide-react';
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
  toolbar?: boolean;
  input?: boolean;
  className?: string;
};

const NONE = '';

const LOOKS = {
  field: {
    trigger: 'h-8 gap-2 rounded-full bg-card px-3 text-xs',
    chevron: 'size-3',
    Chevron: ChevronsUpDown,
    menu: 'w-max min-w-[max(var(--anchor-width),12rem)] max-w-(--available-width)',
    item: undefined,
  },
  compact: {
    trigger: 'h-6 gap-1 rounded-full bg-card px-2 text-[0.7rem]',
    chevron: 'size-2.5',
    Chevron: ChevronsUpDown,
    menu: 'w-max min-w-36 max-w-72',
    item: "py-0.5 pr-7 text-xs [&_svg:not([class*='size-'])]:size-3",
  },
  toolbar: {
    trigger: 'h-7 gap-2 rounded-md px-2 text-sm',
    chevron: 'size-3',
    Chevron: ChevronDown,
    menu: 'w-max min-w-52 max-w-72',
    item: undefined,
  },
  input: {
    trigger:
      'h-9 w-full gap-2 rounded-md border-[0.5px] bg-card px-2.5 text-sm',
    chevron: 'size-3',
    Chevron: ChevronsUpDown,
    menu: 'w-(--anchor-width)',
    item: undefined,
  },
} as const;

export function ChoiceSelect({
  label,
  choices,
  value,
  placeholder,
  onChange,
  disabled = false,
  clearable = true,
  compact = false,
  toolbar = false,
  input = false,
  className,
}: ChoiceSelectProps) {
  const chosen = choices.find((each) => each.value === value);
  const look =
    LOOKS[
      toolbar ? 'toolbar' : compact ? 'compact' : input ? 'input' : 'field'
    ];
  const { item, Chevron } = look;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${label}: ${chosen?.label ?? placeholder}`}
        disabled={disabled}
        className={cn(
          'flex min-w-0 items-center border border-border text-left outline-none transition-colors hover:bg-accent disabled:opacity-50 data-[popup-open]:bg-accent',
          look.trigger,
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
        <Chevron
          aria-hidden
          className={cn('ml-auto shrink-0 text-muted-foreground', look.chevron)}
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={6} className={look.menu}>
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
