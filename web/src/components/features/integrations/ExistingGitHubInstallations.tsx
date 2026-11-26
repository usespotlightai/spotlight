import { useConnectGitHubInstallation } from '@/hooks/api/useConnectGitHubInstallation';
import { useGitHubInstallations } from '@/hooks/api/useGitHubInstallations';
import { messageOf } from '@/lib/error';
import { pillClass } from '@/lib/pill';
import { loading } from '@/lib/query';

type ExistingGitHubInstallationsProps = {
  slug: string;
};

export function ExistingGitHubInstallations({
  slug,
}: ExistingGitHubInstallationsProps) {
  const installations = useGitHubInstallations(slug);
  const connect = useConnectGitHubInstallation(slug);

  if (loading(installations)) {
    return null;
  }

  const found = installations.data ?? [];

  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-muted-foreground text-xs leading-5">
        {found.length > 0
          ? 'Already installed on GitHub? Connect it here.'
          : 'Already installed? If GitHub doesn’t send you back, change the App’s repository access on GitHub and save.'}
      </p>

      {found.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {found.map((each) => (
            <li key={each.id}>
              <button
                type="button"
                disabled={connect.isPending}
                onClick={() => connect.mutate(each.id)}
                className={pillClass('outline')}
              >
                Connect {each.account}
              </button>
            </li>
          ))}
        </ul>
      )}

      {connect.isError && (
        <p role="alert" className="text-destructive text-xs leading-5">
          {messageOf(
            connect.error,
            'Sorry, the GitHub App couldn’t connect. Please try again.',
          )}
        </p>
      )}
    </div>
  );
}
