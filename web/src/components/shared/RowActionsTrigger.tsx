import { MoreHorizontal } from 'lucide-react';

import { DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

type RowActionsTriggerProps = {
  label: string;
  disabled?: boolean;
};

export function RowActionsTrigger({
  label,
  disabled = false,
}: RowActionsTriggerProps) {
  return (
    <DropdownMenuTrigger
      aria-label={label}
      disabled={disabled}
      className="relative flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 data-[popup-open]:bg-accent data-[popup-open]:text-foreground pointer-coarse:after:absolute pointer-coarse:after:-inset-2"
    >
      <MoreHorizontal aria-hidden className="size-4" />
    </DropdownMenuTrigger>
  );
}
