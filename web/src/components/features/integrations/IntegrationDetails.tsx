import { IntegrationAccount } from '@/components/features/integrations/IntegrationAccount';
import { IntegrationPeople } from '@/components/features/integrations/IntegrationPeople';
import { TeamAccountActions } from '@/components/features/integrations/TeamAccountActions';
import { TeamAccountButton } from '@/components/features/integrations/TeamAccountButton';
import { YourAccountActions } from '@/components/features/integrations/YourAccountActions';
import { YourAccountButton } from '@/components/features/integrations/YourAccountButton';
import { YourToolRules } from '@/components/features/integrations/YourToolRules';
import { FACT_LABEL, FACT_VALUE, FactRow } from '@/components/shared/FactRow';
import { formatReadProblem, formatToolsRead } from '@/lib/described';
import {
  actsAsEachPerson,
  type Integration,
  type Joined,
  type MyConnection,
  teamAccountPurpose,
  usesTeamAccount,
} from '@/lib/integration';
import { cn } from '@/lib/utils';

type IntegrationDetailsProps = {
  integration: Integration;
  teamId: string;
  admin: boolean;
  mine: MyConnection | null;
  joined: Joined | null;
};

export function IntegrationDetails({
  integration,
  teamId,
  admin,
  mine,
  joined,
}: IntegrationDetailsProps) {
  const { described } = integration;
  const problem = described ? formatReadProblem(described) : null;

  return (
    <dl className="flex flex-col gap-2 pr-4 pb-4 pl-12">
      {usesTeamAccount(integration) && (
        <FactRow>
          <dt className={FACT_LABEL}>Team account</dt>
          <dd className={FACT_VALUE}>
            <IntegrationAccount
              handle={integration.handle}
              connected={integration.standing === 'linked'}
              purpose={teamAccountPurpose(integration)}
              action={
                admin &&
                (integration.standing === 'linked' ? (
                  <TeamAccountActions
                    integration={integration}
                    teamId={teamId}
                  />
                ) : (
                  <TeamAccountButton
                    integration={integration}
                    teamId={teamId}
                  />
                ))
              }
            />
          </dd>
        </FactRow>
      )}

      {actsAsEachPerson(integration) && (
        <FactRow>
          <dt className={FACT_LABEL}>Your account</dt>
          <dd className={FACT_VALUE}>
            <IntegrationAccount
              handle={mine?.handle ?? null}
              connected={Boolean(mine)}
              purpose="Its tools act as you on tasks you start."
              action={
                mine ? (
                  <YourAccountActions
                    integration={integration}
                    teamId={teamId}
                  />
                ) : (
                  <YourAccountButton
                    integration={integration}
                    teamId={teamId}
                  />
                )
              }
            />
          </dd>
        </FactRow>
      )}

      {mine && mine.tools.length > 0 && (
        <FactRow>
          <dt className={FACT_LABEL}>Acting as you</dt>
          <dd className={FACT_VALUE}>
            <YourToolRules
              teamId={teamId}
              source={integration.source}
              tools={mine.tools}
            />
          </dd>
        </FactRow>
      )}

      {joined && (
        <FactRow>
          <dt className={FACT_LABEL}>People</dt>
          <dd className={FACT_VALUE}>
            <IntegrationPeople joined={joined} />
          </dd>
        </FactRow>
      )}

      {described && (
        <FactRow>
          <dt className={FACT_LABEL}>Tools</dt>
          <dd className={cn(FACT_VALUE, problem && 'text-destructive')}>
            {problem ?? formatToolsRead(described)}
          </dd>
        </FactRow>
      )}

      <FactRow>
        <dt className={FACT_LABEL}>Defined in</dt>
        <dd className={FACT_VALUE}>{integration.path}</dd>
      </FactRow>
    </dl>
  );
}
