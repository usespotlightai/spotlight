import { IntegrationConnect } from '@/components/features/integrations/IntegrationConnect';
import { IntegrationLogo } from '@/components/features/integrations/IntegrationLogo';
import type { ConfiguredIntegrationResponseDto } from '@/lib/api';

type IntegrationCardProps = {
  integration: ConfiguredIntegrationResponseDto;
  teamId: string;
};

const said = ({
  standing,
  handle,
}: ConfiguredIntegrationResponseDto): string => {
  if (standing === 'listens') {
    return 'Listens for what the host sends.';
  }

  if (standing === 'unlinked') {
    return 'Not connected yet.';
  }

  return handle ? `Connected as ${handle}.` : 'Connected.';
};

export function IntegrationCard({ integration, teamId }: IntegrationCardProps) {
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
          </div>
        </div>

        <div className="mt-auto flex h-7 items-center justify-end gap-2">
          {integration.standing !== 'listens' && (
            <IntegrationConnect integration={integration} teamId={teamId} />
          )}
        </div>
      </div>
    </article>
  );
}
