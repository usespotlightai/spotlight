import type { ReactNode, Ref } from 'react';

import { SidebarWindowChrome } from '@/components/shell/layout/SidebarWindowChrome';
import { SPRING } from '@/lib/motion';
import { cn } from '@/lib/utils';

export const BELOW_TABS = 'top-11 bottom-2';

const ASIDE_TRANSITION = {
  resizing: 'transition-opacity',
  floating: 'transition-[translate,opacity]',
  regrowing: 'transition-[translate]',
  hidden: 'transition-[translate,opacity,width]',
  docked:
    'transition-[translate,opacity,width,top,bottom,border-color,border-radius,box-shadow]',
};

type AsideMotion = keyof typeof ASIDE_TRANSITION;

const asideMotion = (state: Record<AsideMotion, boolean>): AsideMotion =>
  (['resizing', 'floating', 'regrowing', 'hidden'] as const).find(
    (motion) => state[motion],
  ) ?? 'docked';

type SidebarAsideProps = {
  ref: Ref<HTMLElement>;
  id: string;
  collapsed: boolean;
  peeking: boolean;
  floating: boolean;
  docking: boolean;
  resizing: boolean;
  regrowing: boolean;
  closing: boolean;
  shrunkTo: number | undefined;
  desktop: boolean;
  children?: ReactNode;
};

export function SidebarAside({
  ref,
  id,
  collapsed,
  peeking,
  floating,
  docking,
  resizing,
  regrowing,
  closing,
  shrunkTo,
  desktop,
  children,
}: SidebarAsideProps) {
  const hidden = collapsed && !peeking;
  const motion = asideMotion({
    resizing,
    floating,
    regrowing,
    hidden,
    docked: true,
  });

  return (
    <aside
      ref={ref}
      id={id}
      tabIndex={-1}
      inert={hidden || undefined}
      data-collapsed={collapsed || undefined}
      data-peeking={peeking || undefined}
      data-floating={floating || undefined}
      data-closing={closing || shrunkTo !== undefined || undefined}
      style={shrunkTo === undefined ? undefined : { width: shrunkTo }}
      className={cn(
        'left-0 flex flex-col overflow-hidden border-[0.5px] border-l-0 px-3 py-2 outline-none data-closing:opacity-40',
        ASIDE_TRANSITION[motion],
        SPRING,
        floating
          ? cn(
              'fixed z-50 w-[max(var(--sidebar-width),14rem)] rounded-r-xl border-border bg-background shadow-overlay',
              BELOW_TABS,
            )
          : 'absolute inset-y-0 z-10 w-(--sidebar-width) border-transparent',
        docking && 'z-50',
        !desktop && 'bg-background',
        hidden &&
          cn(
            'pointer-events-none',
            floating ? '-translate-x-[calc(100%+3rem)]' : '-translate-x-full',
          ),
      )}
    >
      {desktop && <SidebarWindowChrome floating={floating} />}
      {children}
    </aside>
  );
}
