import { ArrowLeft } from 'lucide-react';
import { useEffect } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { useConnectGitHub } from '@/hooks/api/useConnectGitHub';
import { whenceFrom } from '@/lib/github';
import { failed } from '@/lib/query';
import { teamSettingsPath } from '@/lib/settings';

export function GitHubInstalled() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const installationId = params.get('installation_id');
  const whence = whenceFrom(params.get('state'));
  const requested = params.get('setup_action') === 'request';

  const connect = useConnectGitHub(
    whence?.slug,
    requested ? null : installationId,
  );
  const connected = connect.isSuccess;

  useEffect(() => {
    if (!connected || !whence) {
      return;
    }

    void navigate(
      whence.from ??
        teamSettingsPath(whence.slug, whence.teamId, 'integrations'),
      { replace: true },
    );
  }, [connected, navigate, whence]);

  if (!whence) {
    return <Navigate to="/" replace />;
  }

  const back =
    whence.from ?? teamSettingsPath(whence.slug, whence.teamId, 'integrations');

  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <div className="flex w-96 flex-col gap-3 text-center">
        {requested ? (
          <>
            <h1 className="font-medium text-foreground text-lg">
              Approval requested
            </h1>
            <p className="text-muted-foreground text-sm leading-6">
              A GitHub organisation owner must approve the App. Until then,
              Spotlight can’t read or write anything.
            </p>
          </>
        ) : failed(connect) ? (
          <>
            <h1 className="font-medium text-foreground text-lg">
              Sorry, the GitHub App couldn’t connect
            </h1>
            <p className="text-muted-foreground text-sm leading-6">
              Please try again in a few minutes, or reinstall it from the team’s
              integrations.
            </p>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">
            Connecting the App to your workspace…
          </p>
        )}

        {(requested || failed(connect)) && (
          <button
            type="button"
            onClick={() => void navigate(back, { replace: true })}
            className="flex items-center gap-1.5 self-center rounded-md px-1.5 py-0.5 text-foreground text-sm outline-none transition-colors hover:bg-border/50 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to the team’s integrations
          </button>
        )}
      </div>
    </main>
  );
}
