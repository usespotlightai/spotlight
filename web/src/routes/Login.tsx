import { AuthScreen } from '@/components/shell/auth/AuthScreen';
import { ContinueWithGitHub } from '@/components/shell/auth/ContinueWithGitHub';
import { ErrorMessage } from '@/components/shell/auth/ErrorMessage';
import { useSignIn } from '@/hooks/api/useSignIn';

export function Login() {
  const signIn = useSignIn();

  return (
    <AuthScreen className="w-72">
      <h1 className="sr-only">Log in</h1>
      <p className="text-center text-muted-foreground text-sm">
        Welcome back! Log in to access your dashboard.
      </p>

      <div className="flex flex-col gap-4">
        <ContinueWithGitHub
          onClick={() => signIn.mutate()}
          disabled={signIn.isPending}
        />

        {signIn.isError && (
          <ErrorMessage error="We couldn’t sign you in. Please try again later." />
        )}
      </div>
    </AuthScreen>
  );
}
