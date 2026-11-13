import { type ReactNode, useState } from 'react';

import { CollapsibleSidebar } from '@/components/shell/layout/CollapsibleSidebar';
import { PaneHandle } from '@/components/shell/layout/PaneHandle';
import { useSidebarCollapsed } from '@/hooks/useCollapsedSidebar';
import { useDragToClose } from '@/hooks/useDragToClose';
import { usePaneWidth } from '@/hooks/usePaneWidth';
import { useSettling } from '@/hooks/useSettling';
import { framesWindow } from '@/lib/desktop';
import { SPRING } from '@/lib/motion';
import { cn } from '@/lib/utils';

type DashboardLayoutProps = {
  sidebar?: ReactNode;
  tabs?: ReactNode;
  split?: ReactNode;
  panesKey?: string;
  focused?: SectionName;
  onCollapse?: (section: SectionName) => void;
  children?: ReactNode;
};

type SectionName = 'main' | 'split';

type Closing = { section: SectionName; panesKey?: string };

const SPLIT_CLOSES_AT_PX = 160;

const MAIN_KEEPS_PX = 328;

const SPLIT_PANE = {
  storageKey: 'spotlight.split-width',
  min: 320,
  max: 1600,
  initial: 560,
  label: 'Resize split view',
  edge: 'left' as const,
  property: '--split-width',
};

const PANE_SECTION =
  'relative flex min-h-0 min-w-0 flex-1 flex-col overflow-clip rounded-lg border-[0.5px] border-border bg-surface shadow-pane data-focused:border-foreground/25 data-collapsing:opacity-40';

export function DashboardLayout({
  sidebar,
  tabs,
  split,
  panesKey,
  focused = 'main',
  onCollapse,
  children,
}: DashboardLayoutProps) {
  const collapsed = useSidebarCollapsed();
  const desktop = framesWindow();
  const [dragging, setDragging] = useState<SectionName | null>(null);
  const [closing, setClosing] = useSettling<Closing>((done) => {
    if (done.panesKey === panesKey) {
      onCollapse?.(done.section);
    }
  });
  const closingSection =
    closing?.panesKey === panesKey ? (closing?.section ?? null) : null;
  const shows = (section: SectionName) =>
    dragging === section || closingSection === section || undefined;

  return (
    <div
      className={cn(
        'flex h-svh overflow-clip bg-background',
        desktop && 'bg-background/40',
      )}
    >
      <CollapsibleSidebar>{sidebar}</CollapsibleSidebar>

      <div className="flex min-w-0 flex-1 flex-col p-2 md:pl-0">
        <div
          className={cn(
            'flex min-w-0 items-start transition-[padding]',
            SPRING,
            sidebar &&
              collapsed &&
              (desktop ? 'md:pl-[6.625rem]' : 'md:pl-[2.125rem]'),
          )}
        >
          <div className="min-w-0 flex-1">{tabs}</div>
        </div>

        <div className="relative flex min-h-0 flex-1 gap-2">
          <div
            inert={closingSection === 'main' || undefined}
            className={cn(
              'flex min-w-0 flex-1 justify-end [clip-path:inset(-2rem_-2rem_-2rem_0)]',
              closingSection === 'main' &&
                cn('-mr-2 transition-[margin]', SPRING),
            )}
          >
            <section
              data-focused={(split && focused === 'main') || undefined}
              data-collapsing={shows('main')}
              className={cn(PANE_SECTION, split && 'min-w-80')}
            >
              {children}
            </section>
          </div>

          {split && (
            <SplitSection
              focused={focused === 'split'}
              closing={closingSection}
              collapsing={shows('split')}
              onDragging={setDragging}
              onClose={(section) => setClosing({ section, panesKey })}
            >
              {split}
            </SplitSection>
          )}
        </div>
      </div>
    </div>
  );
}

type SplitSectionProps = {
  focused: boolean;
  closing: SectionName | null;
  collapsing: true | undefined;
  onDragging: (section: SectionName | null) => void;
  onClose: (section: SectionName) => void;
  children: ReactNode;
};

function SplitSection({
  focused,
  closing,
  collapsing,
  onDragging,
  onClose,
  children,
}: SplitSectionProps) {
  const { width, min, resizing, handleProps, paneRef, resize } =
    usePaneWidth<HTMLDivElement>(SPLIT_PANE);
  const dragHandle = useDragToClose<SectionName>({
    width,
    min,
    max: (room) => room - MAIN_KEEPS_PX,
    direction: -1,
    paneRef,
    property: '--split-drag',
    handleProps,
    resize,
    closingAt: (wanted, room) => {
      if (wanted < SPLIT_CLOSES_AT_PX) {
        return 'split';
      }

      return wanted > room - SPLIT_CLOSES_AT_PX ? 'main' : null;
    },
    onClosing: onDragging,
    onClose,
  });

  return (
    <div
      ref={paneRef}
      inert={closing === 'split' || undefined}
      data-resizing={resizing || undefined}
      className={cn(
        'relative hidden max-w-[max(calc(100%-20.5rem),var(--split-drag,0px))] shrink-0 flex-col md:flex',
        closing === 'split' && '-ml-2 w-0',
        closing === 'main' && 'w-full max-w-none',
        !closing && 'w-[var(--split-drag,var(--split-width))]',
        !resizing && cn('transition-[width,margin]', SPRING),
      )}
    >
      <PaneHandle
        {...handleProps}
        {...dragHandle}
        edge="left"
        resizing={resizing}
        className="-left-2"
      />

      <div className="flex min-h-0 min-w-0 flex-1 [clip-path:inset(-2rem_0_-2rem_-2rem)]">
        <section
          data-focused={focused || undefined}
          data-collapsing={collapsing}
          className={cn(
            PANE_SECTION,
            (resizing || closing === 'split') && 'min-w-80',
          )}
        >
          {children}
        </section>
      </div>
    </div>
  );
}
