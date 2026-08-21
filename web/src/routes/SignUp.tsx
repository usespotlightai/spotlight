import { type SubmitEvent, useId } from 'react';
import { Link, useNavigate } from 'react-router';
import { LogoLockup } from '@/components/common/brand/LogoLockup';
import { PasswordField } from '@/components/common/form/PasswordField';
import { useSignUp } from '@/hooks/api/useSignUp';

export function SignUp() {
  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const navigate = useNavigate();
  const signUp = useSignUp();

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    signUp.mutate(
      {
        name: String(form.get('name')),
        email: String(form.get('email')),
        password: String(form.get('password')),
      },
      {
        onSuccess: () => {
          void navigate('/');
        },
      },
    );
  };

  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <div className="flex w-72 flex-col gap-6">
        <LogoLockup className="mx-auto" />
        <h1 className="sr-only">Sign up</h1>
        <p className="text-center text-muted-foreground text-sm">
          Create an account to get started. By signing up you agree to the Terms
          of Service.
        </p>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label htmlFor={nameId} className="sr-only">
            Name
          </label>
          <input
            id={nameId}
            name="name"
            type="text"
            required
            autoComplete="name"
            placeholder="Full name"
            className="h-11 rounded-lg border-[0.5px] border-input bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:border focus:border-ring"
          />

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
          <PasswordField id={passwordId} autoComplete="new-password" />

          {signUp.isError && (
            <p role="alert" className="text-center text-destructive text-sm">
              {signUp.error.message}
            </p>
          )}

          <button
            type="submit"
            disabled={signUp.isPending}
            className="h-11 rounded-full bg-primary font-medium text-primary-foreground text-sm outline-none transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {signUp.isPending ? 'Creating account…' : 'Sign up'}
          </button>
          <p className="text-center text-muted-foreground text-sm">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-[450] text-foreground hover:underline"
            >
              Log in
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
