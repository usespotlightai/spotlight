import { useNavigate } from 'react-router';
import { ErrorMessage } from '@/components/shell/auth/ErrorMessage';
import { Button } from '@/components/ui/button';
import { useAcceptInvite } from '@/hooks/api/useAcceptInvite';

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
  const asSomeoneElse = signedInAs !== undefined && signedInAs !== invitedEmail;

  return (
    <div className="flex flex-col gap-3">
      {asSomeoneElse ? (
        <p role="alert" className="text-center text-muted-foreground text-sm">
          It was sent to {invitedEmail}, and you are signed in as {signedInAs}.
          Sign in as them to accept it.
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
                navigate(`/w/${joined.workspaceSlug}/team/${joined.teamId}`, {
                  replace: true,
                }),
            })
          }
        >
          {accept.isPending ? 'Joining…' : 'Accept invitation'}
        </Button>
      )}

      {accept.isError && <ErrorMessage error={accept.error} />}
    </div>
  );
}
