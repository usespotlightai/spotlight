import { useLocation } from 'react-router';
import { ActionWithAlert } from '@/components/shared/ActionWithAlert';
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
    <ActionWithAlert
      alert={connect.isError ? 'Could not connect. Try again.' : null}
    >
      <PillButton
        data-need="you"
        variant="default"
        aria-label={
          connect.isPending
            ? undefined
            : `Connect your account for ${integration.name}`
        }
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
    </ActionWithAlert>
  );
}
