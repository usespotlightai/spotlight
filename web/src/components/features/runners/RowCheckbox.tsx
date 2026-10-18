import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

type RowCheckboxProps = {
  label: string;
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
};

export function RowCheckbox({
  label,
  selected,
  onSelectedChange,
}: RowCheckboxProps) {
  return (
    <span className="absolute inset-y-0 left-3 flex w-4 items-center justify-center">
      <Checkbox
        checked={selected}
        onCheckedChange={onSelectedChange}
        aria-label={label}
        className={cn(
          'opacity-0 transition-opacity',
          'focus-visible:opacity-100 group-hover/host:opacity-100',
          selected && 'opacity-100',
        )}
      />
    </span>
  );
}
