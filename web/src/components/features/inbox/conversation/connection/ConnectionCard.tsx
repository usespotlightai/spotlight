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
    <DecisionCard aria-label={`Connect ${connection.integration}`}>
      <DecisionHeader
        title={
          <DecisionTitle standing={connection.met ? 'approved' : 'waiting'}>
            {connection.met
              ? `Connected ${connection.integration}`
              : `Connect ${connection.integration}`}
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
                  source: connection.source,
                  for: 'me',
                  back: pathname,
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
            ? `You connected ${connection.integration}, so the run carried on.`
            : `${who} connected ${connection.integration}, so the run carried on.`
          : theirs
            ? `Connect your ${connection.integration} account and the run carries on.`
            : `Waiting for ${who} to connect ${connection.integration}.`}
      </p>
    </DecisionCard>
  );
}
