import { ArrowLeftRight } from 'lucide-react';
import { ActionWithAlert } from '@/components/shared/ActionWithAlert';
import { RowActions } from '@/components/shared/RowActions';
import { useConnectIntegration } from '@/hooks/api/useConnectIntegration';
import type { Integration } from '@/lib/integration';

type TeamAccountActionsProps = {
  integration: Integration;
  teamId: string;
};

export function TeamAccountActions({
  integration,
  teamId,
}: TeamAccountActionsProps) {
  const connect = useConnectIntegration(teamId);

  return (
    <ActionWithAlert
      alert={connect.isError ? 'Could not connect. Try again.' : null}
    >
      <RowActions
        label={`Actions for the team’s ${integration.name} account`}
        disabled={connect.isPending}
        actions={[
          {
            label: 'Change account',
            icon: ArrowLeftRight,
            onSelect: () => connect.mutate({ source: integration.source }),
          },
        ]}
      />
    </ActionWithAlert>
  );
}
