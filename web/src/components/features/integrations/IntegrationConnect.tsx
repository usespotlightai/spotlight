import { Button } from '@/components/ui/button';
import { useConnectIntegration } from '@/hooks/api/useConnectIntegration';
import type { ConfiguredIntegrationResponseDto } from '@/lib/api';

type IntegrationConnectProps = {
  integration: ConfiguredIntegrationResponseDto;
  teamId: string;
};

export function IntegrationConnect({
  integration,
  teamId,
}: IntegrationConnectProps) {
  const connect = useConnectIntegration(teamId);
  const handle = integration.connection?.handle;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => connect.mutate(integration.source)}
      disabled={connect.isPending}
      title={
        integration.connection
          ? `Connected${handle ? ` as ${handle}` : ''}`
          : undefined
      }
      className="pointer-events-auto rounded-full bg-card shadow-none"
    >
      {connect.isPending
        ? 'Opening…'
        : integration.connection
          ? `Reconnect to ${integration.name}`
          : `Connect to ${integration.name}`}
    </Button>
  );
}
