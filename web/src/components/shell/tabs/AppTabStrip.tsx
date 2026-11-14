import {
  horizontalListSortingStrategy,
  SortableContext,
} from '@dnd-kit/sortable';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { CSSProperties } from 'react';

import { AppTabItem } from '@/components/shell/tabs/AppTabItem';
import { RecentPagesButton } from '@/components/shell/tabs/RecentPagesButton';
import { Button } from '@/components/ui/button';
import { useSidebarCollapsedSetting } from '@/hooks/useCollapsedSidebar';
import { type AppTab, tabIconOf } from '@/lib/app-tabs';
import { desktopApp, framesWindow } from '@/lib/desktop';
import { SPRING } from '@/lib/motion';
import type { RecentPage } from '@/lib/recent-pages';
import { cn } from '@/lib/utils';

const STRIP_SPACING = {
  '--tab-gap': 'calc(var(--spacing) * 1.5)',
  '--history-button': 'calc(var(--spacing) * 7)',
} as CSSProperties;

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
  recent?: readonly RecentPage[];
  onRecent?: (path: string) => void;
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
  recent = [],
  onRecent,
}: AppTabStripProps) {
  const collapsed = useSidebarCollapsedSetting();
  const hangs = framesWindow() && !collapsed;

  return (
    <nav
      aria-label="Tabs"
      data-slot="app-tabs"
      style={STRIP_SPACING}
      className="flex min-w-0 shrink-0 items-center gap-(--tab-gap) pb-2"
    >
      {desktopApp() && (
        <div
          className={cn(
            'relative z-20 flex shrink-0 items-center gap-(--tab-gap) transition-[margin]',
            SPRING,
            hangs && 'md:-ml-[calc(3*(var(--history-button)+var(--tab-gap)))]',
          )}
        >
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Back"
            disabled={!canGoBack}
            onClick={onBack}
            className="size-(--history-button) text-muted-foreground"
          >
            <ChevronLeft className="size-3.5" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Forward"
            disabled={!canGoForward}
            onClick={onForward}
            className="size-(--history-button) text-muted-foreground"
          >
            <ChevronRight className="size-3.5" aria-hidden />
          </Button>
          {onRecent && (
            <RecentPagesButton
              pages={recent}
              onSelect={onRecent}
              className="size-(--history-button)"
            />
          )}
        </div>
      )}
      <SortableContext
        items={tabs.map((tab) => tab.id)}
        strategy={horizontalListSortingStrategy}
      >
        <ul className="flex min-w-0 items-center gap-(--tab-gap)">
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
