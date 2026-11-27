import { Virtualizer } from '@pierre/diffs/react';
import { useState } from 'react';

import { LayerDetail } from '@/components/features/changes/LayerDetail';
import { StackNavCohort } from '@/components/features/changes/StackNavCohort';
import { StackNavRemoved } from '@/components/features/changes/StackNavRemoved';
import { StackNavToggle } from '@/components/features/changes/StackNavToggle';
import { PaneHandle } from '@/components/shell/layout/PaneHandle';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePaneWidth } from '@/hooks/usePaneWidth';
import { usePreloadedLanguages } from '@/hooks/usePreloadedLanguages';
import {
  type ChangeStack,
  layerAt,
  layersOf,
  STACK_NAV_PANE,
} from '@/lib/change-stack';
import { cn } from '@/lib/utils';

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
  const [listed, setListed] = useState(false);
  const {
    resizing: navResizing,
    paneRef: navRef,
    handleProps: navHandle,
  } = usePaneWidth<HTMLDivElement>(STACK_NAV_PANE);
  const shown = located?.layer.id;
  const layers = layersOf(stack);

  usePreloadedLanguages(stack.files.map((file) => file.path));

  const pick = (id: string) => {
    setListed(false);
    onPick(id);
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col @2xl/pane:flex-row">
      <div
        ref={navRef}
        className={cn(
          'relative flex shrink-0 flex-col border-border border-b-[0.5px] @2xl/pane:w-(--stack-nav-w) @2xl/pane:max-w-1/2 @2xl/pane:border-r-[0.5px] @2xl/pane:border-b-0',
          listed &&
            '@max-2xl/pane:absolute @max-2xl/pane:inset-0 @max-2xl/pane:z-10 @max-2xl/pane:border-b-0 @max-2xl/pane:bg-surface',
        )}
      >
        {located && (
          <StackNavToggle
            layer={located.layer}
            at={layers.findIndex((each) => each.layer.id === shown) + 1}
            count={layers.length}
            open={listed}
            onToggle={() => setListed((open) => !open)}
          />
        )}

        <ScrollArea
          className={cn(
            'min-h-0 min-w-0 flex-1',
            !listed && '@max-2xl/pane:hidden',
          )}
        >
          <nav
            aria-label="Change stack"
            className="min-h-full flex flex-col gap-8 px-3 pt-1 pb-5 @2xl/pane:py-5"
          >
            {stack.cohorts.map((cohort) => (
              <StackNavCohort
                key={cohort.id}
                stack={stack}
                cohort={cohort}
                current={shown ?? null}
                onPick={pick}
              />
            ))}
            <StackNavRemoved stack={stack} />
          </nav>
        </ScrollArea>

        <PaneHandle
          {...navHandle}
          edge="right"
          resizing={navResizing}
          className="hidden @2xl/pane:block"
        />
      </div>

      <Virtualizer className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        {located && (
          <LayerDetail stack={stack} located={located} onPick={onPick} />
        )}
      </Virtualizer>
    </div>
  );
}
