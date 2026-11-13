import type { Ref } from 'react';

import { SidebarToggle } from '@/components/shell/layout/SidebarToggle';
import type { useCollapsedSidebar } from '@/hooks/useCollapsedSidebar';
import { SPRING_EASE } from '@/lib/motion';
import { cn } from '@/lib/utils';

type SidebarExpandProps = {
  toggleRef: Ref<HTMLButtonElement>;
  controls: string;
  collapsed: boolean;
  peeking: boolean;
  narrow: boolean;
  desktop: boolean;
  coarse: boolean;
  disabled: boolean;
  peekIntent: ReturnType<typeof useCollapsedSidebar>['peekIntent'];
  onToggle: () => void;
};

export function SidebarExpand({
  toggleRef,
  controls,
  collapsed,
  peeking,
  narrow,
  desktop,
  coarse,
  disabled,
  peekIntent,
  onToggle,
}: SidebarExpandProps) {
  const kept = desktop || (coarse && !narrow);

  return (
    <div
      data-slot="sidebar-expand"
      inert={(!collapsed && !kept) || undefined}
      {...(!disabled && !narrow ? peekIntent : {})}
      className={cn(
        'fixed top-2 left-(--sidebar-toggle-left) z-50',
        !kept &&
          cn(
            'transition-[opacity,translate] duration-[calc(var(--spring-duration)*0.3)]',
            SPRING_EASE,
            collapsed
              ? 'delay-[calc(var(--spring-duration)*0.75)]'
              : 'pointer-events-none -translate-x-2 opacity-0',
          ),
      )}
    >
      <SidebarToggle
        ref={toggleRef}
        collapsed={narrow ? !peeking : collapsed}
        peeking={!narrow && peeking}
        controls={controls}
        disabled={disabled}
        onToggle={onToggle}
      />
    </div>
  );
}
