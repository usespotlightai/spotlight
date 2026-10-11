import { IntegrationLogo } from '@/components/features/integrations/IntegrationLogo';
import { setupLinkClass } from '@/components/features/onboarding/setup-control';
import type { SetupConnectionResponseDto } from '@/lib/api/types.gen';
import { since } from '@/lib/since';

type ConnectionRowProps = {
  connection: SetupConnectionResponseDto;
};

export function ConnectionRow({ connection }: ConnectionRowProps) {
  const opened = connection.firstOpenedAt;

  return (
    <li className="flex items-start gap-3">
      <IntegrationLogo source={connection.source} className="mt-1 size-4" />

      <div className="flex min-w-0 flex-1 flex-col items-start">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm leading-6">
          <span className="font-medium text-foreground">{connection.name}</span>
          {opened ? (
            <span className="text-emerald-700 dark:text-emerald-400">
              {connection.heard} {since(opened)}
            </span>
          ) : (
            <span className="text-muted-foreground">Waiting</span>
          )}
        </p>

        <p className="text-muted-foreground text-sm leading-6">
          {connection.tryIt}
        </p>

        {connection.link && !opened && (
          <div className="pt-2">
            <a
              href={connection.link.url}
              target="_blank"
              rel="noreferrer"
              className={setupLinkClass}
            >
              {connection.link.label}
            </a>
          </div>
        )}
      </div>
    </li>
  );
}
