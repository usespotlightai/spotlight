import { IterationNote } from '@/components/features/searches/search/IterationNote';
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
    <IterationNote>
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
    </IterationNote>
  );
}
