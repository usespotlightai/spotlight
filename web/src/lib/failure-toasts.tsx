import { MutationCache } from '@tanstack/react-query';

import { FailureDetail } from '@/components/shared/FailureDetail';
import { messageOf } from '@/lib/error';
import { failureHeadline, sentRequestOf } from '@/lib/request-failure';
import { toast } from '@/lib/toast';

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: { quiet?: boolean; optimistic?: boolean };
  }
}

const toastFailure = (thrown: unknown) => {
  const message = messageOf(thrown, '');

  toast.add({
    type: 'error',
    title: failureHeadline(thrown),
    description: (
      <FailureDetail message={message || null} sent={sentRequestOf(thrown)} />
    ),
  });
};

export const failuresToasted = (): MutationCache =>
  new MutationCache({
    onError: (thrown, _variables, _context, mutation) => {
      if (mutation.meta?.quiet !== true) {
        toastFailure(thrown);
      }
    },
  });
