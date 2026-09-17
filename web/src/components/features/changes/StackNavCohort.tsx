import { StackNavLayer } from '@/components/features/changes/StackNavLayer';
import {
  type ChangeStack,
  filesOf,
  layerCheckOf,
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
  return (
    <section
      aria-label={cohort.title}
      className={cn(
        'flex flex-col gap-2.5',
        cohort.kind === 'incidental' && 'opacity-80',
      )}
    >
      <header className="flex flex-col gap-1 px-2">
        <h2 className="font-medium text-foreground text-xs">{cohort.title}</h2>
        <p className="line-clamp-2 text-faint text-xs">
          {cohort.kind === 'incidental' ? 'Incidental · ' : ''}
          {cohort.intent}
        </p>
      </header>

      <ol className="flex flex-col gap-1">
        {cohort.layers.map((layer, place) => {
          const located = { cohort, layer, position: place + 1 };

          return (
            <StackNavLayer
              key={layer.id}
              located={located}
              files={filesOf(stack, layer).length}
              check={layerCheckOf(stack, located)}
              active={layer.id === current}
              onPick={onPick}
            />
          );
        })}
      </ol>
    </section>
  );
}
