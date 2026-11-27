import { Send, Trash2 } from 'lucide-react';

import { RowActions } from '@/components/shared/RowActions';
import { useRemoveMyEmail } from '@/hooks/api/useRemoveMyEmail';
import { useResendMyEmailVerification } from '@/hooks/api/useResendMyEmailVerification';
import type { UserEmail } from '@/lib/emails';
import { toast } from '@/lib/toast';

type EmailActionsProps = {
  email: UserEmail;
};

export function EmailActions({ email }: EmailActionsProps) {
  const resend = useResendMyEmailVerification();
  const remove = useRemoveMyEmail();

  return (
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
  );
}
