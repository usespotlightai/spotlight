import { TeamAccountButton } from '@/components/features/integrations/TeamAccountButton';
import { YourAccountButton } from '@/components/features/integrations/YourAccountButton';
import {
  actsAsEachPerson,
  type Integration,
  type MyConnection,
} from '@/lib/integration';

type IntegrationNeedProps = {
  integration: Integration;
  teamId: string;
  admin: boolean;
  mine: MyConnection | null;
};

export function IntegrationNeed({
  integration,
  teamId,
  admin,
  mine,
}: IntegrationNeedProps) {
  if (integration.standing === 'unlinked') {
    return admin ? (
      <TeamAccountButton integration={integration} teamId={teamId} />
    ) : (
      <span className="text-muted-foreground text-xs">
        Waiting for an admin
      </span>
    );
  }

  if (actsAsEachPerson(integration) && !mine) {
    return <YourAccountButton integration={integration} teamId={teamId} />;
  }

  return null;
}
