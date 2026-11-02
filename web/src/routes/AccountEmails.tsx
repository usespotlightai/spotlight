import { LogIn } from 'lucide-react';
import { useState } from 'react';
import { AddEmailDialog } from '@/components/features/emails/AddEmailDialog';
import { EmailRow } from '@/components/features/emails/EmailRow';
import { SettingsPage } from '@/components/features/settings/SettingsPage';
import { SettingsRow } from '@/components/features/settings/SettingsRow';
import { SettingsSection } from '@/components/features/settings/SettingsSection';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { RowIcon } from '@/components/shared/RowIcon';
import { SectionButton } from '@/components/shared/SectionButton';
import { IconRowSkeleton } from '@/components/shared/skeleton/IconRowSkeleton';
import { useMyEmails } from '@/hooks/api/useMyEmails';
import { failed, loading } from '@/lib/query';

export function AccountEmails() {
  const emails = useMyEmails();
  const [adding, setAdding] = useState(false);

  return (
    <>
      <SettingsPage
        title="Emails"
        description="Spotlight recognizes you by your sign-in email and any additional verified email addresses. This allows Spotlight to identify you across connected services, regardless of which verified address you use."
      >
        {loading(emails) && (
          <SettingsSection>
            <div role="status" aria-label="Loading your emails">
              <IconRowSkeleton nameWidth="w-40" aboutWidth="w-56" />
            </div>
          </SettingsSection>
        )}

        {failed(emails) && (
          <SettingsSection>
            <CouldNotLoad
              what="Your emails"
              retrying={emails.isFetching}
              onRetry={() => void emails.refetch()}
              className="px-4 py-6 text-center"
            />
          </SettingsSection>
        )}

        {emails.data && (
          <>
            <SettingsSection title="Sign-in email">
              <SettingsRow
                label={emails.data.signInEmail}
                leading={<RowIcon icon={LogIn} />}
              />
            </SettingsSection>

            <SettingsSection
              title="Additional emails"
              count={emails.data.additional.length}
              listLabel="Additional emails"
              action={
                <SectionButton onClick={() => setAdding(true)}>
                  Add email
                </SectionButton>
              }
            >
              {emails.data.additional.length === 0 ? (
                <li className="px-4 py-4 text-muted-foreground text-sm">
                  No additional emails. Add the address your Slack account uses
                  if it is not your sign-in email.
                </li>
              ) : (
                emails.data.additional.map((email) => (
                  <EmailRow key={email.id} email={email} />
                ))
              )}
            </SettingsSection>
          </>
        )}
      </SettingsPage>

      <AddEmailDialog open={adding} onOpenChange={setAdding} />
    </>
  );
}
