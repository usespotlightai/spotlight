import {
  horizontalListSortingStrategy,
  SortableContext,
} from '@dnd-kit/sortable';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

import { AppTabItem } from '@/components/shell/tabs/AppTabItem';
import { Button } from '@/components/ui/button';
import { type AppTab, tabIconOf } from '@/lib/app-tabs';
import { desktopApp } from '@/lib/desktop';

type AppTabStripProps = {
  tabs: readonly AppTab[];
  activeId: string;
  splitId?: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  canGoBack: boolean;
  canGoForward: boolean;
  onOpen: () => void;
  onBack: () => void;
  onForward: () => void;
};

export function AppTabStrip({
  tabs,
  activeId,
  splitId,
  onSelect,
  onClose,
  canGoBack,
  canGoForward,
  onOpen,
  onBack,
  onForward,
}: AppTabStripProps) {
  return (
    <nav
      aria-label="Tabs"
      data-slot="app-tabs"
      className="flex min-w-0 shrink-0 items-center gap-1.5 pb-2"
    >
      {desktopApp() && (
        <>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Back"
            disabled={!canGoBack}
            onClick={onBack}
            className="text-muted-foreground"
          >
            <ChevronLeft className="size-3.5" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Forward"
            disabled={!canGoForward}
            onClick={onForward}
            className="text-muted-foreground"
          >
            <ChevronRight className="size-3.5" aria-hidden />
          </Button>
        </>
      )}
      <SortableContext
        items={tabs.map((tab) => tab.id)}
        strategy={horizontalListSortingStrategy}
      >
        <ul className="flex min-w-0 items-center gap-1.5">
          {tabs.map((tab) => (
            <AppTabItem
              key={tab.id}
              tab={tab}
              icon={tabIconOf(tab.path)}
              active={tab.id === activeId || tab.id === splitId}
              closable={tabs.length > 1}
              onSelect={() => onSelect(tab.id)}
              onClose={() => onClose(tab.id)}
            />
          ))}
        </ul>
      </SortableContext>

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
