import type { SearchIterationResponseDto } from '@/lib/api';
import { reflecting, whyItStalledAnchor } from '@/lib/search';
import {
  REFLECTION_ITERATION_PENDING,
  reflectionIterationShown,
  SEE_WHY_IT_STALLED,
} from '@/lib/search-words';

type IterationReflectionProps = {
  iteration: SearchIterationResponseDto;
};

export function IterationReflection({ iteration }: IterationReflectionProps) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5 rounded-xl border border-border border-dashed px-3 py-2 text-muted-foreground text-xs">
      {reflecting(iteration) || !iteration.reflection
        ? REFLECTION_ITERATION_PENDING
        : reflectionIterationShown(
            iteration.reflection.tasks.length,
            iteration.reflection.causes.length,
          )}
      <a
        href={`#${whyItStalledAnchor(iteration.number)}`}
        className="text-foreground underline-offset-2 hover:underline"
      >
        {SEE_WHY_IT_STALLED}
      </a>
    </p>
  );
}
