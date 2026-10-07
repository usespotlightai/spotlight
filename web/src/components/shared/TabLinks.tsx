import { useRef } from 'react';
import { Link } from 'react-router';
import { useTabIndicator } from '@/hooks/useTabIndicator';
import { cn } from '@/lib/utils';

type TabLink<T extends string> = {
  readonly id: T;
  readonly label: string;
  readonly to: string;
};

type TabLinksProps<T extends string> = {
  label: string;
  tabs: readonly TabLink<T>[];
  current: T;
  variant?: 'pills' | 'underline';
  className?: string;
};

const LOOKS = {
  pills: {
    tab: 'flex h-7 shrink-0 items-center rounded-full border border-border bg-card px-2.5 font-medium text-[0.8rem] shadow-xs outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50',
    current: 'bg-muted',
  },
  underline: {
    tab: 'flex h-9 shrink-0 items-center px-2 text-[0.8rem] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset',
    current: 'text-foreground',
  },
} as const;

export function TabLinks<T extends string>({
  label,
  tabs,
  current,
  variant = 'pills',
  className,
}: TabLinksProps<T>) {
  const look = LOOKS[variant];
  const nav = useRef<HTMLElement>(null);
  const indicator = useTabIndicator(nav, current);

  return (
    <nav
      ref={nav}
      aria-label={label}
      className={cn(
        'relative flex shrink-0 items-center gap-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none]',
        className,
      )}
    >
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          to={tab.to}
          replace
          data-tab={tab.id}
          aria-current={tab.id === current ? 'page' : undefined}
          className={cn(look.tab, tab.id === current && look.current)}
        >
          <span data-tab-label>{tab.label}</span>
        </Link>
      ))}

      {variant === 'underline' && indicator && (
        <span
          aria-hidden
          data-slot="tab-indicator"
          className={cn(
            'pointer-events-none absolute bottom-0 left-0 h-[3px] rounded-full bg-primary',
            indicator.settled &&
              'transition-[transform,width] duration-200 ease-out motion-reduce:transition-none',
          )}
          style={{
            width: indicator.width,
            transform: `translateX(${indicator.left}px)`,
          }}
        />
      )}
    </nav>
  );
}
