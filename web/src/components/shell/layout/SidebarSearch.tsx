import { Search } from 'lucide-react';

import { ShortcutKeys } from '@/components/shared/shortcut/ShortcutKeys';

type SidebarSearchProps = {
  onOpen: () => void;
};

export function SidebarSearch({ onOpen }: SidebarSearchProps) {
  return (
    <button
      type="button"
      data-slot="sidebar-search"
      onClick={onOpen}
      className="group/search flex h-7 w-full items-center gap-2 rounded-md px-2 text-muted-foreground text-sm outline-none transition-colors hover:bg-sidebar-hover hover:text-foreground focus-visible:bg-sidebar-hover"
    >
      <Search className="size-3.5 shrink-0" />
      <span className="truncate">Search</span>
      <ShortcutKeys
        id="palette.open"
        plain
        className="ml-auto opacity-0 transition-opacity group-hover/search:opacity-100 group-focus-visible/search:opacity-100"
      />
    </button>
  );
}
