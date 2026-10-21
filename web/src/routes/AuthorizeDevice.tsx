import { Link, useSearchParams } from 'react-router';
import { DecideDevice } from '@/components/features/devices/DecideDevice';
import { EnterUserCode } from '@/components/features/devices/EnterUserCode';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { AuthScreen } from '@/components/shell/auth/AuthScreen';
import { AuthTitle } from '@/components/shell/auth/AuthTitle';
import { SignInToContinue } from '@/components/shell/auth/SignInToContinue';
import { useDeviceCode } from '@/hooks/api/useDeviceCode';
import { useSession } from '@/hooks/api/useSession';
import { DEVICE_PATH, devicePath, TOO_MANY_ATTEMPTS } from '@/lib/device';
import { failed, loading } from '@/lib/query';

const WIDTH = 'w-80';

const TITLE = 'Log in to the Spotlight CLI';

export function AuthorizeDevice() {
  const [params] = useSearchParams();
  const userCode = params.get('user_code');
  const { data: session, isPending: reading } = useSession();
  const signedIn = Boolean(session?.user);
  const device = useDeviceCode(userCode, signedIn);

  if (reading || (signedIn && userCode && loading(device))) {
    return null;
  }

  if (!userCode) {
    return (
      <AuthScreen className={WIDTH}>
        <AuthTitle title={TITLE}>
          Enter the code that spotlight login shows in your terminal.
        </AuthTitle>
        <EnterUserCode />
      </AuthScreen>
    );
  }

  if (!signedIn) {
    return (
      <AuthScreen className={WIDTH}>
        <AuthTitle title={TITLE}>
          Log in to approve the code from your terminal.
        </AuthTitle>
        <SignInToContinue callbackURL={devicePath(userCode)} />
      </AuthScreen>
    );
  }

  if (failed(device) && device.error?.message === TOO_MANY_ATTEMPTS) {
    return (
      <AuthScreen className={WIDTH}>
        <AuthTitle title="Too many attempts">{TOO_MANY_ATTEMPTS}</AuthTitle>
      </AuthScreen>
    );
  }

  if (failed(device)) {
    return (
      <AuthScreen className={WIDTH}>
        <CouldNotLoad
          what="The code"
          retrying={device.isFetching}
          onRetry={() => void device.refetch()}
        />
      </AuthScreen>
    );
  }

  if (device.data === null) {
    return (
      <AuthScreen className={WIDTH}>
        <AuthTitle title="Code doesn’t work">
          The code may have expired, or it may be incomplete. Please run
          spotlight login again.
        </AuthTitle>
        <Link
          to={DEVICE_PATH}
          className="self-center text-muted-foreground text-sm outline-none transition-opacity hover:opacity-70"
        >
          Enter another code
        </Link>
      </AuthScreen>
    );
  }

  if (device.data === 'approved') {
    return (
      <AuthScreen className={WIDTH}>
        <AuthTitle title="Spotlight CLI is logged in">
          You can close this tab and go back to your terminal.
        </AuthTitle>
      </AuthScreen>
    );
  }

  if (device.data === 'denied') {
    return (
      <AuthScreen className={WIDTH}>
        <AuthTitle title="Login denied">
          The Spotlight CLI is not logged in. You can close this tab.
        </AuthTitle>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen className={WIDTH}>
      <AuthTitle title="Approve the Spotlight CLI?">
        The CLI acts as {session?.user.email} in every workspace you are a
        member of. Approve only a code that your terminal shows.
      </AuthTitle>
      <DecideDevice userCode={userCode} />
    </AuthScreen>
  );
}
