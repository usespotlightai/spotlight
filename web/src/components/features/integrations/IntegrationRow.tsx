import { IntegrationDetails } from '@/components/features/integrations/IntegrationDetails';
import { IntegrationLogo } from '@/components/features/integrations/IntegrationLogo';
import { IntegrationNeed } from '@/components/features/integrations/IntegrationNeed';
import { IntegrationReadProblem } from '@/components/features/integrations/IntegrationReadProblem';
import { IntegrationRowFrame } from '@/components/features/integrations/IntegrationRowFrame';
import {
  formatUsedFor,
  type Integration,
  type Joined,
  type MyConnection,
} from '@/lib/integration';

type IntegrationRowProps = {
  integration: Integration;
  teamId: string;
  admin: boolean;
  mine: MyConnection | null;
  joined: Joined | null;
};

export function IntegrationRow({
  integration,
  teamId,
  admin,
  mine,
  joined,
}: IntegrationRowProps) {
  return (
    <IntegrationRowFrame
      slot="integration"
      logo={<IntegrationLogo integration={integration.integration} />}
      name={integration.name}
      mark={
        integration.spec && <IntegrationReadProblem spec={integration.spec} />
      }
      summary={formatUsedFor(integration)}
      need={
        <IntegrationNeed
          integration={integration}
          teamId={teamId}
          admin={admin}
          mine={mine}
        />
      }
    >
      <IntegrationDetails
        integration={integration}
        teamId={teamId}
        admin={admin}
        mine={mine}
        joined={joined}
      />
    </IntegrationRowFrame>
  );
}
