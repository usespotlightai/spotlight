import { useParams } from 'react-router';
import { AcceptAsSignedIn } from '@/components/features/invites/AcceptAsSignedIn';
import { SignInToAccept } from '@/components/features/invites/SignInToAccept';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { AuthScreen } from '@/components/shell/auth/AuthScreen';
import { AuthTitle } from '@/components/shell/auth/AuthTitle';
import { useInvite } from '@/hooks/api/useInvite';
import { useSession } from '@/hooks/api/useSession';
import { inviterNamed, joiningAs } from '@/lib/members';
import { failed, loading } from '@/lib/query';

const WIDTH = 'w-80';

const SAYS: Record<string, string> = {
  accepted: 'This invitation is already accepted.',
  revoked: 'This invitation is withdrawn.',
  expired: 'This invitation has expired. Please ask for a new one.',
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
        <AuthTitle title="Invitation link doesn’t work">
          The invitation may be withdrawn, or the link may be incomplete. Please
          ask for a new one.
        </AuthTitle>
      </AuthScreen>
    );
  }

  const closed = invite.status !== 'open';

  return (
    <AuthScreen className={WIDTH}>
      <AuthTitle
        title={`${inviterNamed(invite.invitedBy)} invited you to ${invite.workspaceName}`}
      >
        {joiningAs(invite.role, invite.teamNames)}
      </AuthTitle>

      {closed ? (
        <p role="alert" className="text-center text-muted-foreground text-sm">
          {SAYS[invite.status]}
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
