import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PERCENTILES, type Percentile } from '@/lib/insights-shipping';

type PercentilePickerProps = {
  value: Percentile;
  onChange: (percentile: Percentile) => void;
};

export function PercentilePicker({ value, onChange }: PercentilePickerProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Percentile"
        className="flex h-6 items-center gap-1 rounded-md border border-border bg-background px-1.5 text-[0.7rem] outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 data-[popup-open]:bg-muted"
      >
        {value}
        <ChevronDown aria-hidden className="size-3 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4} className="min-w-24">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => onChange(next as Percentile)}
        >
          {PERCENTILES.map((percentile) => (
            <DropdownMenuRadioItem
              key={percentile}
              value={percentile}
              className="text-xs"
            >
              {percentile}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
