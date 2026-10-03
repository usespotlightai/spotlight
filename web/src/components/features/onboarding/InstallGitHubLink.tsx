import { useLocation } from 'react-router';
import { buttonVariants } from '@/components/ui/button-variants';
import { useGitHub } from '@/hooks/api/useGitHub';
import { installUrlFor } from '@/lib/github';
import { cn } from '@/lib/utils';

type InstallGitHubLinkProps = {
  slug: string;
  teamId: string;
  className?: string;
};

export function InstallGitHubLink({
  slug,
  teamId,
  className,
}: InstallGitHubLinkProps) {
  const here = useLocation();
  const { data: github } = useGitHub(slug);

  if (!github?.installUrl) {
    return null;
  }

  return (
    <a
      href={installUrlFor(github.installUrl, {
        slug,
        teamId,
        from: `${here.pathname}${here.search}`,
      })}
      className={cn(
        github.connected
          ? buttonVariants({ variant: 'outline', size: 'sm' })
          : buttonVariants({ size: 'sm' }),
        className,
        github.connected && 'bg-card',
      )}
    >
      {github.connected ? 'Configure on GitHub' : 'Install on GitHub'}
    </a>
  );
}
