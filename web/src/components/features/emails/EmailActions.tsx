import { Send, Trash2 } from 'lucide-react';

import { ActionWithAlert } from '@/components/shared/ActionWithAlert';
import { RowActions } from '@/components/shared/RowActions';
import { useRemoveMyEmail } from '@/hooks/api/useRemoveMyEmail';
import { useResendMyEmailVerification } from '@/hooks/api/useResendMyEmailVerification';
import type { UserEmail } from '@/lib/emails';
import { messageOf } from '@/lib/error';
import { toast } from '@/lib/toast';

const alertOf = (
  resendFailure: Error | null,
  removeFailure: Error | null,
): string | null => {
  if (removeFailure) {
    return messageOf(removeFailure, 'Sorry, the email couldn’t be removed.');
  }
  if (resendFailure) {
    return messageOf(
      resendFailure,
      'Sorry, the verification link couldn’t be sent.',
    );
  }

  return null;
};

type EmailActionsProps = {
  email: UserEmail;
};

export function EmailActions({ email }: EmailActionsProps) {
  const resend = useResendMyEmailVerification();
  const remove = useRemoveMyEmail();

  return (
    <ActionWithAlert alert={alertOf(resend.error, remove.error)}>
      <RowActions
        label={`Actions for ${email.email}`}
        disabled={resend.isPending || remove.isPending}
        actions={[
          ...(email.status === 'verified'
            ? []
            : [
                {
                  label: 'Resend verification link',
                  icon: Send,
                  onSelect: () => {
                    remove.reset();
                    resend.mutate(email.id, {
                      onSuccess: () =>
                        toast.add({
                          type: 'success',
                          title: 'Verification link sent',
                        }),
                    });
                  },
                },
              ]),
          {
            label: 'Remove email',
            icon: Trash2,
            onSelect: () => {
              resend.reset();
              remove.mutate(email.id);
            },
          },
        ]}
      />
    </ActionWithAlert>
  );
}
