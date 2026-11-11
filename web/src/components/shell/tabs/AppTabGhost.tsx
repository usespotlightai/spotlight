import type { LucideIcon } from 'lucide-react';

import { tabFrame } from '@/components/shell/tabs/app-tab-look';
import { type AppTab, NEW_TAB_TITLE } from '@/lib/app-tabs';
import { cn } from '@/lib/utils';

type AppTabGhostProps = {
  tab: AppTab;
  icon: LucideIcon;
  active: boolean;
};

export function AppTabGhost({ tab, icon: Icon, active }: AppTabGhostProps) {
  return (
    <div
      aria-hidden
      className={cn(tabFrame(active), 'cursor-grabbing bg-card shadow-control')}
    >
      <span className="flex h-full min-w-0 flex-1 items-center gap-2 pr-2.5 pl-2.5">
        <Icon className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{tab.title ?? NEW_TAB_TITLE}</span>
      </span>
    </div>
  );
}
