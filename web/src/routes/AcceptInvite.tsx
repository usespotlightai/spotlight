import { useNavigate, useParams } from 'react-router';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { AuthScreen } from '@/components/shell/auth/AuthScreen';
import { AuthTitle } from '@/components/shell/auth/AuthTitle';
import { ContinueWithGitHub } from '@/components/shell/auth/ContinueWithGitHub';
import { ErrorMessage } from '@/components/shell/auth/ErrorMessage';
import { Button } from '@/components/ui/button';
import { useAcceptInvite } from '@/hooks/api/useAcceptInvite';
import { useInvite } from '@/hooks/api/useInvite';
import { useSession } from '@/hooks/api/useSession';
import { useSignIn } from '@/hooks/api/useSignIn';
import { failed, loading } from '@/lib/query';

const WIDTH = 'w-80';

const SAYS: Record<string, string> = {
  accepted: 'This invitation has already been accepted.',
  revoked: 'This invitation has been taken back.',
  expired: 'This invitation has run out. Ask for another.',
};

export function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { data: session, isPending: reading } = useSession();
  const offer = useInvite(token);
  const signIn = useSignIn(`/invites/${token}`);
  const accept = useAcceptInvite(token);

  if (loading(offer) || reading) {
    return null;
  }

  if (failed(offer)) {
    return (
      <AuthScreen className={WIDTH}>
        <CouldNotLoad
          what="The invitation"
          retrying={offer.isFetching}
          onRetry={() => void offer.refetch()}
        />
      </AuthScreen>
    );
  }

  const invite = offer.data;

  if (!invite) {
    return (
      <AuthScreen className={WIDTH}>
        <AuthTitle title="This invitation link does not work">
          It may have been taken back, or copied only in part. Ask whoever
          invited you to send another.
        </AuthTitle>
      </AuthScreen>
    );
  }

  const signedInAs = session?.user.email;
  const closed = invite.standing !== 'open';
  const asSomeoneElse = signedInAs !== undefined && signedInAs !== invite.email;

  return (
    <AuthScreen className={WIDTH}>
      <AuthTitle
        title={`${invite.invitedBy} invited you to ${invite.teamName}`}
      >
        in the {invite.workspaceName} workspace on Spotlight.
      </AuthTitle>

      {closed ? (
        <p role="alert" className="text-center text-muted-foreground text-sm">
          {SAYS[invite.standing]}
        </p>
      ) : session?.user ? (
        <div className="flex flex-col gap-3">
          {asSomeoneElse ? (
            <p
              role="alert"
              className="text-center text-muted-foreground text-sm"
            >
              It was sent to {invite.email}, and you are signed in as{' '}
              {signedInAs}. Sign in as them to accept it.
            </p>
          ) : (
            <Button
              size="lg"
              className="self-center rounded-full px-6"
              disabled={accept.isPending}
              onClick={() =>
                accept.mutate(undefined, {
                  onSuccess: (joined) =>
                    joined &&
                    navigate(
                      `/w/${joined.workspaceSlug}/team/${joined.teamId}`,
                      { replace: true },
                    ),
                })
              }
            >
              {accept.isPending ? 'Joining…' : 'Accept invitation'}
            </Button>
          )}

          {accept.isError && <ErrorMessage error={accept.error} />}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <ContinueWithGitHub
            onClick={() => signIn.mutate()}
            disabled={signIn.isPending}
          />

          {signIn.isError && <ErrorMessage error={signIn.error} />}
        </div>
      )}
    </AuthScreen>
  );
}
