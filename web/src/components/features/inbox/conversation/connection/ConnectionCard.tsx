import { use } from 'react';
import { useLocation } from 'react-router';

import { DecisionButton } from '@/components/shared/DecisionButton';
import { DecisionCard } from '@/components/shared/DecisionCard';
import { DecisionControls } from '@/components/shared/DecisionControls';
import { DecisionHeader } from '@/components/shared/DecisionHeader';
import { DecisionTitle } from '@/components/shared/DecisionTitle';
import { PillButton } from '@/components/shared/PillButton';
import { useConnectIntegration } from '@/hooks/api/useConnectIntegration';
import type { InboxConnectionResponseDto } from '@/lib/api';
import { DockedContext } from '@/lib/decision-tray';

type ConnectionCardProps = {
  connection: InboxConnectionResponseDto;
  teamId: string | undefined;
  viewer: string | null;
  outdated?: boolean;
};

export function ConnectionCard({
  connection,
  teamId,
  viewer,
  outdated = false,
}: ConnectionCardProps) {
  const { pathname } = useLocation();
  const connect = useConnectIntegration(teamId);
  const theirs = viewer === connection.personId;
  const who = connection.personName || 'the person who started this task';
  const docked = use(DockedContext) !== null;
  const Action = docked ? DecisionButton : PillButton;
  const action =
    !connection.met && !outdated && theirs && teamId ? (
      <Action
        variant="default"
        disabled={connect.isPending}
        onClick={() =>
          connect.mutate({
            integration: connection.integration,
            actsAs: 'requester',
            returnTo: pathname,
          })
        }
      >
        {connect.isPending ? 'Opening…' : 'Connect'}
      </Action>
    ) : null;

  return (
    <DecisionCard
      aria-label={`Connect ${connection.integrationName}`}
      className="mt-4.5"
    >
      <DecisionHeader
        title={
          <DecisionTitle status={connection.met ? 'approved' : 'pending'}>
            {connection.met
              ? `Connected ${connection.integrationName}`
              : `Connect ${connection.integrationName}`}
          </DecisionTitle>
        }
        trailing={docked ? null : action}
      />

      <p className="text-muted-foreground text-xs leading-5">
        {connection.met
          ? theirs
            ? `You connected ${connection.integrationName}. The run carried on.`
            : `${who} connected ${connection.integrationName}. The run carried on.`
          : outdated
            ? 'The run asked for something newer since.'
            : theirs
              ? `If you connect your ${connection.integrationName} account, the run carries on.`
              : `The run is waiting for ${who} to connect ${connection.integrationName}.`}
      </p>

      {docked && action && <DecisionControls>{action}</DecisionControls>}
    </DecisionCard>
  );
}
