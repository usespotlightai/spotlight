import {
  horizontalListSortingStrategy,
  SortableContext,
} from '@dnd-kit/sortable';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { CSSProperties } from 'react';

import { AppTabItem } from '@/components/shell/tabs/AppTabItem';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useSidebarCollapsedSetting } from '@/hooks/useCollapsedSidebar';
import { type AppTab, tabIconOf } from '@/lib/app-tabs';
import { desktopApp, framesWindow } from '@/lib/desktop';
import { SPRING } from '@/lib/motion';
import { cn } from '@/lib/utils';

const STRIP_SPACING: CSSProperties & Record<`--${string}`, string> = {
  '--tab-gap': 'calc(var(--spacing) * 1.5)',
  '--history-button': 'calc(var(--spacing) * 7)',
};

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
            hangs && 'md:-ml-[calc(2*(var(--history-button)+var(--tab-gap)))]',
          )}
        >
          <Tooltip>
            <TooltipTrigger
              iconOnly
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Back"
                  disabled={!canGoBack}
                  onClick={onBack}
                  className="size-(--history-button) text-muted-foreground dark:hover:bg-muted"
                />
              }
            >
              <ChevronLeft className="size-3.5" aria-hidden />
            </TooltipTrigger>
            <TooltipContent>Go back</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              iconOnly
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Forward"
                  disabled={!canGoForward}
                  onClick={onForward}
                  className="size-(--history-button) text-muted-foreground dark:hover:bg-muted"
                />
              }
            >
              <ChevronRight className="size-3.5" aria-hidden />
            </TooltipTrigger>
            <TooltipContent>Go forward</TooltipContent>
          </Tooltip>
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

      <Tooltip>
        <TooltipTrigger
          iconOnly
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="New tab"
              onClick={onOpen}
              className="text-muted-foreground dark:hover:bg-muted"
            />
          }
        >
          <Plus className="size-3.5" aria-hidden />
        </TooltipTrigger>
        <TooltipContent>Open a new tab</TooltipContent>
      </Tooltip>
    </nav>
  );
}
