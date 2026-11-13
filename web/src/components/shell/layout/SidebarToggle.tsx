import type { Ref } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type SidebarToggleProps = {
  ref?: Ref<HTMLButtonElement>;
  collapsed: boolean;
  controls: string;
  disabled?: boolean;
  onToggle: () => void;
};

export function SidebarToggle({
  ref,
  collapsed,
  controls,
  disabled,
  onToggle,
}: SidebarToggleProps) {
  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon-sm"
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      aria-expanded={!collapsed}
      aria-controls={controls}
      disabled={disabled}
      onClick={onToggle}
      className="size-(--sidebar-toggle-size) shrink-0 text-muted-foreground hover:bg-transparent hover:text-foreground active:not-aria-[haspopup]:translate-y-0 aria-expanded:bg-transparent aria-expanded:text-muted-foreground aria-expanded:hover:text-foreground dark:hover:bg-transparent"
    >
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
        aria-hidden
        className="size-4"
      >
        <rect x="1.75" y="2.25" width="12.5" height="11.5" rx="2.75" />
        <rect
          x="3.375"
          y="3.875"
          width="4.5"
          height="8.25"
          rx="1.625"
          fill="currentColor"
          stroke="none"
          className={cn(
            'origin-left transition-transform duration-200 ease-spring [transform-box:fill-box] motion-reduce:transition-none',
            collapsed
              ? 'translate-x-[0.75px] scale-x-[0.278] scale-y-[0.818] group-hover/button:translate-x-0 group-hover/button:scale-100'
              : 'group-hover/button:translate-x-[0.75px] group-hover/button:scale-x-[0.278] group-hover/button:scale-y-[0.818]',
          )}
        />
      </svg>
    </Button>
  );
}
