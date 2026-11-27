import type { ReactElement } from 'react';
import { Link, useLocation } from 'react-router';

type SignInPromptProps = {
  signedIn: boolean;
  to: string;
};

const LINK = 'font-medium text-foreground underline underline-offset-2';

export function SignInPrompt({
  signedIn,
  to,
}: SignInPromptProps): ReactElement {
  const location = useLocation();

  if (signedIn) {
    return (
      <p className="text-muted-foreground text-sm">
        Only team members can {to}.
      </p>
    );
  }

  return (
    <p className="text-muted-foreground text-sm">
      <Link to="/login" state={{ from: location }} className={LINK}>
        Log in
      </Link>{' '}
      or{' '}
      <Link to="/login" state={{ from: location }} className={LINK}>
        create an account
      </Link>{' '}
      to {to}.
    </p>
  );
}
