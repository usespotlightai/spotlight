import { ContinueWithGitHub } from '@/components/shell/auth/ContinueWithGitHub';
import { useSignIn } from '@/hooks/api/useSignIn';

type SignInToContinueProps = {
  callbackURL: string;
};

export function SignInToContinue({ callbackURL }: SignInToContinueProps) {
  const signIn = useSignIn(callbackURL);

  return (
    <div className="flex flex-col gap-3">
      <ContinueWithGitHub
        onClick={() => signIn.mutate()}
        disabled={signIn.isPending}
      />
    </div>
  );
}
