import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RANGES, type Range, rangeOf } from '@/lib/range';

export function RangePicker({
  value,
  onChange,
  ranges = RANGES,
}: {
  value: string;
  onChange: (id: string) => void;
  ranges?: readonly Range[];
}) {
  const standing = rangeOf(value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Time range"
        className="flex h-7 items-center gap-2 rounded-md border border-border px-2 text-sm outline-none transition-colors hover:bg-accent data-[popup-open]:bg-accent"
      >
        <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground text-xs tabular-nums">
          {standing.short}
        </span>
        <span className="text-foreground">{standing.label}</span>
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
          {ranges.map((range) => (
            <DropdownMenuRadioItem key={range.id} value={range.id}>
              <span className="w-9 shrink-0 rounded bg-muted px-1.5 py-0.5 text-center text-muted-foreground text-xs tabular-nums">
                {range.short}
              </span>
              <span className="truncate">{range.label}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
