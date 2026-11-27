import { AuthScreen } from '@/components/shell/auth/AuthScreen';
import { ContinueWithGitHub } from '@/components/shell/auth/ContinueWithGitHub';
import { useSignIn } from '@/hooks/api/useSignIn';

export function Login() {
  const signIn = useSignIn();

  return (
    <AuthScreen className="w-72">
      <h1 className="sr-only">Log in</h1>
      <p className="text-center text-muted-foreground text-sm">
        Welcome back. Log in to continue.
      </p>

      <div className="flex flex-col gap-4">
        <ContinueWithGitHub
          onClick={() => signIn.mutate()}
          disabled={signIn.isPending}
        />
      </div>
    </AuthScreen>
  );
}
