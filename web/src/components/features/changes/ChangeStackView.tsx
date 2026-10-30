import { Virtualizer } from '@pierre/diffs/react';
import { LayerDetail } from '@/components/features/changes/LayerDetail';
import { StackNavCohort } from '@/components/features/changes/StackNavCohort';
import { PaneHandle } from '@/components/shell/layout/PaneHandle';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePaneWidth } from '@/hooks/usePaneWidth';
import { usePreloadedLanguages } from '@/hooks/usePreloadedLanguages';
import { type ChangeStack, layerAt, STACK_NAV_PANE } from '@/lib/change-stack';

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
  const {
    width: navWidth,
    resizing: navResizing,
    paneRef: navRef,
    handleProps: navHandle,
  } = usePaneWidth<HTMLDivElement>(STACK_NAV_PANE);
  const shown = located?.layer.id;

  usePreloadedLanguages(stack.files.map((file) => file.path));

  return (
    <div className="flex min-h-0 flex-1">
      <div
        ref={navRef}
        style={{ width: navWidth }}
        className="relative flex shrink-0 border-border border-r-[0.5px]"
      >
        <ScrollArea className="min-w-0 flex-1">
          <nav
            aria-label="Change stack"
            className="min-h-full flex flex-col gap-8 px-3 py-5"
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
        </ScrollArea>

        <PaneHandle {...navHandle} edge="right" resizing={navResizing} />
      </div>

      <Virtualizer className="min-w-0 flex-1 overflow-y-auto">
        {located && (
          <LayerDetail stack={stack} located={located} onPick={onPick} />
        )}
      </Virtualizer>
    </div>
  );
}
