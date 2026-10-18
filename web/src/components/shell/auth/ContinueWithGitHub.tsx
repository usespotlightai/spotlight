import { GithubLogo } from '@/components/shared/icons';

type ContinueWithGitHubProps = {
  onClick: () => void;
  disabled: boolean;
};

export function ContinueWithGitHub({
  onClick,
  disabled,
}: ContinueWithGitHubProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 items-center justify-center gap-2 self-center rounded-full bg-primary px-6 font-medium text-primary-foreground text-sm outline-none transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      <GithubLogo className="size-4" aria-hidden />
      Continue with GitHub
    </button>
  );
}
