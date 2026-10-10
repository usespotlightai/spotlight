import { MoreHorizontal, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type TokenActionsProps = {
  name: string;
  onRevoke: () => void;
};

export function TokenActions({ name, onRevoke }: TokenActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${name}`}
        className="flex size-8 items-center justify-center rounded-full text-muted-foreground outline-none transition-[opacity,background-color,color] hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-hover/token:opacity-100 data-[popup-open]:bg-accent data-[popup-open]:text-foreground data-[popup-open]:opacity-100 [@media(hover:hover)]:opacity-0"
      >
        <MoreHorizontal aria-hidden className="size-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-auto min-w-0"
      >
        <DropdownMenuItem onClick={onRevoke}>
          <Trash2 aria-hidden />
          Revoke token
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
