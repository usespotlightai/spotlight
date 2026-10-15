import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { useAcceptInvite } from '@/hooks/api/useAcceptInvite';
import { messageOf } from '@/lib/error';
import { inboxPath } from '@/lib/inbox';
import { sameAddress } from '@/lib/members';

type AcceptAsSignedInProps = {
  token: string | undefined;
  invitedEmail: string;
  signedInAs: string | undefined;
};

export function AcceptAsSignedIn({
  token,
  invitedEmail,
  signedInAs,
}: AcceptAsSignedInProps) {
  const navigate = useNavigate();
  const accept = useAcceptInvite(token);
  const asSomeoneElse =
    signedInAs !== undefined && !sameAddress(signedInAs, invitedEmail);

  return (
    <div className="flex flex-col gap-3">
      {asSomeoneElse ? (
        <p role="alert" className="text-center text-muted-foreground text-sm">
          The invitation is for {invitedEmail}, not {signedInAs}. Please sign in
          as {invitedEmail} to accept it.
        </p>
      ) : (
        <>
          <Button
            size="lg"
            className="self-center rounded-full px-6"
            disabled={accept.isPending}
            onClick={() =>
              accept.mutate(undefined, {
                onSuccess: (joined) =>
                  navigate(inboxPath(joined.workspaceSlug), { replace: true }),
              })
            }
          >
            {accept.isPending ? 'Joining…' : 'Accept invitation'}
          </Button>

          {accept.isError && (
            <p role="alert" className="text-center text-destructive text-sm">
              {messageOf(
                accept.error,
                'Sorry, the invitation couldn’t be accepted.',
              )}
            </p>
          )}
        </>
      )}
    </div>
  );
}
