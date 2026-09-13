import { KeyRound } from 'lucide-react';
import { useParams } from 'react-router';
import { VaultKeyField } from '@/components/features/secrets/VaultKeyField';
import { SettingsPage } from '@/components/features/settings/SettingsPage';
import { SettingsRow } from '@/components/features/settings/SettingsRow';
import { SettingsSection } from '@/components/features/settings/SettingsSection';
import { RowIcon } from '@/components/shared/RowIcon';

export function TeamSecrets() {
  const { teamId } = useParams();

  if (!teamId) {
    return null;
  }

  return (
    <SettingsPage
      title="Secrets"
      description="The secrets your integrations read are encrypted into the configuration repository. Anyone with the vault key can decrypt them."
    >
      <SettingsSection>
        <SettingsRow
          label="Vault key"
          leading={<RowIcon icon={KeyRound} />}
          description="Keep it secret"
        >
          <VaultKeyField teamId={teamId} />
        </SettingsRow>
      </SettingsSection>
    </SettingsPage>
  );
}
