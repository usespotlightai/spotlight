import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { GitHubIntegration } from '@/components/features/integrations/GitHubIntegration';
import { IntegrationCard } from '@/components/features/integrations/IntegrationCard';
import { SecretsPrompt } from '@/components/features/integrations/SecretsPrompt';
import { SettingsPage } from '@/components/features/settings/SettingsPage';
import { ProposedPullRequest } from '@/components/shared/ProposedPullRequest';
import { RereadConfigurationButton } from '@/components/shared/RereadConfigurationButton';
import { Button } from '@/components/ui/button';
import { useConfiguration } from '@/hooks/api/useConfiguration';
import {
  useChooseIntegrations,
  useOnboarding,
} from '@/hooks/api/useOnboarding';
import { messageOf } from '@/lib/error';
import { shownTogether } from '@/lib/integrations';

export function TeamIntegrations() {
  const { slug, teamId } = useParams();
  const { data: onboarding, isPending: loadingOnboarding } =
    useOnboarding(teamId);
  const { data: configuration, isPending: loadingConfiguration } =
    useConfiguration(teamId);
  const choose = useChooseIntegrations(teamId);

  const [params, setParams] = useSearchParams();
  const connected = params.get('connected');
  useEffect(() => {
    if (!connected) {
      return;
    }
    setParams(
      (held) => {
        held.delete('connected');
        return held;
      },
      { replace: true },
    );
  }, [connected, setParams]);

  const [wanted, setWanted] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [prompting, setPrompting] = useState(false);

  if (loadingOnboarding || loadingConfiguration || !teamId) {
    return null;
  }

  const shown = shownTogether(
    onboarding?.integrations ?? [],
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

  const needingSecrets = (onboarding?.integrations ?? []).filter(
    (integration) =>
      sources.includes(integration.source) && integration.secrets.length > 0,
  );

  const failed = choose.error
    ? messageOf(choose.error, 'The pull request could not be opened.')
    : null;

  const openPullRequest = () => {
    if (needingSecrets.length > 0) {
      setPrompting(true);
      return;
    }

    choose.mutate({ sources, dropped });
  };

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
            <RereadConfigurationButton teamId={teamId} />

            <Button
              size="sm"
              disabled={changed === 0 || choose.isPending}
              onClick={openPullRequest}
              className="rounded-full shadow-none"
            >
              {choose.isPending ? 'Opening…' : 'Open pull request'}
            </Button>
          </div>
        </div>

        {!prompting && failed && (
          <p className="text-destructive text-sm">{failed}</p>
        )}

        {choose.data?.url && (
          <ProposedPullRequest url={choose.data.url}>
            Merge the pull request to apply the change.
          </ProposedPullRequest>
        )}

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
              repository={configuration?.repository ?? null}
              selected={selected(each.source)}
              onToggle={() => toggle(each.source)}
            />
          ))}
        </div>
      </section>

      {prompting && (
        <SecretsPrompt
          integrations={needingSecrets}
          onOpenChange={setPrompting}
          pending={choose.isPending}
          error={failed}
          onSubmit={(secrets) =>
            choose.mutate(
              { sources, dropped, secrets },
              { onSuccess: () => setPrompting(false) },
            )
          }
        />
      )}
    </SettingsPage>
  );
}
