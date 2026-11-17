import { InferenceProblem } from '@/components/shared/InferenceProblem';
import { PillLink } from '@/components/shared/PillLink';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { ADD_CREDITS, NO_CREDITS } from '@/lib/inference';
import { isAdmin } from '@/lib/role';
import { inferenceSettingsPath } from '@/lib/settings';

type InferenceCreditsUsedUpProps = {
  slug: string;
  className?: string;
};

export function InferenceCreditsUsedUp({
  slug,
  className,
}: InferenceCreditsUsedUpProps) {
  const { data: workspace } = useWorkspace(slug);

  return (
    <InferenceProblem
      slot="inference-credits-used-up"
      alert
      className={className}
      action={
        workspace &&
        isAdmin(workspace.role) && (
          <PillLink to={inferenceSettingsPath(slug)}>Check endpoint</PillLink>
        )
      }
    >
      {NO_CREDITS} {ADD_CREDITS}
    </InferenceProblem>
  );
}
