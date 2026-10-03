import { useParams } from 'react-router';
import { AcceptAsSignedIn } from '@/components/features/invites/AcceptAsSignedIn';
import { SignInToAccept } from '@/components/features/invites/SignInToAccept';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { AuthScreen } from '@/components/shell/auth/AuthScreen';
import { AuthTitle } from '@/components/shell/auth/AuthTitle';
import { useInvite } from '@/hooks/api/useInvite';
import { useSession } from '@/hooks/api/useSession';
import { failed, loading } from '@/lib/query';

const WIDTH = 'w-80';

const SAYS: Record<string, string> = {
  accepted: 'This invitation has already been accepted.',
  revoked: 'This invitation has been taken back.',
  expired: 'This invitation has run out. Ask for another.',
};

export function AcceptInvite() {
  const { token } = useParams();
  const { data: session, isPending: reading } = useSession();
  const offer = useInvite(token);

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

  const closed = invite.standing !== 'open';

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
        <AcceptAsSignedIn
          token={token}
          invitedEmail={invite.email}
          signedInAs={session.user.email}
        />
      ) : (
        <SignInToAccept token={token} />
      )}
    </AuthScreen>
  );
}
