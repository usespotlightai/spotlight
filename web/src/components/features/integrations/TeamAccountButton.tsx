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
    <PillButton
      variant="default"
      aria-label={`Connect the team’s ${integration.name} account`}
      disabled={connect.isPending}
      onClick={() => connect.mutate({ source: integration.source })}
    >
      {connect.isPending ? 'Opening…' : 'Connect team account'}
    </PillButton>
  );
}
