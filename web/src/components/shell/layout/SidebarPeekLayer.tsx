import { BELOW_TABS } from '@/components/shell/layout/SidebarAside';
import type { useCollapsedSidebar } from '@/hooks/useCollapsedSidebar';
import { SPRING } from '@/lib/motion';
import { cn } from '@/lib/utils';

type SidebarPeekLayerProps = {
  collapsed: boolean;
  docking: boolean;
  peeking: boolean;
  peekIntent: ReturnType<typeof useCollapsedSidebar>['peekIntent'];
  onUnpeek: () => void;
};

export function SidebarPeekLayer({
  collapsed,
  docking,
  peeking,
  peekIntent,
  onUnpeek,
}: SidebarPeekLayerProps) {
  return (
    <>
      {(collapsed || docking) && (
        <div
          aria-hidden
          data-slot="sidebar-backdrop"
          onClick={onUnpeek}
          className={cn(
            'fixed inset-0 z-40 bg-black/10 transition-opacity supports-backdrop-filter:backdrop-blur-xs',
            SPRING,
            peeking ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        />
      )}

      {collapsed && (
        <div
          aria-hidden
          data-slot="sidebar-peek"
          {...peekIntent}
          className={cn('fixed left-0 z-40 hidden w-2 md:block', BELOW_TABS)}
        />
      )}
    </>
  );
}
