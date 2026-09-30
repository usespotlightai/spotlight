import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ChipRemoveButtonProps = {
  label: string;
  onRemove: () => void;
};

export function ChipRemoveButton({ label, onRemove }: ChipRemoveButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className="-mr-1 rounded-full text-muted-foreground"
      onClick={onRemove}
      aria-label={label}
    >
      <X />
    </Button>
  );
}
