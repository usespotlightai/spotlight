import { Unplug } from 'lucide-react';
import type { ReactElement } from 'react';

import { RowActions } from '@/components/shared/RowActions';
import { useDisconnectIntegration } from '@/hooks/api/useDisconnectIntegration';
import type { Integration } from '@/lib/integration';

type YourAccountActionsProps = {
  integration: Integration;
  teamId: string;
};

export function YourAccountActions({
  integration,
  teamId,
}: YourAccountActionsProps): ReactElement {
  const disconnect = useDisconnectIntegration(teamId);

  return (
    <RowActions
      label={`Actions for your ${integration.name} account`}
      disabled={disconnect.isPending}
      actions={[
        {
          label: 'Disconnect',
          icon: Unplug,
          onSelect: () => disconnect.mutate(integration.integration),
        },
      ]}
    />
  );
}
