import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { CohortTally } from '@/components/features/changes/CohortTally';
import { StackNavLayer } from '@/components/features/changes/StackNavLayer';
import { Unfold } from '@/components/shared/Unfold';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  type ChangeStack,
  filesOf,
  layerTallyOf,
  type StackCohort,
} from '@/lib/change-stack';
import { cn } from '@/lib/utils';

type StackNavCohortProps = {
  stack: ChangeStack;
  cohort: StackCohort;
  current: string | null;
  onPick: (layerId: string) => void;
};

export function StackNavCohort({
  stack,
  cohort,
  current,
  onPick,
}: StackNavCohortProps) {
  const [open, setOpen] = useState(true);

  return (
    <section
      aria-label={cohort.title}
      className={cn(
        'flex flex-col gap-2.5',
        cohort.kind === 'incidental' && 'opacity-80',
      )}
    >
      <Tooltip disableHoverablePopup>
        <TooltipTrigger
          render={
            <button
              type="button"
              onClick={() => setOpen((shown) => !shown)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left outline-none transition-colors hover:bg-border/50 focus-visible:ring-2 focus-visible:ring-ring/70"
            />
          }
        >
          <span className="min-w-0 truncate font-medium text-foreground text-xs">
            {cohort.title}
          </span>
          <ChevronRight
            aria-hidden
            className={cn(
              'size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none',
              open && 'rotate-90',
            )}
          />
        </TooltipTrigger>

        <TooltipContent className="flex w-(--anchor-width) max-w-none flex-col gap-1">
          <span className="font-medium">{cohort.title}</span>

          <CohortTally stack={stack} cohort={cohort} />

          <span className="text-muted-foreground">
            {cohort.kind === 'incidental' ? 'Incidental · ' : ''}
            {cohort.intent}
          </span>
        </TooltipContent>
      </Tooltip>

      <Unfold open={open} appear={false}>
        <ol className="flex flex-col gap-1">
          {cohort.layers.map((layer, place) => {
            const located = { cohort, layer, position: place + 1 };
            const files = filesOf(stack, layer);

            return (
              <StackNavLayer
                key={layer.id}
                located={located}
                files={files.length}
                tally={layerTallyOf(files)}
                active={layer.id === current}
                onPick={onPick}
              />
            );
          })}
        </ol>
      </Unfold>
    </section>
  );
}
