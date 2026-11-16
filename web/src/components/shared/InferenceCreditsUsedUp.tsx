import { InferenceProblem } from '@/components/shared/InferenceProblem';
import { PillLink } from '@/components/shared/PillLink';
import { ADD_CREDITS, NO_CREDITS } from '@/lib/inference';
import { inferenceSettingsPath } from '@/lib/settings';

type InferenceCreditsUsedUpProps = {
  slug: string;
  className?: string;
};

export function InferenceCreditsUsedUp({
  slug,
  className,
}: InferenceCreditsUsedUpProps) {
  return (
    <InferenceProblem
      slot="inference-credits-used-up"
      alert
      className={className}
      action={
        <PillLink to={inferenceSettingsPath(slug)}>Check endpoint</PillLink>
      }
    >
      {NO_CREDITS} {ADD_CREDITS}
    </InferenceProblem>
  );
}
