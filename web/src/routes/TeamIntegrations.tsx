import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';
import { GitHubIntegration } from '@/components/integrations/GitHubIntegration';
import { IntegrationCard } from '@/components/integrations/IntegrationCard';
import { SettingsPage } from '@/components/settings/SettingsPage';
import { Button } from '@/components/ui/button';
import {
  useConfiguration,
  useRereadConfiguration,
} from '@/hooks/api/useConfiguration';
import { useChooseTools, useOnboarding } from '@/hooks/api/useOnboarding';
import { shownTogether } from '@/lib/integrations';

/**
 * What this team listens to, and what it could. Written down or not, a host
 * is one card, and the change between them is a pull request.
 */
export function TeamIntegrations() {
  const { slug, teamId } = useParams();
  const { data: onboarding } = useOnboarding(teamId);
  const { data: configuration, isPending } = useConfiguration(teamId);
  const reread = useRereadConfiguration(teamId);
  const choose = useChooseTools(teamId);

  /**
   * What this team has asked for, against what its repository holds. Kept
   * after the pull request is opened: what was asked for is not true until
   * somebody merges it, and the card says so until the next read shows it.
   */
  const [wanted, setWanted] = useState<ReadonlyMap<string, boolean>>(new Map());

  if (isPending || !teamId) {
    return null;
  }

  const shown = shownTogether(
    onboarding?.tools ?? [],
    configuration?.integrations ?? [],
  );

  const listening = (source: string) =>
    shown.some((each) => each.source === source && each.integration !== null);

  const selected = (source: string) => wanted.get(source) ?? listening(source);

  const toggle = (source: string) =>
    setWanted((held) => {
      const next = new Map(held);
      next.set(source, !selected(source));
      return next;
    });

  const asked = [...wanted].filter(([source, on]) => on !== listening(source));
  const sources = asked.filter(([, on]) => on).map(([source]) => source);
  const dropped = asked.filter(([, on]) => !on).map(([source]) => source);
  const changed = sources.length + dropped.length;

  return (
    <SettingsPage
      title="Integrations"
      description="The hosts this team listens to, written as files in its configuration repository. Push a change and Spotlight reads it again."
    >
      {onboarding && (
        <section className="flex flex-col gap-3">
          <h2 className="flex h-6 items-center font-medium text-muted-foreground text-xs">
            GitHub
          </h2>

          <div className="grid auto-rows-fr gap-3 sm:grid-cols-2">
            <GitHubIntegration
              slug={slug}
              teamId={teamId}
              installUrl={onboarding.installUrl}
              connected={onboarding.connectedToGitHub}
              repository={onboarding.configRepository}
            />
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex h-6 items-center font-medium text-muted-foreground text-xs">
            Hosts
          </h2>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => reread.mutate()}
              disabled={reread.isPending}
              className="rounded-full bg-card shadow-none"
            >
              <RefreshCw className="size-3.5" aria-hidden />
              {reread.isPending ? 'Reading…' : 'Read again'}
            </Button>

            <Button
              size="sm"
              disabled={changed === 0 || choose.isPending}
              onClick={() => choose.mutate({ sources, dropped })}
              className="rounded-full shadow-none"
            >
              {choose.isPending ? 'Opening…' : 'Open pull request'}
            </Button>
          </div>
        </div>

        {configuration?.repository && (
          <p className="text-muted-foreground text-xs">
            Read from{' '}
            <span className="text-foreground">{configuration.repository}</span>{' '}
            at{' '}
            <span className="text-foreground">
              {configuration.sha?.slice(0, 7)}
            </span>
          </p>
        )}

        <div className="grid auto-rows-fr gap-3 sm:grid-cols-2">
          {shown.map((each) => (
            <IntegrationCard
              key={each.source}
              shown={each}
              teamId={teamId}
              selected={selected(each.source)}
              onToggle={() => toggle(each.source)}
            />
          ))}
        </div>
      </section>
    </SettingsPage>
  );
}
