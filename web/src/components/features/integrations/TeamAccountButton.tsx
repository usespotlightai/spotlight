import { ActionWithAlert } from '@/components/features/integrations/ActionWithAlert';
import { PillButton } from '@/components/shared/PillButton';
import { useConnectIntegration } from '@/hooks/api/useConnectIntegration';
import type { Integration } from '@/lib/integration';

type TeamAccountButtonProps = {
  integration: Integration;
  teamId: string;
};

export function TeamAccountButton({
  integration,
  teamId,
}: TeamAccountButtonProps) {
  const connect = useConnectIntegration(teamId);

  return (
    <ActionWithAlert
      alert={connect.isError ? 'Could not connect. Try again.' : null}
    >
      <PillButton
        variant="default"
        aria-label={
          connect.isPending
            ? undefined
            : `Connect team account for ${integration.name}`
        }
        disabled={connect.isPending}
        onClick={() => connect.mutate({ source: integration.source })}
      >
        {connect.isPending ? 'Opening…' : 'Connect team account'}
      </PillButton>
    </ActionWithAlert>
  );
}
