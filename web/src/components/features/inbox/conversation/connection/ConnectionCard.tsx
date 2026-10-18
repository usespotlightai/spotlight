import { useLocation } from 'react-router';
import { DecisionCard } from '@/components/shared/DecisionCard';
import { DecisionHeader } from '@/components/shared/DecisionHeader';
import { DecisionTitle } from '@/components/shared/DecisionTitle';
import { PillButton } from '@/components/shared/PillButton';
import { useConnectIntegration } from '@/hooks/api/useConnectIntegration';
import type { InboxConnectionResponseDto } from '@/lib/api';

type ConnectionCardProps = {
  connection: InboxConnectionResponseDto;
  teamId: string | undefined;
  viewer: string | null;
};

export function ConnectionCard({
  connection,
  teamId,
  viewer,
}: ConnectionCardProps) {
  const { pathname } = useLocation();
  const connect = useConnectIntegration(teamId);
  const theirs = viewer === connection.personId;
  const who = connection.personName || 'the person who started this task';

  return (
    <DecisionCard aria-label={`Connect ${connection.integrationName}`}>
      <DecisionHeader
        title={
          <DecisionTitle status={connection.met ? 'approved' : 'pending'}>
            {connection.met
              ? `Connected ${connection.integrationName}`
              : `Connect ${connection.integrationName}`}
          </DecisionTitle>
        }
        trailing={
          !connection.met &&
          theirs &&
          teamId && (
            <PillButton
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
            </PillButton>
          )
        }
      />

      <p className="text-muted-foreground text-xs leading-5">
        {connection.met
          ? theirs
            ? `You connected ${connection.integrationName}. The run carried on.`
            : `${who} connected ${connection.integrationName}. The run carried on.`
          : theirs
            ? `If you connect your ${connection.integrationName} account, the run carries on.`
            : `The run is waiting for ${who} to connect ${connection.integrationName}.`}
      </p>
    </DecisionCard>
  );
}
