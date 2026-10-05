import { IntegrationLogo } from '@/components/features/integrations/IntegrationLogo';
import { SettingsRow } from '@/components/features/settings/SettingsRow';
import type { PersonConnectionResponseDto } from '@/lib/api';

type ConnectionsRosterRowProps = {
  connection: PersonConnectionResponseDto;
  integration: string;
};

export function ConnectionsRosterRow({
  connection,
  integration,
}: ConnectionsRosterRowProps) {
  return (
    <SettingsRow
      label={connection.name || 'Someone who left'}
      description={
        connection.handle
          ? `${integration} as ${connection.handle}`
          : integration
      }
      leading={<IntegrationLogo source={connection.source} />}
    />
  );
}
