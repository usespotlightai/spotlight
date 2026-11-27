import { useState } from 'react';
import { useParams } from 'react-router';

import { SecretRow } from '@/components/features/secrets/SecretRow';
import { SetSecretValueDialog } from '@/components/features/secrets/SetSecretValueDialog';
import { SettingsPage } from '@/components/features/settings/SettingsPage';
import { SettingsSection } from '@/components/features/settings/SettingsSection';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { IconRowSkeleton } from '@/components/shared/skeleton/IconRowSkeleton';
import { TerraformResourceLink } from '@/components/shared/TerraformResourceLink';
import { useWorkspaceSecrets } from '@/hooks/api/useWorkspaceSecrets';
import { failed, loading } from '@/lib/query';
import type { WorkspaceSecret } from '@/lib/secret';

export function Secrets() {
  const { slug } = useParams();
  const secrets = useWorkspaceSecrets(slug);
  const [setting, setSetting] = useState<WorkspaceSecret | null>(null);

  if (!slug) {
    return null;
  }

  return (
    <>
      <SettingsPage
        title="Secrets"
        description="Egress sends each secret to its hosts. A run sees a value only where the secret can enter sandboxes. Terraform defines the secrets."
      >
        <SettingsSection
          title="Secrets"
          count={secrets.data?.length}
          listLabel="Secrets"
        >
          {loading(secrets) && (
            <li role="status" aria-label="Loading the secrets">
              <IconRowSkeleton
                nameWidth="w-36"
                aboutWidth="w-28"
                trailingWidth="w-24"
              />
            </li>
          )}

          {failed(secrets) && (
            <li>
              <CouldNotLoad
                what="Secrets"
                retrying={secrets.isFetching}
                onRetry={() => void secrets.refetch()}
                className="px-4 py-6 text-center"
              />
            </li>
          )}

          {secrets.data?.length === 0 && (
            <li className="px-4 py-4 text-muted-foreground text-sm">
              No secrets. Define them in Terraform with{' '}
              <TerraformResourceLink resource="secret" />.
            </li>
          )}

          {secrets.data?.map((secret) => (
            <SecretRow
              key={secret.name}
              secret={secret}
              onSetValue={() => setSetting(secret)}
            />
          ))}
        </SettingsSection>
      </SettingsPage>

      <SetSecretValueDialog
        slug={slug}
        secret={setting}
        onClose={() => setSetting(null)}
      />
    </>
  );
}
