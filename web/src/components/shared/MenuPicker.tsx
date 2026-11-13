import { ChevronDown } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type PickerOption = {
  readonly id: string;
  readonly label: string;
  readonly short?: string;
  readonly hint?: string;
};

const BADGE =
  'rounded bg-muted px-1.5 py-0.5 text-muted-foreground text-xs tabular-nums';

type MenuPickerProps = {
  label: string;
  value: string;
  options: readonly PickerOption[];
  selected: PickerOption;
  onChange: (id: string) => void;
};

export function MenuPicker({
  label,
  value,
  options,
  selected,
  onChange,
}: MenuPickerProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        title={selected.label}
        className="flex h-7 min-w-0 max-w-full items-center gap-2 whitespace-nowrap rounded-md border border-border px-2 text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 data-[popup-open]:bg-accent"
      >
        {selected.short && (
          <span className={`shrink-0 ${BADGE}`}>{selected.short}</span>
        )}
        <span
          className={
            selected.short
              ? 'hidden min-w-0 truncate text-foreground @xl/pane:inline'
              : 'min-w-0 truncate text-foreground'
          }
        >
          {selected.label}
        </span>
        <ChevronDown
          className="size-3 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={6} className="min-w-52">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => onChange(String(next))}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.id} value={option.id}>
              {option.short && (
                <span className={`w-9 shrink-0 text-center ${BADGE}`}>
                  {option.short}
                </span>
              )}
              {option.hint ? (
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{option.label}</span>
                  <span className="text-muted-foreground text-xs">
                    {option.hint}
                  </span>
                </span>
              ) : (
                <span className="truncate">{option.label}</span>
              )}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
