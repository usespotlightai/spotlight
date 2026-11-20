import { useRef } from 'react';
import { Link } from 'react-router';

import { useOpenIntent } from '@/hooks/useOpenIntent';
import { useSlidingLine } from '@/hooks/useSlidingLine';
import { useTabIndicator } from '@/hooks/useTabIndicator';
import { useTabStrip } from '@/hooks/useTabStrip';
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
  onIntent?: (id: T) => void;
};

const LOOKS = {
  pills: {
    tab: 'flex h-7 shrink-0 items-center rounded-full border border-border bg-card px-2.5 font-medium text-[0.8rem] shadow-xs outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50',
    current: 'bg-muted',
  },
  underline: {
    tab: 'flex h-9 shrink-0 items-center px-2 text-muted-foreground text-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset',
    current: 'text-foreground',
  },
} as const;

export function TabLinks<T extends string>({
  label,
  tabs,
  current,
  variant = 'pills',
  className,
  onIntent,
}: TabLinksProps<T>) {
  const look = LOOKS[variant];
  const nav = useRef<HTMLElement>(null);
  const indicator = useTabIndicator(nav, current);
  const fade = useTabStrip(nav, current);

  return (
    <nav
      ref={nav}
      aria-label={label}
      style={fade}
      className={cn(
        'relative flex shrink-0 scroll-px-6 items-center gap-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none]',
        className,
      )}
    >
      {tabs.map((tab) => (
        <TabLink
          key={tab.id}
          tab={tab}
          current={tab.id === current}
          className={cn(look.tab, tab.id === current && look.current)}
          onIntent={onIntent && tab.id !== current ? onIntent : undefined}
        />
      ))}

      {variant === 'underline' && indicator && (
        <TabUnderline left={indicator.left} width={indicator.width} />
      )}
    </nav>
  );
}

function TabUnderline({ left, width }: { left: number; width: number }) {
  const line = useRef<HTMLSpanElement>(null);
  useSlidingLine(line, left, width);

  return (
    <span
      ref={line}
      aria-hidden
      data-slot="tab-indicator"
      className="pointer-events-none absolute bottom-0 h-[3px] origin-left rounded-full bg-primary"
    />
  );
}

function TabLink<T extends string>({
  tab,
  current,
  className,
  onIntent,
}: {
  tab: TabLink<T>;
  current: boolean;
  className: string;
  onIntent: ((id: T) => void) | undefined;
}) {
  const intent = useOpenIntent(onIntent && (() => onIntent(tab.id)));

  return (
    <Link
      to={tab.to}
      replace
      data-tab={tab.id}
      aria-current={current ? 'page' : undefined}
      className={className}
      {...intent}
    >
      <span data-tab-label>{tab.label}</span>
    </Link>
  );
}
