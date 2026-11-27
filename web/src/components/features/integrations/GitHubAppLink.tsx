import { ConnectGitHub } from '@/components/features/integrations/ConnectGitHub';
import { pillClass } from '@/lib/pill';

type GitHubAppLinkProps = {
  slug: string;
  href: string;
  installed: boolean;
};

export function GitHubAppLink({ slug, href, installed }: GitHubAppLinkProps) {
  if (!installed) {
    return (
      <ConnectGitHub
        slug={slug}
        installUrl={href}
        className={pillClass('default')}
        align="end"
      />
    );
  }

  return (
    <a href={href} className={pillClass('outline')}>
      Manage on GitHub
    </a>
  );
}
