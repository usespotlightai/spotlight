import { PillLink } from '@/components/shared/PillLink';
import type { PillSize } from '@/lib/pill';
import { inferenceSettingsPath } from '@/lib/settings';

type InferenceSetupLinkProps = {
  slug: string;
  size?: PillSize;
};

export function InferenceSetupLink({
  slug,
  size = 'small',
}: InferenceSetupLinkProps) {
  return (
    <PillLink to={inferenceSettingsPath(slug)} size={size}>
      Set up inference
    </PillLink>
  );
}
