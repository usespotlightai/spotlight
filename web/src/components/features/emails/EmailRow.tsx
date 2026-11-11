import { Mail } from 'lucide-react';

import { EmailActions } from '@/components/features/emails/EmailActions';
import { SettingsRow } from '@/components/features/settings/SettingsRow';
import { RowIcon } from '@/components/shared/RowIcon';
import { statusOfEmail, type UserEmail } from '@/lib/emails';

type EmailRowProps = {
  email: UserEmail;
};

export function EmailRow({ email }: EmailRowProps) {
  return (
    <li data-slot="email-row">
      <SettingsRow label={email.email} leading={<RowIcon icon={Mail} />}>
        <span className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">
            {statusOfEmail[email.status]}
          </span>
          <EmailActions email={email} />
        </span>
      </SettingsRow>
    </li>
  );
}
