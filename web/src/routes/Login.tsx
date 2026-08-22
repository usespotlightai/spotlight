import { type SubmitEvent, useId } from 'react';
import { Link, useNavigate } from 'react-router';
import { LogoLockup } from '@/components/common/brand/LogoLockup';
import { PasswordField } from '@/components/common/form/PasswordField';
import { useSignIn } from '@/hooks/api/useSignIn';

export function Login() {
  const emailId = useId();
  const passwordId = useId();
  const navigate = useNavigate();
  const signIn = useSignIn();

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    signIn.mutate(
      {
        email: String(form.get('email')),
        password: String(form.get('password')),
      },
      {
        onSuccess: () => {
          void navigate('/', { replace: true });
        },
      },
    );
  };

  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <div className="flex w-72 flex-col gap-6">
        <LogoLockup className="mx-auto" />
        <h1 className="sr-only">Log in</h1>
        <p className="text-center text-muted-foreground text-sm">
          Welcome back! Login to access your dashboard.
        </p>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label htmlFor={emailId} className="sr-only">
            Email
          </label>
          <input
            id={emailId}
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="Email address"
            className="h-11 rounded-lg border-[0.5px] border-input bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:border focus:border-ring"
          />
          <PasswordField id={passwordId} autoComplete="current-password" />

          {signIn.isError && (
            <p role="alert" className="text-center text-destructive text-sm">
              {signIn.error.message}
            </p>
          )}

          <button
            type="submit"
            disabled={signIn.isPending}
            className="h-11 rounded-full bg-primary font-medium text-primary-foreground text-sm outline-none transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {signIn.isPending ? 'Logging in…' : 'Log in'}
          </button>
          <p className="text-center text-muted-foreground text-sm">
            Don't have an account?{' '}
            <Link
              to="/signup"
              className="font-[450] text-foreground hover:underline"
            >
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
