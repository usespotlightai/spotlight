import { Check, TriangleAlert } from 'lucide-react';
import { Pill } from '@/components/common/Pill';
import { SetSecret } from '@/components/integrations/SetSecret';
import type { ConfiguredIntegrationResponseDto } from '@/lib/api';

type IntegrationCardProps = {
  integration: ConfiguredIntegrationResponseDto;
  teamId: string | undefined;
};

export function IntegrationCard({ integration, teamId }: IntegrationCardProps) {
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="font-medium text-foreground text-sm">
            {integration.name}
          </h3>
          <p className="text-muted-foreground text-xs">{integration.source}</p>
        </div>

        {integration.secretSet ? (
          <Pill lead={<Check className="size-3" aria-hidden />}>Ready</Pill>
        ) : (
          <Pill
            lead={<TriangleAlert className="size-3" aria-hidden />}
            className="border-amber-500/30 text-amber-600 dark:text-amber-400"
          >
            Needs a secret
          </Pill>
        )}
      </div>

      <dl className="flex flex-col gap-2 text-xs">
        <div className="flex flex-col gap-1">
          <dt className="text-muted-foreground">Send deliveries to</dt>
          <dd className="break-all rounded bg-muted px-2 py-1 font-mono text-foreground">
            {integration.deliverTo}
          </dd>
        </div>

        <div className="flex flex-col gap-1">
          <dt className="text-muted-foreground">
            {integration.secretSet
              ? 'Signed with the secret named'
              : 'Set this secret before it will listen'}
          </dt>
          <dd className="flex flex-col gap-1.5">
            <span className="font-mono text-foreground">
              {integration.secret}
            </span>
            <SetSecret
              teamId={teamId}
              name={integration.secret}
              isSet={integration.secretSet}
            />
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-1.5 border-border border-t pt-3">
        {integration.happenings.map((raised) => (
          <Pill key={raised.happening}>{raised.label}</Pill>
        ))}
      </div>
    </article>
  );
}
