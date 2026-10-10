import { ArrowLeftRight } from 'lucide-react';
import { AccountActions } from '@/components/features/integrations/AccountActions';
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
    <AccountActions
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
  );
}
