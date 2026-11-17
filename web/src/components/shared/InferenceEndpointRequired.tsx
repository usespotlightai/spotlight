import type { ReactNode } from 'react';

import { InferenceProblem } from '@/components/shared/InferenceProblem';
import { InferenceSetupLink } from '@/components/shared/InferenceSetupLink';
import { NO_INFERENCE_ENDPOINT } from '@/lib/inference';

type InferenceEndpointRequiredProps = {
  slug: string;
  children: ReactNode;
  className?: string;
};

export function InferenceEndpointRequired({
  slug,
  children,
  className,
}: InferenceEndpointRequiredProps) {
  return (
    <InferenceProblem
      slot="inference-endpoint-required"
      className={className}
      action={<InferenceSetupLink slug={slug} />}
    >
      {children} {NO_INFERENCE_ENDPOINT}
    </InferenceProblem>
  );
}
