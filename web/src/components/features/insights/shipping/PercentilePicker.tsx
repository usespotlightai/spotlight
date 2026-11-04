import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  PERCENTILES,
  type Percentile,
  percentileName,
} from '@/lib/insights-shipping';

type PercentilePickerProps = {
  value: Percentile;
  onChange: (percentile: Percentile) => void;
};

export function PercentilePicker({ value, onChange }: PercentilePickerProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Percentile"
        className="flex h-7 items-center gap-1 whitespace-nowrap rounded-lg bg-muted px-2.5 text-foreground text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 data-[popup-open]:bg-accent dark:bg-background"
      >
        {percentileName(value)}
        <ChevronDown aria-hidden className="size-3 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4} className="min-w-32">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => onChange(next as Percentile)}
        >
          {PERCENTILES.map((percentile) => (
            <DropdownMenuRadioItem
              key={percentile}
              value={percentile}
              className="text-sm"
            >
              {percentileName(percentile)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
