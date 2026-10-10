import { Unplug } from 'lucide-react';
import { AccountActions } from '@/components/features/integrations/AccountActions';
import { useDisconnect } from '@/hooks/api/useDisconnect';
import type { Integration } from '@/lib/integration';

type YourAccountActionsProps = {
  integration: Integration;
  teamId: string;
};

export function YourAccountActions({
  integration,
  teamId,
}: YourAccountActionsProps) {
  const disconnect = useDisconnect(teamId);

  return (
    <AccountActions
      label={`Actions for your ${integration.name} account`}
      disabled={disconnect.isPending}
      actions={[
        {
          label: 'Disconnect',
          icon: Unplug,
          onSelect: () => disconnect.mutate(integration.source),
        },
      ]}
    />
  );
}
