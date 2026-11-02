import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router';
import { AuthScreen } from '@/components/shell/auth/AuthScreen';
import { AuthTitle } from '@/components/shell/auth/AuthTitle';
import { SignInToContinue } from '@/components/shell/auth/SignInToContinue';
import { buttonVariants } from '@/components/ui/button-variants';
import { useSession } from '@/hooks/api/useSession';
import { useVerifyMyEmail } from '@/hooks/api/useVerifyMyEmail';
import { verifyEmailPath } from '@/lib/emails';
import { messageOf } from '@/lib/error';
import { cn } from '@/lib/utils';

const WIDTH = 'w-80';

function OpenSpotlight() {
  return (
    <Link
      to="/"
      className={cn(
        buttonVariants({ size: 'lg' }),
        'self-center rounded-full px-6',
      )}
    >
      Open Spotlight
    </Link>
  );
}

export function VerifyEmail() {
  const { token } = useParams();
  const { data: session, isPending: reading } = useSession();
  const verify = useVerifyMyEmail(token);
  const signedIn = Boolean(session?.user);
  const started = useRef<string | null>(null);

  useEffect(() => {
    if (!signedIn || !token || started.current === token) {
      return;
    }

    started.current = token;
    verify.reset();
    verify.mutate();
  }, [signedIn, token, verify]);

  if (reading || !token) {
    return null;
  }

  if (!signedIn) {
    return (
      <AuthScreen className={WIDTH}>
        <AuthTitle title="Verify your email">
          Please sign in to Spotlight to verify this email.
        </AuthTitle>
        <SignInToContinue callbackURL={verifyEmailPath(token)} />
      </AuthScreen>
    );
  }

  if (verify.isError) {
    return (
      <AuthScreen className={WIDTH}>
        <AuthTitle title="Email not verified">
          <span role="alert">
            {messageOf(verify.error, 'Sorry, the email couldn’t be verified.')}
          </span>
        </AuthTitle>
        <OpenSpotlight />
      </AuthScreen>
    );
  }

  if (!verify.data) {
    return (
      <AuthScreen className={WIDTH}>
        <AuthTitle title="Verifying your email…">
          <span role="status">This takes a moment.</span>
        </AuthTitle>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen className={WIDTH}>
      <AuthTitle title="Email verified">
        Spotlight can now recognize you by {verify.data.email}.
      </AuthTitle>
      <OpenSpotlight />
    </AuthScreen>
  );
}
