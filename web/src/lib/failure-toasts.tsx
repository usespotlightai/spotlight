import { MutationCache } from '@tanstack/react-query';

import { FailureDetail } from '@/components/shared/FailureDetail';
import { failureDebugLine, failureMessage } from '@/lib/request-failure';
import { toast } from '@/lib/toast';

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: { quiet?: boolean; optimistic?: boolean };
  }
}

type FailureToasts = {
  // Shows the status and the request under the message. For development builds only.
  debug: boolean;
};

const toastFailure = (thrown: unknown, { debug }: FailureToasts) => {
  const line = debug ? failureDebugLine(thrown) : null;

  toast.add({
    type: 'error',
    title: failureMessage(thrown),
    description: line === null ? undefined : <FailureDetail line={line} />,
  });
};

export const failuresToasted = (options: FailureToasts): MutationCache =>
  new MutationCache({
    onError: (thrown, _variables, _context, mutation) => {
      if (!mutation.meta?.quiet) {
        toastFailure(thrown, options);
      }
    },
  });
