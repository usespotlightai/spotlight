import { ContinueWithGitHub } from '@/components/shell/auth/ContinueWithGitHub';
import { ErrorMessage } from '@/components/shell/auth/ErrorMessage';
import { useSignIn } from '@/hooks/api/useSignIn';

type SignInToAcceptProps = {
  token: string | undefined;
};

export function SignInToAccept({ token }: SignInToAcceptProps) {
  const signIn = useSignIn(`/invites/${token}`);

  return (
    <div className="flex flex-col gap-3">
      <ContinueWithGitHub
        onClick={() => signIn.mutate()}
        disabled={signIn.isPending}
      />

      {signIn.isError && <ErrorMessage error={signIn.error} />}
    </div>
  );
}
