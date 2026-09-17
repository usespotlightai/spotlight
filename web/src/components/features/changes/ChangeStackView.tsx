import { useEffect, useRef } from 'react';
import { LayerDetail } from '@/components/features/changes/LayerDetail';
import { StackNavCohort } from '@/components/features/changes/StackNavCohort';
import { PaneHandle } from '@/components/shell/layout/PaneHandle';
import { usePaneWidth } from '@/hooks/usePaneWidth';
import { type ChangeStack, layerAt } from '@/lib/change-stack';

export const STACK_NAV_PANE = {
  storageKey: 'spotlight.change-stack-nav-width',
  min: 224,
  max: 560,
  initial: 288,
  label: 'Resize the change stack',
};

type ChangeStackViewProps = {
  stack: ChangeStack;
  layerId: string | null;
  onPick: (layerId: string) => void;
};

export function ChangeStackView({
  stack,
  layerId,
  onPick,
}: ChangeStackViewProps) {
  const located = layerAt(stack, layerId);
  const reading = useRef<HTMLDivElement>(null);
  const nav = usePaneWidth<HTMLDivElement>(STACK_NAV_PANE);
  const shown = located?.layer.id;

  useEffect(() => {
    if (shown && reading.current) {
      reading.current.scrollTop = 0;
    }
  }, [shown]);

  return (
    <div className="flex min-h-0 flex-1">
      <div
        ref={nav.paneRef}
        style={{ width: nav.width }}
        className="relative flex shrink-0 border-border border-r-[0.5px]"
      >
        <nav
          aria-label="Change stack"
          className="flex min-w-0 flex-1 flex-col gap-8 overflow-y-auto px-3 py-5 scrollbar-hide"
        >
          {stack.cohorts.map((cohort) => (
            <StackNavCohort
              key={cohort.id}
              stack={stack}
              cohort={cohort}
              current={shown ?? null}
              onPick={onPick}
            />
          ))}
        </nav>

        <PaneHandle {...nav.handleProps} edge="right" resizing={nav.resizing} />
      </div>

      <div ref={reading} className="min-w-0 flex-1 overflow-y-auto">
        {located && (
          <LayerDetail
            key={located.layer.id}
            stack={stack}
            located={located}
            onPick={onPick}
          />
        )}
      </div>
    </div>
  );
}
