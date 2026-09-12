import { useNavigate, useParams } from 'react-router';
import { LogoLockup } from '@/components/shared/brand/LogoLockup';
import { GithubMark } from '@/components/shared/icons';
import { Button } from '@/components/ui/button';
import { useAcceptInvite } from '@/hooks/api/useAcceptInvite';
import { useInvite } from '@/hooks/api/useInvite';
import { useSession } from '@/hooks/api/useSession';
import { useSignIn } from '@/hooks/api/useSignIn';
import { messageOf } from '@/lib/error';

const SAYS: Record<string, string> = {
  accepted: 'This invitation has already been accepted.',
  revoked: 'This invitation has been taken back.',
  expired: 'This invitation has run out. Ask for another.',
};

export function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { data: session, isPending: reading } = useSession();
  const { data: invite, isPending, isError } = useInvite(token);
  const signIn = useSignIn(`/invites/${token}`);
  const accept = useAcceptInvite(token);

  if (isPending || reading) {
    return null;
  }

  const signedInAs = session?.user.email;
  const closed = invite && invite.standing !== 'open';
  const asSomeoneElse =
    invite && signedInAs !== undefined && signedInAs !== invite.email;

  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <div className="flex w-80 flex-col gap-6">
        <LogoLockup className="mx-auto" />

        {isError || !invite ? (
          <>
            <h1 className="text-center font-medium text-foreground text-sm">
              This invitation link does not work
            </h1>
            <p className="text-center text-muted-foreground text-sm">
              It may have been taken back, or copied only in part. Ask whoever
              invited you to send another.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-center font-medium text-foreground text-sm">
              {invite.invitedBy} invited you to {invite.teamName}
            </h1>
            <p className="text-center text-muted-foreground text-sm">
              in the {invite.workspaceName} workspace on Spotlight.
            </p>

            {closed ? (
              <p
                role="alert"
                className="text-center text-muted-foreground text-sm"
              >
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
                    className="w-full rounded-full"
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

                {accept.isError && (
                  <p
                    role="alert"
                    className="text-center text-destructive text-sm"
                  >
                    {messageOf(accept.error)}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-center text-muted-foreground text-sm">
                  Sign in as {invite.email} to accept.
                </p>
                <button
                  type="button"
                  onClick={() => signIn.mutate()}
                  disabled={signIn.isPending}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary font-medium text-primary-foreground text-sm outline-none transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  <GithubMark className="size-4" aria-hidden />
                  Continue with GitHub
                </button>

                {signIn.isError && (
                  <p
                    role="alert"
                    className="text-center text-destructive text-sm"
                  >
                    {signIn.error.message}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
