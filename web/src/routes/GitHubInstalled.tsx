import { useEffect } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { useConnectGitHub } from '@/hooks/api/useConnectGitHub';
import { whenceFrom } from '@/lib/github';
import { settingsPath } from '@/lib/team';

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
      whence.from ?? settingsPath(whence.slug, whence.teamId, 'integrations'),
      { replace: true },
    );
  }, [connected, navigate, whence]);

  if (!whence) {
    return <Navigate to="/" replace />;
  }

  const back =
    whence.from ?? settingsPath(whence.slug, whence.teamId, 'integrations');

  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <div className="flex w-96 flex-col gap-3 text-center">
        {requested ? (
          <>
            <h1 className="font-medium text-foreground text-lg">
              Asked for on your behalf
            </h1>
            <p className="text-muted-foreground text-sm leading-6">
              Somebody who owns that GitHub organisation has to approve the App
              before Spotlight can read or write anything.
            </p>
          </>
        ) : connect.isError ? (
          <>
            <h1 className="font-medium text-foreground text-lg">
              That did not connect
            </h1>
            <p role="alert" className="text-destructive text-sm leading-6">
              {connect.error.message}
            </p>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">
            Connecting the App to your workspace…
          </p>
        )}

        {(requested || connect.isError) && (
          <button
            type="button"
            onClick={() => void navigate(back, { replace: true })}
            className="text-foreground text-sm underline underline-offset-2 hover:opacity-70"
          >
            Back to the team’s integrations
          </button>
        )}
      </div>
    </main>
  );
}
