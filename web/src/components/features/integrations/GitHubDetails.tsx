import { GitHubAppLink } from '@/components/features/integrations/GitHubAppLink';
import { FACT_LABEL, FACT_VALUE, FactRow } from '@/components/shared/FactRow';
import { NotedWarning } from '@/components/shared/NotedWarning';
import { unreachedOf } from '@/lib/github';

type GitHubDetailsProps = {
  installed: boolean;
  href: string | null;
  reached: readonly string[];
  used: readonly string[];
};

export function GitHubDetails({
  installed,
  href,
  reached,
  used,
}: GitHubDetailsProps) {
  const unreached = unreachedOf(used, reached);

  return (
    <dl className="flex flex-col gap-2 pr-4 pb-4 pl-12">
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
          <dt className={FACT_LABEL}>Reaches</dt>
          <dd className={FACT_VALUE}>
            {reached.length > 0 ? reached.join(', ') : 'No repositories'}
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
                  {unreached.has(repository) && (
                    <NotedWarning
                      tone="destructive"
                      label="Not reached"
                      note={`The App can’t reach ${repository}. Agents can’t work in it. Please give the App access on GitHub.`}
                    />
                  )}
                </li>
              ))}
            </ul>
          </dd>
        </FactRow>
      )}
    </dl>
  );
}
