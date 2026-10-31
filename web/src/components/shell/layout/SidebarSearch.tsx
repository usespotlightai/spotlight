import { Search } from 'lucide-react';
import { commandShortcut } from '@/lib/command';

type SidebarSearchProps = {
  onOpen: () => void;
};

export function SidebarSearch({ onOpen }: SidebarSearchProps) {
  return (
    <button
      type="button"
      data-slot="sidebar-search"
      onClick={onOpen}
      className="group/search flex h-7 w-full items-center gap-2 rounded-md px-2 text-muted-foreground text-sm outline-none transition-colors hover:bg-border/50 hover:text-foreground focus-visible:bg-border/50"
    >
      <Search className="size-3.5 shrink-0" />
      <span className="truncate">Search</span>
      <kbd className="ml-auto shrink-0 font-sans text-xs opacity-0 transition-opacity group-hover/search:opacity-100 group-focus-visible/search:opacity-100">
        {commandShortcut(navigator.userAgent)}
      </kbd>
    </button>
  );
}
