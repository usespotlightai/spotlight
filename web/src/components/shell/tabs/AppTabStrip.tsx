import { Plus } from 'lucide-react';
import { AppTabItem } from '@/components/shell/tabs/AppTabItem';
import { Button } from '@/components/ui/button';
import { type AppTab, tabIconOf } from '@/lib/app-tabs';

type AppTabStripProps = {
  tabs: readonly AppTab[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onOpen: () => void;
};

export function AppTabStrip({
  tabs,
  activeId,
  onSelect,
  onClose,
  onOpen,
}: AppTabStripProps) {
  return (
    <nav
      aria-label="Tabs"
      data-slot="app-tabs"
      className="hidden min-w-0 shrink-0 items-center gap-1.5 pb-2 md:flex"
    >
      <ul className="flex min-w-0 items-center gap-1.5">
        {tabs.map((tab) => (
          <AppTabItem
            key={tab.id}
            tab={tab}
            icon={tabIconOf(tab.path)}
            active={tab.id === activeId}
            closable={tabs.length > 1}
            onSelect={() => onSelect(tab.id)}
            onClose={() => onClose(tab.id)}
          />
        ))}
      </ul>

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="New tab"
        onClick={onOpen}
        className="text-muted-foreground"
      >
        <Plus className="size-3.5" aria-hidden />
      </Button>
    </nav>
  );
}
