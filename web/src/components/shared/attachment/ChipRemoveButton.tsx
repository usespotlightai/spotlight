import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type ChipRemoveButtonProps = {
  label: string;
  onRemove: () => void;
};

export function ChipRemoveButton({ label, onRemove }: ChipRemoveButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        iconOnly
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="-mr-1 rounded-full text-muted-foreground"
            onClick={onRemove}
            aria-label={label}
          />
        }
      >
        <X />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
