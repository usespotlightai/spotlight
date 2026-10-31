import { GitHubAppLink } from '@/components/features/integrations/GitHubAppLink';
import { IntegrationFacts } from '@/components/features/integrations/IntegrationFacts';
import { FACT_LABEL, FACT_VALUE, FactRow } from '@/components/shared/FactRow';
import { WarningTooltip } from '@/components/shared/WarningTooltip';
import { inaccessibleOf } from '@/lib/github';

type GitHubDetailsProps = {
  installed: boolean;
  href: string | null;
  accessible: readonly string[];
  used: readonly string[];
};

export function GitHubDetails({
  installed,
  href,
  accessible,
  used,
}: GitHubDetailsProps) {
  const inaccessible = inaccessibleOf(used, accessible);

  return (
    <IntegrationFacts>
      <FactRow>
        <dt className={FACT_LABEL}>App</dt>
        <dd className={FACT_VALUE}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col">
              <span
                className={
                  installed ? 'text-foreground' : 'text-muted-foreground'
                }
              >
                {installed ? 'Installed' : 'Not installed'}
              </span>
              <span className="text-muted-foreground text-xs leading-5">
                Agents read code and open pull requests through it.
              </span>
            </div>
            {href && <GitHubAppLink href={href} installed={installed} />}
          </div>
        </dd>
      </FactRow>

      {installed && (
        <FactRow>
          <dt className={FACT_LABEL}>Can access</dt>
          <dd className={FACT_VALUE}>
            {accessible.length > 0 ? accessible.join(', ') : 'No repositories'}
          </dd>
        </FactRow>
      )}

      {used.length > 0 && (
        <FactRow>
          <dt className={FACT_LABEL}>Lines use</dt>
          <dd className={FACT_VALUE}>
            <ul className="flex flex-wrap gap-x-3 gap-y-1">
              {used.map((repository) => (
                <li key={repository} className="flex items-center gap-1.5">
                  {repository}
                  {inaccessible.has(repository) && (
                    <WarningTooltip
                      tone="destructive"
                      label="Not accessible"
                      tooltip={`The App can’t access ${repository}. Agents can’t work in it. Please grant the App access on GitHub.`}
                    />
                  )}
                </li>
              ))}
            </ul>
          </dd>
        </FactRow>
      )}
    </IntegrationFacts>
  );
}
