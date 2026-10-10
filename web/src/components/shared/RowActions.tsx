import type { LucideIcon } from 'lucide-react';
import { RowActionsTrigger } from '@/components/shared/RowActionsTrigger';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

type RowAction = {
  readonly label: string;
  readonly icon: LucideIcon;
  readonly onSelect: () => void;
};

type RowActionsProps = {
  label: string;
  actions: readonly RowAction[];
  disabled?: boolean;
};

export function RowActions({
  label,
  actions,
  disabled = false,
}: RowActionsProps) {
  return (
    <DropdownMenu>
      <RowActionsTrigger label={label} disabled={disabled} />

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-auto min-w-0"
      >
        {actions.map(({ label: named, icon: Icon, onSelect }) => (
          <DropdownMenuItem key={named} onClick={onSelect}>
            <Icon aria-hidden />
            {named}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
