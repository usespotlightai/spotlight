import { useParams } from 'react-router';

import { InferenceCreditsUsedUp } from '@/components/shared/InferenceCreditsUsedUp';
import { InferenceEndpointRequired } from '@/components/shared/InferenceEndpointRequired';
import { useInferenceUnset } from '@/hooks/useInferenceUnset';
import { sentRequestOf } from '@/lib/request-failure';

const PAYMENT_REQUIRED = 402;

type AnswerFailedProps = {
  error: unknown;
};

export function AnswerFailed({ error }: AnswerFailedProps) {
  const { slug } = useParams();
  const unset = useInferenceUnset(slug);

  if (slug && unset) {
    return (
      <InferenceEndpointRequired slug={slug} className="text-xs leading-5">
        Answer grading is off.
      </InferenceEndpointRequired>
    );
  }

  if (slug && sentRequestOf(error)?.status === PAYMENT_REQUIRED) {
    return <InferenceCreditsUsedUp slug={slug} className="text-xs leading-5" />;
  }

  return (
    <p role="alert" className="text-destructive text-xs leading-5">
      Sorry, the answer couldn’t be checked. Please try again.
    </p>
  );
}
