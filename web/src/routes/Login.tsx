import { LogoLockup } from '@/components/shared/brand/LogoLockup';
import { GithubMark } from '@/components/shared/icons';
import { useSignIn } from '@/hooks/api/useSignIn';

export function Login() {
  const signIn = useSignIn();

  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <div className="flex w-72 flex-col gap-6">
        <LogoLockup className="mx-auto" />
        <h1 className="sr-only">Log in</h1>
        <p className="text-center text-muted-foreground text-sm">
          Welcome back! Log in to access your dashboard.
        </p>

        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => signIn.mutate()}
            disabled={signIn.isPending}
            className="flex h-11 w-64 self-center items-center justify-center gap-2 rounded-full bg-primary font-medium text-primary-foreground text-sm outline-none transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <GithubMark className="size-4" aria-hidden />
            Continue with GitHub
          </button>

          {signIn.isError && (
            <p role="alert" className="text-center text-destructive text-sm">
              {signIn.error.message}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
