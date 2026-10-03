import { Virtualizer } from '@pierre/diffs/react';
import { LayerDetail } from '@/components/features/changes/LayerDetail';
import { StackNavCohort } from '@/components/features/changes/StackNavCohort';
import { PaneHandle } from '@/components/shell/layout/PaneHandle';
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
  const nav = usePaneWidth<HTMLDivElement>(STACK_NAV_PANE);
  const shown = located?.layer.id;

  usePreloadedLanguages(stack.files.map((file) => file.path));

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

      <Virtualizer className="min-w-0 flex-1 overflow-y-auto">
        {located && (
          <LayerDetail stack={stack} located={located} onPick={onPick} />
        )}
      </Virtualizer>
    </div>
  );
}
