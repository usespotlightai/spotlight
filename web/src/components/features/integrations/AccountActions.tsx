import { type LucideIcon, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type AccountAction = {
  readonly label: string;
  readonly icon: LucideIcon;
  readonly onSelect: () => void;
};

type AccountActionsProps = {
  label: string;
  actions: readonly AccountAction[];
  disabled?: boolean;
};

export function AccountActions({
  label,
  actions,
  disabled = false,
}: AccountActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        disabled={disabled}
        className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 data-[popup-open]:bg-accent data-[popup-open]:text-foreground"
      >
        <MoreHorizontal aria-hidden className="size-4" />
      </DropdownMenuTrigger>

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
