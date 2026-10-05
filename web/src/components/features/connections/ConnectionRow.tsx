import { useLocation } from 'react-router';
import { ConnectionTools } from '@/components/features/connections/ConnectionTools';
import { DisconnectButton } from '@/components/features/connections/DisconnectButton';
import { IntegrationLogo } from '@/components/features/integrations/IntegrationLogo';
import { SettingsRow } from '@/components/features/settings/SettingsRow';
import { PillButton } from '@/components/shared/PillButton';
import { useConnectIntegration } from '@/hooks/api/useConnectIntegration';
import type {
  ConfiguredIntegrationResponseDto,
  MyConnectionResponseDto,
} from '@/lib/api';

type ConnectionRowProps = {
  integration: ConfiguredIntegrationResponseDto;
  mine: MyConnectionResponseDto | null;
  teamId: string;
};

const said = (mine: MyConnectionResponseDto | null): string => {
  if (!mine) {
    return 'Not connected';
  }

  return mine.handle ? `Connected as ${mine.handle}` : 'Connected';
};

export function ConnectionRow({
  integration,
  mine,
  teamId,
}: ConnectionRowProps) {
  const { pathname } = useLocation();
  const connect = useConnectIntegration(teamId);

  return (
    <div>
      <SettingsRow
        label={integration.name}
        description={said(mine)}
        leading={<IntegrationLogo source={integration.source} />}
      >
        <div className="flex items-center gap-2">
          {mine && (
            <DisconnectButton
              teamId={teamId}
              source={integration.source}
              name={integration.name}
            />
          )}

          <PillButton
            variant={mine ? 'outline' : 'default'}
            aria-label={`${mine ? 'Reconnect' : 'Connect'} ${integration.name}`}
            disabled={connect.isPending}
            onClick={() =>
              connect.mutate({
                source: integration.source,
                for: 'me',
                back: pathname,
              })
            }
          >
            {connect.isPending ? 'Opening…' : mine ? 'Reconnect' : 'Connect'}
          </PillButton>
        </div>
      </SettingsRow>

      {mine && (
        <ConnectionTools
          teamId={teamId}
          source={integration.source}
          tools={mine.tools}
        />
      )}
    </div>
  );
}
