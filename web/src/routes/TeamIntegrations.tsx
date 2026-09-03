import { RefreshCw } from 'lucide-react';
import { useParams } from 'react-router';
import { ConfigProblems } from '@/components/integrations/ConfigProblems';
import { IntegrationCard } from '@/components/integrations/IntegrationCard';
import { ChooseTools } from '@/components/onboarding/ChooseTools';
import { Prerequisite } from '@/components/onboarding/Prerequisite';
import { SettingsPage } from '@/components/settings/SettingsPage';
import { Button } from '@/components/ui/button';
import {
  useConfiguration,
  useRereadConfiguration,
} from '@/hooks/api/useConfiguration';
import { useOnboarding } from '@/hooks/api/useOnboarding';

/**
 * What this team listens to, and what it still needs before any of it does
 * anything. The two are one page because they are one question asked at
 * different times: on the first day it reads as a list of things to do, and
 * afterwards as a list of hosts.
 */
export function TeamIntegrations() {
  const { teamId } = useParams();
  const { data: onboarding } = useOnboarding(teamId);
  const { data: configuration, isPending } = useConfiguration(teamId);
  const reread = useRereadConfiguration(teamId);

  if (isPending || !teamId) {
    return null;
  }

  const integrations = configuration?.integrations ?? [];
  const problems = configuration?.problems ?? [];
  const ready =
    onboarding?.hasRunner &&
    onboarding.connectedToGitHub &&
    onboarding.hasConfiguration;

  return (
    <SettingsPage
      title="Integrations"
      description="The hosts this team listens to, written as files in the workspace’s repository. Push a change and Spotlight reads it again."
    >
      {onboarding && !ready && (
        <section className="flex flex-col gap-2">
          <h2 className="flex h-6 items-center font-medium text-muted-foreground text-xs">
            Before any of this does anything
          </h2>
          <ul className="flex flex-col gap-2">
            <Prerequisite done={onboarding.hasRunner} title="Start a runner">
              A runner is the machine that does the work. Without one, tasks
              move but nothing runs.
            </Prerequisite>
            <Prerequisite
              done={onboarding.connectedToGitHub}
              title="Install the GitHub App"
            >
              Spotlight reads this team’s configuration from a repository and
              writes changes back as pull requests. The App is how it reaches
              them.
            </Prerequisite>
            <Prerequisite
              done={onboarding.hasConfiguration}
              title="Merge the opening pull request"
            >
              Installing opens one carrying what this team already runs. Until
              it is merged there is nothing to read.
            </Prerequisite>
          </ul>
        </section>
      )}

      {onboarding && (
        <ChooseTools
          teamId={teamId}
          tools={onboarding.tools}
          canWrite={onboarding.connectedToGitHub}
        />
      )}

      <ConfigProblems problems={problems} />

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex h-6 items-center font-medium text-muted-foreground text-xs">
            {integrations.length === 1
              ? '1 integration'
              : `${integrations.length} integrations`}
          </h2>

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
        </div>

        {configuration?.repository && (
          <p className="text-muted-foreground text-xs">
            Read from{' '}
            <span className="font-mono text-foreground">
              {configuration.repository}
            </span>{' '}
            at{' '}
            <span className="font-mono text-foreground">
              {configuration.sha?.slice(0, 7)}
            </span>
          </p>
        )}

        {integrations.length === 0 ? (
          <p className="rounded-lg border border-border border-dashed bg-card/50 p-6 text-center text-muted-foreground text-sm">
            No hosts declared yet.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {integrations.map((integration) => (
              <IntegrationCard
                key={integration.source}
                integration={integration}
                teamId={teamId}
              />
            ))}
          </div>
        )}
      </section>
    </SettingsPage>
  );
}
