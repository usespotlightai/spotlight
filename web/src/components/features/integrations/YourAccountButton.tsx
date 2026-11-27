import type { ReactElement } from 'react';
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
}: YourAccountButtonProps): ReactElement {
  const { pathname } = useLocation();
  const connect = useConnectIntegration(teamId);

  return (
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
          integration: integration.integration,
          actsAs: 'requester',
          returnTo: pathname,
        })
      }
    >
      {connect.isPending ? 'Opening…' : 'Connect your account'}
    </PillButton>
  );
}
