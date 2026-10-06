import { IntegrationConnect } from '@/components/features/integrations/IntegrationConnect';
import { IntegrationDescribedSource } from '@/components/features/integrations/IntegrationDescribedSource';
import { IntegrationLogo } from '@/components/features/integrations/IntegrationLogo';
import { PillLink } from '@/components/shared/PillLink';
import type { ConfiguredIntegrationResponseDto } from '@/lib/api';
import { teamSettingsPath } from '@/lib/settings';

type IntegrationCardProps = {
  integration: ConfiguredIntegrationResponseDto;
  slug: string;
  teamId: string;
};

const said = ({
  standing,
  handle,
}: ConfiguredIntegrationResponseDto): string => {
  if (standing === 'listens') {
    return 'Listens for incoming events.';
  }

  if (standing === 'unlinked') {
    return 'Not connected yet.';
  }

  return handle ? `Connected as ${handle}.` : 'Connected.';
};

export function IntegrationCard({
  integration,
  slug,
  teamId,
}: IntegrationCardProps) {
  const personal = integration.holding === 'requester';

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex items-start gap-2.5">
          <IntegrationLogo source={integration.source} className="mt-px" />

          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h3 className="font-medium text-foreground text-sm">
              {integration.name}
            </h3>
            <p className="text-muted-foreground text-xs leading-5">
              {said(integration)}
            </p>
            {integration.described && (
              <IntegrationDescribedSource described={integration.described} />
            )}
            {personal && (
              <p className="text-muted-foreground text-xs leading-5">
                Its tools act as each person who starts a task.
              </p>
            )}
          </div>
        </div>

        <div className="mt-auto flex h-7 items-center justify-end gap-2">
          {personal && (
            <PillLink to={teamSettingsPath(slug, teamId, 'connections')}>
              Your connection
            </PillLink>
          )}
          {integration.standing !== 'listens' && (
            <IntegrationConnect integration={integration} teamId={teamId} />
          )}
        </div>
      </div>
    </article>
  );
}
