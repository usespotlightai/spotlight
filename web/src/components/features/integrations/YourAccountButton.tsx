import { useLocation } from 'react-router';
import { PillButton } from '@/components/shared/PillButton';
import { useConnectIntegration } from '@/hooks/api/useConnectIntegration';
import type { Integration } from '@/lib/integration';

type YourAccountButtonProps = {
  integration: Integration;
  teamId: string;
};

export function YourAccountButton({
  integration,
  teamId,
}: YourAccountButtonProps) {
  const { pathname } = useLocation();
  const connect = useConnectIntegration(teamId);

  return (
    <PillButton
      variant="default"
      aria-label={`Connect your ${integration.name} account`}
      disabled={connect.isPending}
      onClick={() =>
        connect.mutate({
          source: integration.source,
          for: 'me',
          back: pathname,
        })
      }
    >
      {connect.isPending ? 'Opening…' : 'Connect your account'}
    </PillButton>
  );
}
