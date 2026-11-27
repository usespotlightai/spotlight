import { useLocation } from 'react-router';

import { ConnectGitHub } from '@/components/features/integrations/ConnectGitHub';
import { buttonVariants } from '@/components/ui/button-variants';
import { useGitHub } from '@/hooks/api/useGitHub';
import { installUrlFor } from '@/lib/github';
import { nonEmpty } from '@/lib/non-empty';
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

  if (!nonEmpty(github?.installUrl)) {
    return null;
  }

  const installUrl = installUrlFor(github.installUrl, {
    slug,
    teamId,
    from: `${here.pathname}${here.search}`,
  });

  if (!github.connected) {
    return (
      <ConnectGitHub
        slug={slug}
        installUrl={installUrl}
        className={cn(buttonVariants({ size: 'sm' }), className)}
      />
    );
  }

  return (
    <a
      href={installUrl}
      className={cn(
        buttonVariants({ variant: 'outline', size: 'sm' }),
        className,
        'bg-card',
      )}
    >
      Configure on GitHub
    </a>
  );
}
